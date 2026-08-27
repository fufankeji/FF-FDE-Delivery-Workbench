/** Host-backed observable for Workspace-keyed FDE stage loading. */

import { isFdeStageId, type FdeStageId } from './stages.ts'

/** Exact Host route owned by `@deepseek-ai/dsh-fde-stage`. */
export const FDE_STAGE_OPEN_PATH = '/api/fde-stage/open'
/** Browser-local cache invalidation emitted after one durable stage commit. */
export const FDE_STAGE_CHANGED_EVENT = 'fde:project-stage-changed'

/** One committed project-stage projection. */
export interface ProjectStageValue {
  readonly workspaceId: string
  readonly currentStage: FdeStageId
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
}

/** Client loading state for one Workspace. */
export type ProjectStageLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: ProjectStageValue }
  | { readonly status: 'error'; readonly message: string }

/** Immutable controller snapshot. */
export interface FdeStageProgressSnapshot {
  readonly byWorkspace: Readonly<Record<string, ProjectStageLoadState>>
}

interface StageSuccess { ok: true; value: ProjectStageValue }
interface StageFailure { ok: false; error?: { code?: string; message?: string } }

function parseValue(payload: unknown, workspaceId: string): ProjectStageValue {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('阶段状态响应无效。')
  }
  const result = payload as StageSuccess | StageFailure
  if (!result.ok) throw new Error(result.error?.message ?? '项目阶段读取失败。')
  const value = result.value
  if (value.workspaceId !== workspaceId
    || !isFdeStageId(value.currentStage)
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error('阶段状态响应无效。')
  }
  return value
}

/**
 * Load one Workspace stage through the exact same-origin route.
 * @param workspaceId - exact registered project identity.
 * @param fetchImpl - request implementation, replaceable by tests.
 * @param signal - optional request cancellation.
 * @returns the current durable stage value.
 */
export async function fetchProjectStage(
  workspaceId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectStageValue> {
  const response = await fetchImpl(FDE_STAGE_OPEN_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('阶段状态响应无效。')
  }
  if (!response.ok) {
    const failure = payload as StageFailure
    throw new Error(failure.error?.message ?? `项目阶段读取失败（HTTP ${String(response.status)}）。`)
  }
  return parseValue(payload, workspaceId)
}

/** One in-flight Workspace request and its cancellation owner. */
interface StageRequest {
  readonly controller: AbortController
  readonly promise: Promise<void>
}

/** Apply-scoped project-stage object layer shared by every FDE stage entry. */
export class FdeStageProgressController {
  private snapshot: FdeStageProgressSnapshot = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private readonly requests = new Map<string, StageRequest>()
  private disposed = false
  private readonly onChanged = (event: Event): void => {
    const detail = (event as CustomEvent<{ workspaceId?: unknown }>).detail
    if (typeof detail?.workspaceId === 'string') this.refresh(detail.workspaceId)
  }

  constructor() {
    if (typeof window !== 'undefined') window.addEventListener(FDE_STAGE_CHANGED_EVENT, this.onChanged)
  }

  /** Current immutable snapshot; stable until a state changes. */
  getSnapshot = (): FdeStageProgressSnapshot => this.snapshot

  /** Subscribe to project-stage state changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Load one Workspace once; ready, failed, and in-flight entries are retained.
   * @param workspaceId - exact project identity.
   */
  load(workspaceId: string): void {
    if (this.disposed || this.snapshot.byWorkspace[workspaceId] !== undefined) return
    this.start(workspaceId)
  }

  /**
   * Retry one failed Workspace without disturbing another project's state.
   * @param workspaceId - exact project identity.
   */
  retry(workspaceId: string): void {
    if (this.disposed || this.requests.has(workspaceId)) return
    this.start(workspaceId)
  }

  /** Invalidate one Workspace cache and read its durable stage again. */
  refresh(workspaceId: string): void {
    if (this.disposed) return
    this.requests.get(workspaceId)?.controller.abort()
    this.start(workspaceId)
  }

  /** Cancel pending reads and suppress all later publication. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const request of this.requests.values()) request.controller.abort()
    this.requests.clear()
    this.listeners.clear()
    if (typeof window !== 'undefined') window.removeEventListener(FDE_STAGE_CHANGED_EVENT, this.onChanged)
  }

  private start(workspaceId: string): void {
    this.publish(workspaceId, { status: 'loading' })
    const controller = new AbortController()
    const promise = fetchProjectStage(workspaceId, fetch, controller.signal).then(
      (value) => { if (!this.disposed) this.publish(workspaceId, { status: 'ready', value }) },
      (error: unknown) => {
        if (!this.disposed && !controller.signal.aborted) {
          this.publish(workspaceId, {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
    ).finally(() => {
      if (this.requests.get(workspaceId)?.controller === controller) this.requests.delete(workspaceId)
    })
    this.requests.set(workspaceId, { controller, promise })
  }

  private publish(workspaceId: string, state: ProjectStageLoadState): void {
    this.snapshot = {
      byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state },
    }
    for (const listener of this.listeners) listener()
  }
}

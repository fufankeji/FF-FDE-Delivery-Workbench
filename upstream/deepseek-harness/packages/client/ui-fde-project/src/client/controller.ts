/** Host-backed project snapshot controller shared by the four project views. */

/** Exact Host route owned by `@deepseek-ai/dsh-fde-project`. */
export const FDE_PROJECT_SNAPSHOT_PATH = '/api/fde-project/snapshot'
/** Exact Host route for confirming one architecture revision. */
export const FDE_ARCHITECTURE_CONFIRM_PATH = '/api/fde-project/architecture/confirm'
/** Exact Host route for approving one indexed evaluation report. */
export const FDE_EVALUATION_BASELINE_PATH = '/api/fde-project/evaluation/baseline'

/** Architecture node styles accepted from the project artifact. */
export type ArchitectureNodeKind = 'default' | 'entry' | 'core' | 'store' | 'external' | 'output'

/** Browser wire value for one current project architecture. */
export interface ProjectArchitecture {
  readonly version: 1
  readonly revision: number
  readonly title: string
  readonly summary?: string
  readonly status: 'candidate' | 'pending-confirmation' | 'confirmed' | 'impacted' | 'superseded'
  readonly updatedAt: string
  readonly groups: readonly { readonly id: string; readonly label: string }[]
  readonly nodes: readonly {
    readonly id: string
    readonly label: string
    readonly kind: ArchitectureNodeKind
    readonly note?: string
    readonly group?: string
  }[]
  readonly edges: readonly {
    readonly from: string
    readonly to: string
    readonly label?: string
    readonly dashed?: boolean
  }[]
}

/** Browser states for one project's explicit API documentation configuration. */
export type ApiDocsSnapshot =
  | { readonly status: 'unconfigured'; readonly message: string }
  | { readonly status: 'invalid'; readonly message: string }
  | {
    readonly status: 'configured'
    readonly docsUrl?: string
    readonly openapiSource?: string
    readonly baseUrl?: string
    readonly allowedMethods: readonly string[]
    readonly allowPrivateNetwork: boolean
  }

/** Bounded browser summary of one persisted evaluation report. */
export interface EvaluationReportSummary {
  readonly id: string
  readonly path: string
  readonly updatedAt: string
  readonly status: 'PASS' | 'WARN' | 'FAIL' | 'N/A' | 'UNKNOWN'
  readonly passed: number
  readonly failed: number
  readonly errors: number
  readonly total: number
  readonly cases: readonly {
    readonly name: string
    readonly status: string
    readonly failures: readonly string[]
    readonly error?: string
  }[]
}

/** One project-level read model returned by the trusted Host route. */
export interface ProjectSurfaceSnapshot {
  readonly workspaceId: string
  readonly title: string
  readonly apiDocs: ApiDocsSnapshot
  readonly architecture: ProjectArchitecture | null
  readonly architectureError?: string
  readonly evaluation: {
    readonly casesCount: number
    readonly reports: readonly EvaluationReportSummary[]
    readonly baseline?: EvaluationReportSummary
    readonly message?: string
  }
}

/** Client loading state for one project snapshot. */
export type ProjectSurfaceLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: ProjectSurfaceSnapshot }
  | { readonly status: 'error'; readonly message: string }

/** Immutable Workspace-keyed project controller state. */
export interface ProjectSurfaceControllerSnapshot {
  readonly byWorkspace: Readonly<Record<string, ProjectSurfaceLoadState>>
}

interface SnapshotSuccess { readonly ok: true; readonly value: ProjectSurfaceSnapshot }
interface SnapshotFailure { readonly ok: false; readonly error?: { readonly message?: string } }

function parseSnapshot(value: unknown, workspaceId: string): ProjectSurfaceSnapshot {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('项目页面响应无效。')
  const result = value as SnapshotSuccess | SnapshotFailure
  if (!result.ok) throw new Error(result.error?.message ?? '项目页面读取失败。')
  if (result.value.workspaceId !== workspaceId) throw new Error('项目页面响应与当前项目不一致。')
  return result.value
}

/**
 * Read one project snapshot from the same-origin Host route.
 * @param workspaceId - exact registered project identity.
 * @param fetchImpl - request implementation, replaceable by tests.
 * @param signal - optional request cancellation.
 * @returns the addressed project snapshot.
 */
export async function fetchProjectSurface(
  workspaceId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_PROJECT_SNAPSHOT_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('项目页面响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `项目页面读取失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/**
 * Confirm one exact displayed architecture revision.
 * @param workspaceId - exact registered project identity.
 * @param revision - revision currently displayed to the user.
 * @param fetchImpl - request implementation, replaceable by tests.
 * @param signal - optional request cancellation.
 * @returns the refreshed project snapshot.
 */
export async function confirmProjectArchitecture(
  workspaceId: string,
  revision: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_ARCHITECTURE_CONFIRM_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, revision }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('系统架构确认响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `系统架构确认失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/**
 * Approve one project report as the explicit evaluation baseline.
 * @param workspaceId - exact registered project identity.
 * @param reportPath - project-relative indexed report path.
 * @param fetchImpl - request implementation, replaceable by tests.
 * @param signal - optional request cancellation.
 * @returns the refreshed project snapshot.
 */
export async function approveProjectEvaluationBaseline(
  workspaceId: string,
  reportPath: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_EVALUATION_BASELINE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, reportPath }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('评估基线响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `评估基线设置失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Apply-scoped project snapshot object layer. */
export class FdeProjectSurfaceController {
  private snapshot: ProjectSurfaceControllerSnapshot = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private readonly requests = new Map<string, AbortController>()
  private disposed = false

  /** Current immutable controller state. */
  getSnapshot = (): ProjectSurfaceControllerSnapshot => this.snapshot

  /** Subscribe to snapshot changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Load one project once.
   * @param workspaceId - exact project identity.
   */
  load(workspaceId: string): void {
    if (this.disposed) return
    this.cancelOtherRequests(workspaceId)
    if (this.snapshot.byWorkspace[workspaceId] !== undefined) return
    this.start(workspaceId)
  }

  /**
   * Replace one project's snapshot with a fresh Host read.
   * @param workspaceId - exact project identity.
   */
  refresh(workspaceId: string): void {
    if (this.disposed) return
    this.cancelOtherRequests(workspaceId)
    this.start(workspaceId)
  }

  /**
   * Confirm one exact architecture revision without hiding the current graph.
   * @param workspaceId - exact project identity.
   * @param revision - revision currently displayed.
   */
  async confirmArchitecture(workspaceId: string, revision: number): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await confirmProjectArchitecture(workspaceId, revision, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /**
   * Approve one indexed report and publish the resulting baseline snapshot.
   * @param workspaceId - exact project identity.
   * @param reportPath - project-relative indexed report path.
   */
  async approveEvaluationBaseline(workspaceId: string, reportPath: string): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await approveProjectEvaluationBaseline(workspaceId, reportPath, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /** Cancel pending reads and release subscribers. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
    this.listeners.clear()
  }

  private start(workspaceId: string): void {
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    this.publish(workspaceId, { status: 'loading' })
    void fetchProjectSurface(workspaceId, fetch, controller.signal).then(
      (value) => {
        if (this.canPublish(workspaceId, controller)) this.publish(workspaceId, { status: 'ready', value })
      },
      (error: unknown) => {
        if (!this.disposed && !controller.signal.aborted && this.requests.get(workspaceId) === controller) {
          this.publish(workspaceId, { status: 'error', message: error instanceof Error ? error.message : String(error) })
        }
      },
    ).finally(() => {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    })
  }

  private cancelOtherRequests(workspaceId: string): void {
    for (const [id, request] of this.requests) {
      if (id === workspaceId) continue
      request.abort()
      this.requests.delete(id)
    }
  }

  private canPublish(workspaceId: string, controller: AbortController): boolean {
    return !this.disposed && this.requests.get(workspaceId) === controller
  }

  private publish(workspaceId: string, state: ProjectSurfaceLoadState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state } }
    for (const listener of this.listeners) listener()
  }
}

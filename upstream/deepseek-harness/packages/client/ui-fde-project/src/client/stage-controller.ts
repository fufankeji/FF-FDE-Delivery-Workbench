/** Workspace stage reader used by the root multi-project progress page. */

/** Stable six-stage ids used by the global progress page. */
export const FDE_STAGE_IDS = ['requirements', 'solution', 'development', 'validation', 'pilot', 'handoff'] as const
/** One supported FDE project stage id. */
export type FdeStageId = typeof FDE_STAGE_IDS[number]
/** Ordered stage metadata for the global progress segments. */
export const FDE_STAGES = FDE_STAGE_IDS.map((id, index) => ({ id, number: index + 1 }))

/** One Workspace stage value returned by the Host route. */
export interface ProjectStageValue {
  readonly workspaceId: string
  readonly currentStage: FdeStageId
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
}

/** Client loading state for one Workspace stage. */
export type ProjectStageLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: ProjectStageValue }
  | { readonly status: 'error'; readonly message: string }

/** Immutable Workspace-keyed stage controller state. */
export interface StageControllerSnapshot { readonly byWorkspace: Readonly<Record<string, ProjectStageLoadState>> }

function isStage(value: unknown): value is FdeStageId {
  return typeof value === 'string' && (FDE_STAGE_IDS as readonly string[]).includes(value)
}

async function fetchStage(workspaceId: string, signal: AbortSignal): Promise<ProjectStageValue> {
  const response = await fetch('/api/fde-stage/open', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId }), signal,
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('项目阶段响应无效。') }
  const result = payload as {
    readonly ok?: unknown
    readonly value?: Partial<ProjectStageValue>
    readonly error?: { readonly message?: string }
  }
  if (!response.ok || result.ok !== true) throw new Error(result.error?.message ?? '项目阶段读取失败。')
  const value = result.value
  if (value?.workspaceId !== workspaceId || !isStage(value.currentStage) || !Number.isSafeInteger(value.revision)
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') throw new Error('项目阶段响应无效。')
  return value as ProjectStageValue
}

/** Apply-scoped Workspace-keyed stage reader for the global project page. */
export class ProjectStageController {
  private snapshot: StageControllerSnapshot = { byWorkspace: {} }
  private readonly listeners = new Set<() => void>()
  private readonly requests = new Map<string, AbortController>()
  private disposed = false

  /** Current immutable state. */
  getSnapshot = (): StageControllerSnapshot => this.snapshot
  /** Subscribe to state changes. */
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  /**
   * Load one project once.
   * @param workspaceId - exact project identity.
   */
  load(workspaceId: string): void {
    if (this.disposed || this.snapshot.byWorkspace[workspaceId] !== undefined) return
    this.start(workspaceId)
  }

  /**
   * Retry the addressed project.
   * @param workspaceId - exact project identity.
   */
  retry(workspaceId: string): void {
    if (this.disposed || this.requests.has(workspaceId)) return
    this.start(workspaceId)
  }

  /** Cancel pending reads and release subscribers. */
  dispose(): void {
    this.disposed = true
    for (const request of this.requests.values()) request.abort()
    this.requests.clear()
    this.listeners.clear()
  }

  private start(workspaceId: string): void {
    this.publish(workspaceId, { status: 'loading' })
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    void fetchStage(workspaceId, controller.signal).then(
      (value) => { if (!this.disposed) this.publish(workspaceId, { status: 'ready', value }) },
      (error: unknown) => {
        if (!this.disposed && !controller.signal.aborted) this.publish(workspaceId, { status: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    ).finally(() => { this.requests.delete(workspaceId) })
  }

  private publish(workspaceId: string, state: ProjectStageLoadState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state } }
    for (const listener of this.listeners) listener()
  }
}

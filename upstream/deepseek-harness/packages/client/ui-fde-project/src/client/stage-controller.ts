/** Workspace stage reader used by the root multi-project progress page. */

/** Stable six-stage ids used by the global progress page. */
export const FDE_STAGE_IDS = ['requirements', 'solution', 'development', 'validation', 'pilot', 'handoff'] as const
/** One supported FDE project stage id. */
export type FdeStageId = typeof FDE_STAGE_IDS[number]
/** Ordered stage metadata for the global progress segments. */
export const FDE_STAGES = FDE_STAGE_IDS.map((id, index) => ({ id, number: index + 1 }))
/** Fixed manual gate owned by the Host stage plugin. */
export const FDE_STAGE_COMPLETE_REQUIREMENTS_PATH = '/api/fde-stage/requirements/complete'
/** Fixed FDE-only solution-design completion route. */
export const FDE_STAGE_COMPLETE_SOLUTION_PATH = '/api/fde-stage/solution/complete'
/** Browser-local cache invalidation emitted after one durable stage commit. */
export const FDE_STAGE_CHANGED_EVENT = 'fde:project-stage-changed'

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

/** Submit the FDE's explicit requirements completion against one exact revision. */
export async function completeRequirementResearch(
  workspaceId: string,
  expectedRevision: number,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await completeStage(
    FDE_STAGE_COMPLETE_REQUIREMENTS_PATH,
    workspaceId,
    expectedRevision,
    '需求调研阶段确认失败。',
    signal,
    fetchImpl,
  )
}

/** Submit the FDE's explicit solution completion against one exact revision. */
export async function completeSolutionDesign(
  workspaceId: string,
  expectedRevision: number,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await completeStage(
    FDE_STAGE_COMPLETE_SOLUTION_PATH,
    workspaceId,
    expectedRevision,
    '方案设计阶段确认失败。',
    signal,
    fetchImpl,
  )
}

async function completeStage(
  path: string,
  workspaceId: string,
  expectedRevision: number,
  failureMessage: string,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  const request = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))
  const response = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, expectedRevision }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('阶段确认响应无效。') }
  const result = payload as {
    readonly ok?: unknown
    readonly value?: Partial<ProjectStageValue>
    readonly error?: { readonly message?: string }
  }
  if (!response.ok || result.ok !== true) throw new Error(result.error?.message ?? failureMessage)
  const value = result.value
  if (value?.workspaceId !== workspaceId || !isStage(value.currentStage) || !Number.isSafeInteger(value.revision)
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') throw new Error('阶段确认响应无效。')
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

  /** Complete requirement research without hiding the currently displayed stage. */
  async completeRequirements(workspaceId: string, expectedRevision: number): Promise<void> {
    await this.complete(workspaceId, expectedRevision, completeRequirementResearch)
  }

  /** Complete solution design without hiding the currently displayed stage. */
  async completeSolution(workspaceId: string, expectedRevision: number): Promise<void> {
    await this.complete(workspaceId, expectedRevision, completeSolutionDesign)
  }

  private async complete(
    workspaceId: string,
    expectedRevision: number,
    operation: (workspaceId: string, expectedRevision: number, signal?: AbortSignal) => Promise<ProjectStageValue>,
  ): Promise<void> {
    if (this.disposed) throw new Error('项目进度已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await operation(workspaceId, expectedRevision, controller.signal)
      if (!this.disposed && this.requests.get(workspaceId) === controller) {
        this.publish(workspaceId, { status: 'ready', value })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(FDE_STAGE_CHANGED_EVENT, { detail: { workspaceId } }))
        }
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
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
    ).finally(() => {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    })
  }

  private publish(workspaceId: string, state: ProjectStageLoadState): void {
    this.snapshot = { byWorkspace: { ...this.snapshot.byWorkspace, [workspaceId]: state } }
    for (const listener of this.listeners) listener()
  }
}

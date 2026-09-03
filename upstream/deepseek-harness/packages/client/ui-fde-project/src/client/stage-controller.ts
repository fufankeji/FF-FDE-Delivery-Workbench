/** Workspace stage reader used by the root multi-project progress page. */

/** Stable six-stage ids used by the global progress page. */
export const FDE_STAGE_IDS = ['requirements', 'solution', 'development', 'validation', 'pilot', 'handoff'] as const
/** One supported FDE project stage id. */
export type FdeStageId = typeof FDE_STAGE_IDS[number]
/** Six active stages plus the terminal completion state. */
export type FdeProjectState = FdeStageId | 'completed'
/** Authoritative eight-stage V2 lifecycle ids. */
export const FDE_V2_STAGE_IDS = ['discovery', 'definition', 'investigation', 'design', 'evaluation', 'pilot', 'production', 'improvement'] as const
/** One authoritative V2 lifecycle stage. */
export type FdeV2StageId = typeof FDE_V2_STAGE_IDS[number]
/** Ordered stage metadata for the global progress segments. */
export const FDE_STAGES = FDE_STAGE_IDS.map((id, index) => ({ id, number: index + 1 }))
/** Fixed manual gate owned by the Host stage plugin. */
export const FDE_STAGE_COMPLETE_REQUIREMENTS_PATH = '/api/fde-stage/requirements/complete'
/** Fixed FDE-only solution-design completion route. */
export const FDE_STAGE_COMPLETE_SOLUTION_PATH = '/api/fde-stage/solution/complete'
/** Fixed FDE-only project-development completion route. */
export const FDE_STAGE_COMPLETE_DEVELOPMENT_PATH = '/api/fde-stage/development/complete'
/** Fixed FDE-only validation completion route. */
export const FDE_STAGE_COMPLETE_VALIDATION_PATH = '/api/fde-stage/validation/complete'
/** Fixed FDE-only deployment-trial completion route. */
export const FDE_STAGE_COMPLETE_PILOT_PATH = '/api/fde-stage/pilot/complete'
/** Fixed FDE-only acceptance-handover completion route. */
export const FDE_STAGE_COMPLETE_HANDOFF_PATH = '/api/fde-stage/handoff/complete'
/** FDE-only one-stage return route, including completed-project reopening. */
export const FDE_STAGE_RETURN_PATH = '/api/fde-stage/return'
/** Authoritative V2 manual completion route. */
export const FDE_V2_STAGE_COMPLETE_PATH = '/api/fde-stage/v2/complete'
/** Authoritative V2 one-stage return route. */
export const FDE_V2_STAGE_RETURN_PATH = '/api/fde-stage/v2/return'
/** Browser-local cache invalidation emitted after one durable stage commit. */
export const FDE_STAGE_CHANGED_EVENT = 'fde:project-stage-changed'

/** One Workspace stage value returned by the Host route. */
export interface ProjectStageValue {
  readonly workspaceId: string
  readonly currentStage: FdeProjectState
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly lifecycleVersion?: 2
  readonly v2Stage?: FdeV2StageId
  readonly v2ReconfirmThrough?: FdeV2StageId
  readonly improvementCycles?: number
  readonly lastReviewedAt?: string
  readonly v2Returns?: readonly ProjectV2StageReturnRecord[]
  readonly reconfirmThrough?: FdeProjectState
  readonly returns?: readonly ProjectStageReturnRecord[]
}

/** One durable V2 stage-return audit entry. */
export interface ProjectV2StageReturnRecord {
  readonly from: FdeV2StageId
  readonly to: FdeV2StageId
  readonly reason: string
  readonly returnedAt: string
  readonly revision: number
}

/** One durable FDE stage-return audit entry. */
export interface ProjectStageReturnRecord {
  readonly from: FdeProjectState
  readonly to: FdeStageId
  readonly reason: string
  readonly returnedAt: string
  readonly revision: number
}

/** Client loading state for one Workspace stage. */
export type ProjectStageLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: ProjectStageValue }
  | { readonly status: 'error'; readonly message: string }

/** Immutable Workspace-keyed stage controller state. */
export interface StageControllerSnapshot { readonly byWorkspace: Readonly<Record<string, ProjectStageLoadState>> }

function isProjectState(value: unknown): value is FdeProjectState {
  return value === 'completed' || (typeof value === 'string' && (FDE_STAGE_IDS as readonly string[]).includes(value))
}

function isV2Stage(value: unknown): value is FdeV2StageId {
  return typeof value === 'string' && (FDE_V2_STAGE_IDS as readonly string[]).includes(value)
}

function isProjectStageValue(value: Partial<ProjectStageValue> | undefined, workspaceId: string): value is ProjectStageValue {
  if (value?.workspaceId !== workspaceId || !isProjectState(value.currentStage) || !Number.isSafeInteger(value.revision)
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  if (value.reconfirmThrough !== undefined && !isProjectState(value.reconfirmThrough)) return false
  if (value.lifecycleVersion !== undefined && value.lifecycleVersion !== 2) return false
  if (value.v2Stage !== undefined && !isV2Stage(value.v2Stage)) return false
  if (value.v2ReconfirmThrough !== undefined && !isV2Stage(value.v2ReconfirmThrough)) return false
  if (value.improvementCycles !== undefined && (!Number.isSafeInteger(value.improvementCycles) || value.improvementCycles < 0)) return false
  if (value.lastReviewedAt !== undefined && typeof value.lastReviewedAt !== 'string') return false
  if (value.v2Returns !== undefined && (!Array.isArray(value.v2Returns) || value.v2Returns.some(entry => (
    !isV2Stage(entry.from) || !isV2Stage(entry.to) || typeof entry.reason !== 'string' || entry.reason.trim() === ''
    || typeof entry.returnedAt !== 'string' || !Number.isSafeInteger(entry.revision)
  )))) return false
  if (value.returns !== undefined && (!Array.isArray(value.returns) || value.returns.some(entry => (
    !isProjectState(entry.from)
    || !(FDE_STAGE_IDS as readonly string[]).includes(entry.to)
    || typeof entry.reason !== 'string'
    || entry.reason.trim() === ''
    || typeof entry.returnedAt !== 'string'
    || !Number.isSafeInteger(entry.revision)
  )))) return false
  return true
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
  if (!isProjectStageValue(value, workspaceId)) throw new Error('项目阶段响应无效。')
  return value
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

/** Submit the FDE's explicit project-development completion against one exact revision. */
export async function completeProjectDevelopment(
  workspaceId: string,
  expectedRevision: number,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await completeStage(
    FDE_STAGE_COMPLETE_DEVELOPMENT_PATH,
    workspaceId,
    expectedRevision,
    '项目开发阶段确认失败。',
    signal,
    fetchImpl,
  )
}

/** Submit the FDE's explicit validation completion against one exact revision. */
export async function completeValidation(
  workspaceId: string,
  expectedRevision: number,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await completeStage(
    FDE_STAGE_COMPLETE_VALIDATION_PATH,
    workspaceId,
    expectedRevision,
    '验证评估阶段确认失败。',
    signal,
    fetchImpl,
  )
}

/** Submit the FDE's explicit deployment-trial completion against one exact revision. */
export async function completeDeploymentTrial(
  workspaceId: string,
  expectedRevision: number,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await completeStage(
    FDE_STAGE_COMPLETE_PILOT_PATH,
    workspaceId,
    expectedRevision,
    '部署试运行阶段确认失败。',
    signal,
    fetchImpl,
  )
}

/** Submit the FDE's explicit project completion against one exact revision. */
export async function completeAcceptanceHandover(
  workspaceId: string,
  expectedRevision: number,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await completeStage(
    FDE_STAGE_COMPLETE_HANDOFF_PATH,
    workspaceId,
    expectedRevision,
    '验收移交阶段确认失败。',
    signal,
    fetchImpl,
  )
}

/** Return the project by exactly one stage after the FDE supplies a reason. */
export async function returnProjectStage(
  workspaceId: string,
  expectedRevision: number,
  reason: string,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await submitStage(
    FDE_STAGE_RETURN_PATH,
    workspaceId,
    { expectedRevision, reason },
    '项目阶段返回失败。',
    '阶段返回响应无效。',
    signal,
    fetchImpl,
  )
}

/** Submit one explicit FDE decision for the authoritative V2 stage. */
export async function completeV2ProjectStage(
  workspaceId: string,
  expectedRevision: number,
  stage: FdeV2StageId,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await submitStage(
    FDE_V2_STAGE_COMPLETE_PATH,
    workspaceId,
    { expectedRevision, stage },
    '当前阶段确认失败。',
    '阶段确认响应无效。',
    signal,
    fetchImpl,
  )
}

/** Return the authoritative V2 lifecycle by exactly one stage. */
export async function returnV2ProjectStage(
  workspaceId: string,
  expectedRevision: number,
  reason: string,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  return await submitStage(
    FDE_V2_STAGE_RETURN_PATH,
    workspaceId,
    { expectedRevision, reason },
    '当前阶段返回失败。',
    '阶段返回响应无效。',
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
  return await submitStage(
    path,
    workspaceId,
    { expectedRevision },
    failureMessage,
    '阶段确认响应无效。',
    signal,
    fetchImpl,
  )
}

async function submitStage(
  path: string,
  workspaceId: string,
  body: Readonly<Record<string, unknown>>,
  failureMessage: string,
  invalidResponseMessage: string,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<ProjectStageValue> {
  const request = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))
  const response = await request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, ...body }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error(invalidResponseMessage) }
  const result = payload as {
    readonly ok?: unknown
    readonly value?: Partial<ProjectStageValue>
    readonly error?: { readonly message?: string }
  }
  if (!response.ok || result.ok !== true) throw new Error(result.error?.message ?? failureMessage)
  const value = result.value
  if (!isProjectStageValue(value, workspaceId)) throw new Error(invalidResponseMessage)
  return value
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

  /** Complete project development without hiding the currently displayed stage. */
  async completeDevelopment(workspaceId: string, expectedRevision: number): Promise<void> {
    await this.complete(workspaceId, expectedRevision, completeProjectDevelopment)
  }

  /** Complete validation without hiding the currently displayed stage. */
  async completeValidation(workspaceId: string, expectedRevision: number): Promise<void> {
    await this.complete(workspaceId, expectedRevision, completeValidation)
  }

  /** Complete deployment trial without hiding the currently displayed stage. */
  async completePilot(workspaceId: string, expectedRevision: number): Promise<void> {
    await this.complete(workspaceId, expectedRevision, completeDeploymentTrial)
  }

  /** Complete acceptance handover and publish the terminal project state. */
  async completeHandoff(workspaceId: string, expectedRevision: number): Promise<void> {
    await this.complete(workspaceId, expectedRevision, completeAcceptanceHandover)
  }

  /** Complete one authoritative V2 stage without inventing a target stage in the browser. */
  async completeV2(workspaceId: string, expectedRevision: number, stage: FdeV2StageId): Promise<void> {
    await this.complete(
      workspaceId,
      expectedRevision,
      async (id, revision, signal) => await completeV2ProjectStage(id, revision, stage, signal),
    )
  }

  /** Return one authoritative V2 stage and retain all project evidence. */
  async returnV2(workspaceId: string, expectedRevision: number, reason: string): Promise<void> {
    await this.complete(
      workspaceId,
      expectedRevision,
      async (id, revision, signal) => await returnV2ProjectStage(id, revision, reason, signal),
    )
  }

  /** Return exactly one stage and publish the durable audit-bearing record. */
  async returnToPrevious(workspaceId: string, expectedRevision: number, reason: string): Promise<void> {
    await this.complete(
      workspaceId,
      expectedRevision,
      async (id, revision, signal) => await returnProjectStage(id, revision, reason, signal),
    )
  }

  private async complete(
    workspaceId: string,
    expectedRevision: number,
    operation: (workspaceId: string, expectedRevision: number, signal?: AbortSignal) => Promise<ProjectStageValue>,
  ): Promise<void> {
    if (this.disposed) throw new Error('项目管理已关闭。')
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

/** Host-backed project snapshot controller shared by the four project views. */

/** Exact Host route owned by `@deepseek-ai/dsh-fde-project`. */
export const FDE_PROJECT_SNAPSHOT_PATH = '/api/fde-project/snapshot'
/** Exact Host route for confirming one architecture revision. */
export const FDE_ARCHITECTURE_CONFIRM_PATH = '/api/fde-project/architecture/confirm'
/** Exact Host route for confirming one validation contract. */
export const FDE_VALIDATION_PLAN_CONFIRM_PATH = '/api/fde-project/validation/confirm-plan'
/** Exact Host route for manually accepting one required validation metric. */
export const FDE_VALIDATION_METRIC_ACCEPT_PATH = '/api/fde-project/validation/accept-metric'
/** Exact Host route for manually accepting one validation issue. */
export const FDE_VALIDATION_ISSUE_WAIVE_PATH = '/api/fde-project/validation/waive-issue'
/** Exact Host route for manually accepting one deployment-trial issue. */
export const FDE_DEPLOYMENT_TRIAL_ISSUE_ACCEPT_PATH = '/api/fde-project/pilot/accept-issue'
/** Exact Host route for confirming the current deployment-trial target and readiness. */
export const FDE_DEPLOYMENT_TRIAL_READINESS_CONFIRM_PATH = '/api/fde-project/pilot/confirm-readiness'
/** Exact Host route for recording the current acceptance and responsibility-transfer facts. */
export const FDE_ACCEPTANCE_HANDOVER_DECISION_PATH = '/api/fde-project/handoff/record-decision'
/** Exact Host route for approving one indexed evaluation report. */
export const FDE_EVALUATION_BASELINE_PATH = '/api/fde-project/evaluation/baseline'
/** Exact Host route for beginning one Agent-driven project start. */
export const FDE_PROJECT_RUNTIME_START_PATH = '/api/fde-project/runtime/start'
/** Exact Host route for beginning one Agent-driven project stop. */
export const FDE_PROJECT_RUNTIME_STOP_PATH = '/api/fde-project/runtime/stop'
/** Exact Host route for settling an operation whose Agent prompt was not queued. */
export const FDE_PROJECT_RUNTIME_ABANDON_PATH = '/api/fde-project/runtime/abandon'

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

/** Browser wire value for one Workspace-scoped project runtime fact. */
export interface ProjectRuntimeSnapshot {
  readonly schemaVersion: 1
  readonly revision: number
  readonly status: 'stopped' | 'starting' | 'running' | 'stopping' | 'blocked'
  readonly updatedAt: string
  readonly action?: 'start' | 'stop'
  readonly operationId?: string
  readonly sessionId?: string
  readonly message?: string
  readonly previewUrl?: string
  readonly docsUrl?: string
  readonly openapiSource?: string
  readonly baseUrl?: string
  readonly terminalTitle?: string
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

/** Project-specific validation metric categories accepted by the Host contract. */
export type ValidationMetricCategory = 'business' | 'functional' | 'data' | 'model' | 'performance' | 'security' | 'recovery' | 'agent'
/** Evidence-backed validation result. */
export type ValidationMetricStatus = 'PASS' | 'WARN' | 'FAIL' | 'NOT_RUN'

/** Browser wire value for the validation contract, evidence, and fixed outputs. */
export interface ValidationStageSnapshot {
  readonly contract: {
    readonly status: 'missing' | 'invalid' | 'ready'
    readonly path: string
    readonly digest?: string
    readonly candidateId?: string
    readonly candidateDescription?: string
    readonly candidateSource?: string
    readonly environment?: string
    readonly datasets: readonly {
      readonly id: string
      readonly name: string
      readonly version?: string
      readonly source?: string
      readonly hash?: string
    }[]
    readonly metrics: readonly {
      readonly id: string
      readonly name: string
      readonly category: ValidationMetricCategory
      readonly method: string
      readonly threshold: string
      readonly sources: readonly {
        readonly path: string
        readonly references: readonly string[]
        readonly available: boolean
        readonly digest?: string
      }[]
      readonly required: boolean
      readonly status: ValidationMetricStatus
      readonly value?: string
      readonly evidence?: string
      readonly evidenceAvailable: boolean
      readonly waiverReason?: string
      readonly manualAcceptance?: {
        readonly reason: string
        readonly acceptedAt: string
      }
      readonly note?: string
    }[]
    readonly issues: readonly {
      readonly id: string
      readonly title: string
      readonly severity: 'critical' | 'high' | 'medium' | 'low'
      readonly status: 'open' | 'resolved' | 'waived'
      readonly evidence?: string
      readonly evidenceAvailable: boolean
      readonly resolution?: string
      readonly waiverReason?: string
      readonly waivedAt?: string
    }[]
    readonly message?: string
  }
  readonly artifacts: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly items: readonly {
      readonly id: 'validation-plan' | 'validation-report' | 'validation-baseline'
      readonly title: string
      readonly path: string
      readonly status: 'missing' | 'present' | 'error'
      readonly bytes?: number
      readonly updatedAt?: string
      readonly fileUrl?: string
      readonly message?: string
    }[]
  }
  readonly planReady: boolean
  readonly planBlockers: readonly string[]
  readonly planApproval: {
    readonly status: 'unavailable' | 'pending' | 'confirmed' | 'stale'
    readonly contractDigest?: string
    readonly confirmedAt?: string
    readonly message?: string
  }
  readonly requiredMetricCount: number
  readonly satisfiedMetricCount: number
  readonly gateReady: boolean
  readonly blockers: readonly string[]
}

/** One fixed Markdown output from deployment trial or acceptance handover. */
export interface DeliveryCloseoutArtifact {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
}

/** Browser wire value for deployment-trial facts and completion readiness. */
export interface DeploymentTrialStageSnapshot {
  readonly contract: {
    readonly status: 'missing' | 'invalid' | 'ready'
    readonly path: string
    readonly digest?: string
    readonly candidateVersion?: string
    readonly environment?: { readonly name: string; readonly summary: string; readonly authorized: boolean }
    readonly deploymentStatus?: 'preparing' | 'deploying' | 'running' | 'blocked' | 'ready'
    readonly evidence: Readonly<Record<'validationBaseline' | 'deployment' | 'health' | 'rollback' | 'trial', {
      readonly path?: string
      readonly available: boolean
    }>>
    readonly issues: readonly {
      readonly id: string
      readonly title: string
      readonly severity: 'critical' | 'high' | 'medium' | 'low'
      readonly status: 'open' | 'resolved' | 'accepted' | 'deferred'
      readonly evidence?: string
      readonly evidenceAvailable: boolean
      readonly resolution?: string
      readonly decisionReason?: string
      readonly owner?: string
    }[]
    readonly message?: string
  }
  readonly artifacts: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly items: readonly DeliveryCloseoutArtifact[]
  }
  readonly confirmationReady: boolean
  readonly confirmationBlockers: readonly string[]
  readonly gateReady: boolean
  readonly blockers: readonly string[]
}

/** Browser wire value for final acceptance, handover, and project-completion readiness. */
export interface AcceptanceHandoverStageSnapshot {
  readonly contract: {
    readonly status: 'missing' | 'invalid' | 'ready'
    readonly path: string
    readonly digest?: string
    readonly finalVersion?: string
    readonly deploymentTrialBaseline: { readonly path?: string; readonly available: boolean }
    readonly acceptance?: {
      readonly status: 'pending' | 'accepted' | 'conditionally-accepted' | 'returned' | 'terminated'
      readonly summary: string
      readonly evidence: readonly { readonly path?: string; readonly available: boolean }[]
    }
    readonly deliverables: readonly {
      readonly id: string
      readonly name: string
      readonly location: string
      readonly version?: string
      readonly checksum?: string
      readonly available: boolean
      readonly locationType: 'project-file' | 'external'
    }[]
    readonly conditions: readonly {
      readonly id: string
      readonly title: string
      readonly status: 'open' | 'resolved' | 'accepted'
      readonly reason?: string
      readonly owner?: string
      readonly followUp?: string
    }[]
    readonly handover?: {
      readonly trainingCompleted: boolean
      readonly accessResponsibilityTransferred: boolean
      readonly operationsResponsibilityTransferred: boolean
      readonly evidence: readonly { readonly path?: string; readonly available: boolean }[]
    }
    readonly message?: string
  }
  readonly artifacts: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly items: readonly DeliveryCloseoutArtifact[]
  }
  readonly gateReady: boolean
  readonly blockers: readonly string[]
}

/** Editable FDE decision fields for one exact acceptance-handover contract. */
export interface AcceptanceHandoverDecision {
  readonly acceptance: {
    readonly status: 'pending' | 'accepted' | 'conditionally-accepted' | 'returned' | 'terminated'
    readonly summary: string
    readonly evidence: readonly string[]
  }
  readonly deliverables: readonly { readonly id: string; readonly available: boolean }[]
  readonly conditions: readonly {
    readonly id: string
    readonly status: 'open' | 'resolved' | 'accepted'
    readonly reason?: string
    readonly owner?: string
    readonly followUp?: string
  }[]
  readonly handover: {
    readonly trainingCompleted: boolean
    readonly accessResponsibilityTransferred: boolean
    readonly operationsResponsibilityTransferred: boolean
    readonly evidence: readonly string[]
  }
}

/** One project-level read model returned by the trusted Host route. */
export interface ProjectSurfaceSnapshot {
  readonly workspaceId: string
  readonly title: string
  readonly runtime: ProjectRuntimeSnapshot
  readonly apiDocs: ApiDocsSnapshot
  readonly architecture: ProjectArchitecture | null
  readonly architectureError?: string
  readonly evaluation: {
    readonly casesCount: number
    readonly reports: readonly EvaluationReportSummary[]
    readonly baseline?: EvaluationReportSummary
    readonly message?: string
  }
  readonly validation: ValidationStageSnapshot
  readonly deploymentTrial: DeploymentTrialStageSnapshot
  readonly acceptanceHandover: AcceptanceHandoverStageSnapshot
  readonly requirements: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly artifacts: readonly {
      readonly id: 'research-report' | 'confirmation-checklist' | 'requirement-baseline'
      readonly title: string
      readonly path: string
      readonly status: 'missing' | 'present' | 'error'
      readonly bytes?: number
      readonly updatedAt?: string
      readonly fileUrl?: string
      readonly message?: string
    }[]
  }
  readonly solution?: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly artifacts: readonly {
      readonly id: 'project-prd' | 'solution-design' | 'development-plan' | 'acceptance-plan' | 'solution-baseline'
      readonly title: string
      readonly path: string
      readonly status: 'missing' | 'present' | 'error'
      readonly bytes?: number
      readonly updatedAt?: string
      readonly fileUrl?: string
      readonly message?: string
    }[]
  }
  readonly development?: {
    readonly root: string
    readonly core: {
      readonly requiredCount: number
      readonly presentCount: number
      readonly artifacts: readonly DevelopmentArtifact[]
    }
    readonly features: readonly {
      readonly id: string
      readonly title: string
      readonly directory: string
      readonly status: string
      readonly plannedStart?: string
      readonly plannedEnd?: string
      readonly milestone?: string
      readonly blocker?: string
      readonly taskTotal: number
      readonly taskCompleted: number
      readonly artifacts: readonly DevelopmentArtifact[]
    }[]
    readonly closure: {
      readonly root: string
      readonly requiredCount: number
      readonly presentCount: number
      readonly artifacts: readonly DevelopmentArtifact[]
    }
    readonly issues: readonly string[]
  }
}

/** One browser-safe Markdown document indexed by the project Host. */
export interface DevelopmentArtifact {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly kind: 'core' | 'feature' | 'closure'
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
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

/** Confirm the exact validation contract currently displayed to the FDE. */
export async function confirmValidationPlan(
  workspaceId: string,
  contractDigest: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_VALIDATION_PLAN_CONFIRM_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, contractDigest }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('评估方案确认响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `评估方案确认失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Manually accept one unmet required metric for the exact displayed contract. */
export async function acceptValidationMetric(
  workspaceId: string,
  contractDigest: string,
  metricId: string,
  reason: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_VALIDATION_METRIC_ACCEPT_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, contractDigest, metricId, reason }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('人工接受验证指标响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `人工接受验证指标失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Manually accept one open validation issue for the exact displayed contract. */
export async function waiveValidationIssue(
  workspaceId: string,
  contractDigest: string,
  issueId: string,
  reason: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_VALIDATION_ISSUE_WAIVE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, contractDigest, issueId, reason }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('人工关闭验证问题响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `人工关闭验证问题失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Manually accept one unresolved deployment-trial issue for the exact displayed contract. */
export async function acceptDeploymentTrialIssue(
  workspaceId: string,
  contractDigest: string,
  issueId: string,
  reason: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_DEPLOYMENT_TRIAL_ISSUE_ACCEPT_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, contractDigest, issueId, reason }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('人工接受试运行问题响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `人工接受试运行问题失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Confirm the exact displayed deployment-trial target environment and readiness conclusion. */
export async function confirmDeploymentTrialReadiness(
  workspaceId: string,
  contractDigest: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_DEPLOYMENT_TRIAL_READINESS_CONFIRM_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, contractDigest }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('确认部署试运行结论响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `确认部署试运行结论失败（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Record evidence-backed acceptance and handover facts for the exact displayed contract. */
export async function recordAcceptanceHandoverDecision(
  workspaceId: string,
  contractDigest: string,
  decision: AcceptanceHandoverDecision,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(FDE_ACCEPTANCE_HANDOVER_DECISION_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, contractDigest, decision }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('记录验收移交事实响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `记录验收移交事实失败（HTTP ${String(response.status)}）。`)
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

async function changeProjectRuntime(
  path: string,
  workspaceId: string,
  body: Readonly<Record<string, unknown>>,
  failureMessage: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  const response = await fetchImpl(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, ...body }),
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('项目运行响应无效。') }
  if (!response.ok) {
    const failure = payload as SnapshotFailure
    throw new Error(failure.error?.message ?? `${failureMessage}（HTTP ${String(response.status)}）。`)
  }
  return parseSnapshot(payload, workspaceId)
}

/** Begin one exact project start operation. */
export async function startProjectRuntime(
  workspaceId: string,
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  return await changeProjectRuntime(
    FDE_PROJECT_RUNTIME_START_PATH, workspaceId, { sessionId }, '项目启动请求失败', fetchImpl, signal,
  )
}

/** Begin one exact project stop operation. */
export async function stopProjectRuntime(
  workspaceId: string,
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  return await changeProjectRuntime(
    FDE_PROJECT_RUNTIME_STOP_PATH, workspaceId, { sessionId }, '项目停止请求失败', fetchImpl, signal,
  )
}

/** Settle an operation when its visible Agent prompt could not be queued. */
export async function abandonProjectRuntime(
  workspaceId: string,
  operationId: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSurfaceSnapshot> {
  return await changeProjectRuntime(
    FDE_PROJECT_RUNTIME_ABANDON_PATH, workspaceId, { operationId, message }, '项目运行恢复失败', fetchImpl, signal,
  )
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

  /** Refresh one running operation without replacing the visible snapshot with a loading card. */
  poll(workspaceId: string): void {
    if (this.disposed || this.requests.has(workspaceId)) return
    this.start(workspaceId, true)
  }

  /** Begin a project start and publish the returned starting record. */
  async startRuntime(workspaceId: string, sessionId: string): Promise<ProjectRuntimeSnapshot> {
    return await this.runtimeOperation(workspaceId, signal => startProjectRuntime(workspaceId, sessionId, fetch, signal))
  }

  /** Begin a project stop and publish the returned stopping record. */
  async stopRuntime(workspaceId: string, sessionId: string): Promise<ProjectRuntimeSnapshot> {
    return await this.runtimeOperation(workspaceId, signal => stopProjectRuntime(workspaceId, sessionId, fetch, signal))
  }

  /** Settle a runtime operation whose visible Agent prompt was not accepted. */
  async abandonRuntime(workspaceId: string, operationId: string, message: string): Promise<ProjectRuntimeSnapshot> {
    return await this.runtimeOperation(
      workspaceId,
      signal => abandonProjectRuntime(workspaceId, operationId, message, fetch, signal),
    )
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

  /** Confirm one exact validation contract without hiding the current plan. */
  async confirmValidationPlan(workspaceId: string, contractDigest: string): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await confirmValidationPlan(workspaceId, contractDigest, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /** Accept one unmet required metric and publish the refreshed project snapshot. */
  async acceptValidationMetric(
    workspaceId: string,
    contractDigest: string,
    metricId: string,
    reason: string,
  ): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await acceptValidationMetric(workspaceId, contractDigest, metricId, reason, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /** Accept one still-open validation issue and publish the refreshed project snapshot. */
  async waiveValidationIssue(
    workspaceId: string,
    contractDigest: string,
    issueId: string,
    reason: string,
  ): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await waiveValidationIssue(workspaceId, contractDigest, issueId, reason, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /** Accept one unresolved deployment-trial issue and publish the refreshed project snapshot. */
  async acceptDeploymentTrialIssue(
    workspaceId: string,
    contractDigest: string,
    issueId: string,
    reason: string,
  ): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await acceptDeploymentTrialIssue(workspaceId, contractDigest, issueId, reason, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /** Confirm the displayed deployment-trial target and readiness, then publish the refreshed snapshot. */
  async confirmDeploymentTrialReadiness(workspaceId: string, contractDigest: string): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await confirmDeploymentTrialReadiness(workspaceId, contractDigest, fetch, controller.signal)
      if (this.canPublish(workspaceId, controller)) {
        this.publish(workspaceId, { status: 'ready', value })
      }
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  /** Record acceptance and responsibility-transfer facts, then publish the refreshed snapshot. */
  async recordAcceptanceHandoverDecision(
    workspaceId: string,
    contractDigest: string,
    decision: AcceptanceHandoverDecision,
  ): Promise<void> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await recordAcceptanceHandoverDecision(workspaceId, contractDigest, decision, fetch, controller.signal)
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

  private async runtimeOperation(
    workspaceId: string,
    operation: (signal: AbortSignal) => Promise<ProjectSurfaceSnapshot>,
  ): Promise<ProjectRuntimeSnapshot> {
    if (this.disposed) throw new Error('项目页面已关闭。')
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    try {
      const value = await operation(controller.signal)
      if (!this.canPublish(workspaceId, controller)) throw new Error('项目运行操作已被新的请求替代。')
      this.publish(workspaceId, { status: 'ready', value })
      return value.runtime
    } finally {
      if (this.requests.get(workspaceId) === controller) this.requests.delete(workspaceId)
    }
  }

  private start(workspaceId: string, preserve = false): void {
    this.requests.get(workspaceId)?.abort()
    const controller = new AbortController()
    this.requests.set(workspaceId, controller)
    if (!preserve) this.publish(workspaceId, { status: 'loading' })
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

/** Product-facing read models for project delivery surfaces. */

/** Stable architecture statuses used by the project artifact. */
export const ARCHITECTURE_STATUSES = [
  'candidate',
  'pending-confirmation',
  'confirmed',
  'impacted',
  'superseded',
] as const

/** Stable architecture node presentation kinds, adapted from dsh-planchart. */
export const ARCHITECTURE_NODE_KINDS = [
  'default',
  'entry',
  'core',
  'store',
  'external',
  'output',
] as const

/** One durable architecture lifecycle status. */
export type ArchitectureStatus = typeof ARCHITECTURE_STATUSES[number]
/** One controlled architecture node presentation kind. */
export type ArchitectureNodeKind = typeof ARCHITECTURE_NODE_KINDS[number]

/** One named architecture grouping. */
export interface ArchitectureGroup {
  readonly id: string
  readonly label: string
}

/** One validated system component. */
export interface ArchitectureNode {
  readonly id: string
  readonly label: string
  readonly kind: ArchitectureNodeKind
  readonly note?: string
  readonly group?: string
}

/** One directed relationship between existing architecture nodes. */
export interface ArchitectureEdge {
  readonly from: string
  readonly to: string
  readonly label?: string
  readonly dashed?: boolean
}

/** Complete current project architecture document. */
export interface ProjectArchitecture {
  readonly version: 1
  readonly revision: number
  readonly title: string
  readonly summary?: string
  readonly status: ArchitectureStatus
  readonly updatedAt: string
  readonly groups: readonly ArchitectureGroup[]
  readonly nodes: readonly ArchitectureNode[]
  readonly edges: readonly ArchitectureEdge[]
}

/** Project API documentation configuration states safe for browser display. */
export type ApiDocsSnapshot =
  | { readonly status: 'unconfigured'; readonly message: string }
  | {
    readonly status: 'configured'
    readonly docsUrl?: string
    readonly openapiSource?: string
    readonly baseUrl?: string
    readonly allowedMethods: readonly string[]
    readonly allowPrivateNetwork: boolean
  }
  | { readonly status: 'invalid'; readonly message: string }

/** Durable project runtime states shown in every project-delivery view. */
export type ProjectRuntimeStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'blocked'

/** Browser-safe, Workspace-scoped project runtime fact. */
export interface ProjectRuntimeSnapshot {
  readonly schemaVersion: 1
  readonly revision: number
  readonly status: ProjectRuntimeStatus
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

/** One bounded case result projected from an evaluation report. */
export interface EvaluationCaseSummary {
  readonly name: string
  readonly status: string
  readonly failures: readonly string[]
  readonly error?: string
}

/** One bounded persisted evaluation report summary. */
export interface EvaluationReportSummary {
  readonly id: string
  readonly path: string
  readonly updatedAt: string
  readonly status: 'PASS' | 'WARN' | 'FAIL' | 'N/A' | 'UNKNOWN'
  readonly passed: number
  readonly failed: number
  readonly errors: number
  readonly total: number
  readonly cases: readonly EvaluationCaseSummary[]
}

/** Current project's evaluation cases, reports, and optional baseline. */
export interface EvaluationSnapshot {
  readonly casesCount: number
  readonly reports: readonly EvaluationReportSummary[]
  readonly baseline?: EvaluationReportSummary
  readonly message?: string
}

/** Validation dimensions selected per project rather than required globally. */
export const VALIDATION_METRIC_CATEGORIES = [
  'business',
  'functional',
  'data',
  'model',
  'performance',
  'security',
  'recovery',
  'agent',
] as const

/** One project-specific validation dimension. */
export type ValidationMetricCategory = typeof VALIDATION_METRIC_CATEGORIES[number]
/** Current evidence-backed result of one validation metric. */
export type ValidationMetricStatus = 'PASS' | 'WARN' | 'FAIL' | 'NOT_RUN'

/** One project-specific dataset or case collection admitted to validation. */
export interface ValidationDatasetSnapshot {
  readonly id: string
  readonly name: string
  readonly version?: string
  readonly source?: string
  readonly hash?: string
}

/** One prior-stage document reference that justifies a validation metric. */
export interface ValidationMetricSourceSnapshot {
  readonly path: string
  readonly references: readonly string[]
  readonly available: boolean
  readonly digest?: string
}

/** One bounded metric and its current evidence-backed result. */
export interface ValidationMetricSnapshot {
  readonly id: string
  readonly name: string
  readonly category: ValidationMetricCategory
  readonly method: string
  readonly threshold: string
  readonly sources: readonly ValidationMetricSourceSnapshot[]
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
}

/** One validation issue that can block or qualify the current candidate. */
export interface ValidationIssueSnapshot {
  readonly id: string
  readonly title: string
  readonly severity: 'critical' | 'high' | 'medium' | 'low'
  readonly status: 'open' | 'resolved' | 'waived'
  readonly evidence?: string
  readonly evidenceAvailable: boolean
  readonly resolution?: string
  readonly waiverReason?: string
  readonly waivedAt?: string
}

/** Parsed project validation contract or its explicit absence/failure. */
export interface ValidationContractSnapshot {
  readonly status: 'missing' | 'invalid' | 'ready'
  readonly path: string
  readonly digest?: string
  readonly candidateId?: string
  readonly candidateDescription?: string
  readonly candidateSource?: string
  readonly environment?: string
  readonly datasets: readonly ValidationDatasetSnapshot[]
  readonly metrics: readonly ValidationMetricSnapshot[]
  readonly issues: readonly ValidationIssueSnapshot[]
  readonly message?: string
}

/** FDE approval bound to one exact validation contract digest. */
export interface ValidationPlanApprovalSnapshot {
  readonly status: 'unavailable' | 'pending' | 'confirmed' | 'stale'
  readonly contractDigest?: string
  readonly confirmedAt?: string
  readonly message?: string
}

/** One fixed Markdown output of the validation stage. */
export interface ValidationArtifactSnapshot {
  readonly id: 'validation-plan' | 'validation-report' | 'validation-baseline'
  readonly title: string
  readonly path: string
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
}

/** Host-derived validation readiness, evidence, and fixed outputs. */
export interface ValidationStageSnapshot {
  readonly contract: ValidationContractSnapshot
  readonly artifacts: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly items: readonly ValidationArtifactSnapshot[]
  }
  readonly planReady: boolean
  readonly planBlockers: readonly string[]
  readonly planApproval: ValidationPlanApprovalSnapshot
  readonly requiredMetricCount: number
  readonly satisfiedMetricCount: number
  readonly gateReady: boolean
  readonly blockers: readonly string[]
}

/** One required output of the FDE requirement-research stage. */
export interface RequirementArtifactSnapshot {
  readonly id: 'research-report' | 'confirmation-checklist' | 'requirement-baseline'
  readonly title: string
  readonly path: string
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
}

/** Read-only status of the fixed requirement-research outputs. */
export interface RequirementArtifactsSnapshot {
  readonly root: string
  readonly requiredCount: number
  readonly presentCount: number
  readonly artifacts: readonly RequirementArtifactSnapshot[]
}

/** Stable business work identifiers for FDE stage one. */
export type DiscoveryWorkItemId = 'collect-originals' | 'restore-workflow' | 'qualify-value' | 'form-conclusion'

/** One candidate business artifact used by the first-stage workbench. */
export interface DiscoveryStageArtifactSnapshot {
  readonly id: 'research-report' | 'confirmation-checklist' | 'requirement-baseline' | 'engagement-reframe'
  readonly title: string
  readonly path: string
  readonly required: boolean
  readonly purpose: string
  readonly status: 'missing' | 'present' | 'error'
  readonly structureState: 'missing' | 'invalid' | 'starter_valid' | 'complete_valid' | 'not_applicable'
  readonly evidenceState: 'confirmed' | 'inferred' | 'unverified'
  readonly version?: number
  readonly sourceAdapter?: DiscoverySourceAdapterSnapshot
  readonly evidenceRefs: readonly DiscoveryEvidenceReferenceSnapshot[]
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
}

/** Pinned upstream or product-local source used to adapt one stage-one Artifact. */
export interface DiscoverySourceAdapterSnapshot {
  readonly id: string
  readonly version: string
  readonly commit: string
  readonly license: string
  readonly artifact: string
}

/** Confidence carried by one concrete evidence reference. */
export type DiscoveryEvidenceState = 'confirmed' | 'inferred' | 'unverified'

/** Supported evidence origins for one stage-one claim. */
export type DiscoveryEvidenceKind = 'project-file' | 'conversation' | 'interview' | 'observation' | 'system' | 'policy' | 'external'

/** One claim-level reference; aggregate counts are derived from these records. */
export interface DiscoveryEvidenceReferenceSnapshot {
  readonly id: string
  readonly state: DiscoveryEvidenceState
  readonly kind: DiscoveryEvidenceKind
  readonly ref: string
  readonly summary: string
}

/** Human-readable disposition of one persisted candidate workflow. */
export type DiscoveryWorkflowDisposition = 'candidate' | 'selected' | 'deferred' | 'rejected'

/** One real workflow candidate identified during stage-one dialogue. */
export interface DiscoveryWorkflowCandidateSnapshot {
  readonly id: string
  readonly title: string
  readonly actor: string
  readonly trigger: string
  readonly problem: string
  readonly disposition: DiscoveryWorkflowDisposition
  readonly evidence: {
    readonly confirmed: number
    readonly inferred: number
    readonly unverified: number
  }
  readonly evidenceRefs: readonly DiscoveryEvidenceReferenceSnapshot[]
}

/** Honest read state of the persisted stage-one workflow catalog. */
export interface DiscoveryWorkflowCatalogSnapshot {
  readonly path: '.fde/discovery/workflows.json'
  readonly status: 'missing' | 'ready' | 'invalid'
  readonly selectedWorkflowId?: string
  readonly items: readonly DiscoveryWorkflowCandidateSnapshot[]
  readonly message?: string
}

/** One pinned method or engineering Skill available to stage one. */
export interface DiscoveryCapabilitySnapshot {
  readonly skill: string
  readonly layer: 'method' | 'engineering'
  readonly condition: string
  readonly source: DiscoverySourceAdapterSnapshot
}

/** Deterministic method-first route advertised by the trusted Host. */
export interface DiscoveryCapabilityRouteSnapshot {
  readonly primaryMethod: DiscoveryCapabilitySnapshot
  readonly conditionalMethod: DiscoveryCapabilitySnapshot
  readonly engineering: readonly DiscoveryCapabilitySnapshot[]
}

/** Host-derived first-stage business progress; it never advances the project. */
export interface DiscoveryStageSnapshot {
  readonly question: string
  readonly status: 'collecting' | 'understanding' | 'qualifying' | 'ready-for-review'
  readonly currentWorkId: DiscoveryWorkItemId
  readonly workItems: readonly {
    readonly id: DiscoveryWorkItemId
    readonly title: string
    readonly purpose: string
    readonly status: 'complete' | 'current' | 'waiting'
  }[]
  readonly workflows: DiscoveryWorkflowCatalogSnapshot
  readonly route: DiscoveryCapabilityRouteSnapshot
  readonly artifacts: readonly DiscoveryStageArtifactSnapshot[]
  readonly requiredCount: number
  readonly presentCount: number
  readonly reviewReady: boolean
  readonly blockers: readonly string[]
}

/** One required Markdown output of the FDE solution-design stage. */
export interface SolutionArtifactSnapshot {
  readonly id: 'project-prd' | 'solution-design' | 'development-plan' | 'acceptance-plan' | 'solution-baseline'
  readonly title: string
  readonly path: string
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
}

/** Read-only status of the fixed solution-design Markdown outputs. */
export interface SolutionArtifactsSnapshot {
  readonly root: string
  readonly requiredCount: number
  readonly presentCount: number
  readonly artifacts: readonly SolutionArtifactSnapshot[]
}

/** One Host-indexed Markdown document used by project-development progress. */
export interface DevelopmentArtifactSnapshot {
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

/** One Feature directory and its deterministic Markdown task progress. */
export interface DevelopmentFeatureSnapshot {
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
  readonly artifacts: readonly DevelopmentArtifactSnapshot[]
}

/** Read-only project-development docs and fixed close-out outputs. */
export interface DevelopmentDocsSnapshot {
  readonly root: string
  readonly core: {
    readonly requiredCount: number
    readonly presentCount: number
    readonly artifacts: readonly DevelopmentArtifactSnapshot[]
  }
  readonly features: readonly DevelopmentFeatureSnapshot[]
  readonly closure: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly artifacts: readonly DevelopmentArtifactSnapshot[]
  }
  readonly issues: readonly string[]
}

/** One fixed Markdown output of the final two delivery stages. */
export interface DeliveryCloseoutArtifactSnapshot {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly fileUrl?: string
  readonly message?: string
}

/** One project-relative evidence reference and its current filesystem status. */
export interface DeliveryEvidenceSnapshot {
  readonly path?: string
  readonly available: boolean
}

/** One issue found while the candidate is running in the target environment. */
export interface DeploymentTrialIssueSnapshot {
  readonly id: string
  readonly title: string
  readonly severity: 'critical' | 'high' | 'medium' | 'low'
  readonly status: 'open' | 'resolved' | 'accepted' | 'deferred'
  readonly evidence?: string
  readonly evidenceAvailable: boolean
  readonly resolution?: string
  readonly decisionReason?: string
  readonly owner?: string
}

/** Parsed deployment-trial contract or its explicit absence/failure. */
export interface DeploymentTrialContractSnapshot {
  readonly status: 'missing' | 'invalid' | 'ready'
  readonly path: string
  readonly digest?: string
  readonly candidateVersion?: string
  readonly environment?: {
    readonly name: string
    readonly summary: string
    readonly authorized: boolean
  }
  readonly deploymentStatus?: 'preparing' | 'deploying' | 'running' | 'blocked' | 'ready'
  readonly evidence: {
    readonly validationBaseline: DeliveryEvidenceSnapshot
    readonly deployment: DeliveryEvidenceSnapshot
    readonly health: DeliveryEvidenceSnapshot
    readonly rollback: DeliveryEvidenceSnapshot
    readonly trial: DeliveryEvidenceSnapshot
  }
  readonly issues: readonly DeploymentTrialIssueSnapshot[]
  readonly message?: string
}

/** Host-derived deployment-trial readiness and fixed outputs. */
export interface DeploymentTrialStageSnapshot {
  readonly contract: DeploymentTrialContractSnapshot
  readonly artifacts: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly items: readonly DeliveryCloseoutArtifactSnapshot[]
  }
  readonly confirmationReady: boolean
  readonly confirmationBlockers: readonly string[]
  readonly gateReady: boolean
  readonly blockers: readonly string[]
}

/** One final deliverable indexed without uploading or probing external storage. */
export interface AcceptanceDeliverableSnapshot {
  readonly id: string
  readonly name: string
  readonly location: string
  readonly version?: string
  readonly checksum?: string
  readonly available: boolean
  readonly locationType: 'project-file' | 'external'
}

/** One unresolved, resolved, or explicitly accepted acceptance condition. */
export interface AcceptanceConditionSnapshot {
  readonly id: string
  readonly title: string
  readonly status: 'open' | 'resolved' | 'accepted'
  readonly reason?: string
  readonly owner?: string
  readonly followUp?: string
}

/** Parsed acceptance-handover contract or its explicit absence/failure. */
export interface AcceptanceHandoverContractSnapshot {
  readonly status: 'missing' | 'invalid' | 'ready'
  readonly path: string
  readonly digest?: string
  readonly finalVersion?: string
  readonly deploymentTrialBaseline: DeliveryEvidenceSnapshot
  readonly acceptance?: {
    readonly status: 'pending' | 'accepted' | 'conditionally-accepted' | 'returned' | 'terminated'
    readonly summary: string
    readonly evidence: readonly DeliveryEvidenceSnapshot[]
  }
  readonly deliverables: readonly AcceptanceDeliverableSnapshot[]
  readonly conditions: readonly AcceptanceConditionSnapshot[]
  readonly handover?: {
    readonly trainingCompleted: boolean
    readonly accessResponsibilityTransferred: boolean
    readonly operationsResponsibilityTransferred: boolean
    readonly evidence: readonly DeliveryEvidenceSnapshot[]
  }
  readonly message?: string
}

/** FDE-authored mutable decisions for one exact acceptance-handover contract. */
export interface AcceptanceHandoverDecision {
  readonly acceptance: {
    readonly status: 'pending' | 'accepted' | 'conditionally-accepted' | 'returned' | 'terminated'
    readonly summary: string
    readonly evidence: readonly string[]
  }
  readonly deliverables: readonly {
    readonly id: string
    readonly available: boolean
  }[]
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

/** Host-derived final acceptance/handover readiness and fixed outputs. */
export interface AcceptanceHandoverStageSnapshot {
  readonly contract: AcceptanceHandoverContractSnapshot
  readonly artifacts: {
    readonly root: string
    readonly requiredCount: number
    readonly presentCount: number
    readonly items: readonly DeliveryCloseoutArtifactSnapshot[]
  }
  readonly gateReady: boolean
  readonly blockers: readonly string[]
}

/** One V2 lifecycle stage supported by the guided project workbench. */
export type V2LifecycleStageId = 'definition' | 'investigation' | 'design' | 'evaluation' | 'pilot' | 'production' | 'improvement'

/** One fixed V2 stage output read from the current project. */
export interface V2StageArtifactSnapshot {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly purpose: string
  readonly required: boolean
  readonly status: 'missing' | 'present' | 'error'
  readonly bytes?: number
  readonly updatedAt?: string
  readonly message?: string
}

/** Host-derived business state for one post-discovery V2 stage. */
export interface V2StageSurfaceSnapshot {
  readonly id: V2LifecycleStageId
  readonly index: number
  readonly title: string
  readonly objective: string
  readonly explanation: string
  readonly statePath: string
  readonly stateStatus: 'missing' | 'ready' | 'invalid'
  readonly status: 'working' | 'review-ready' | 'blocked'
  readonly currentWorkId: string
  readonly workItems: readonly {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly status: 'complete' | 'current' | 'waiting' | 'blocked'
  }[]
  readonly blockers: readonly {
    readonly id: string
    readonly title: string
    readonly severity: 'low' | 'medium' | 'high' | 'critical'
    readonly status: 'open' | 'resolved'
  }[]
  readonly recommendation: 'go' | 'revise' | 'narrow' | 'stop' | 'pending'
  readonly artifacts: readonly V2StageArtifactSnapshot[]
  readonly requiredCount: number
  readonly presentCount: number
  readonly reviewReady: boolean
  readonly reviewBlockers: readonly string[]
  readonly prompt: string
  readonly skill: string
  readonly message?: string
}

/** Combined read model for project delivery views and Project Detail. */
export interface ProjectSurfaceSnapshot {
  readonly workspaceId: string
  readonly title: string
  readonly runtime: ProjectRuntimeSnapshot
  readonly apiDocs: ApiDocsSnapshot
  readonly architecture: ProjectArchitecture | null
  readonly architectureError?: string
  readonly evaluation: EvaluationSnapshot
  readonly validation: ValidationStageSnapshot
  readonly requirements: RequirementArtifactsSnapshot
  readonly discovery: DiscoveryStageSnapshot
  readonly solution: SolutionArtifactsSnapshot
  readonly development: DevelopmentDocsSnapshot
  readonly deploymentTrial: DeploymentTrialStageSnapshot
  readonly acceptanceHandover: AcceptanceHandoverStageSnapshot
  readonly v2Stages: Readonly<Record<V2LifecycleStageId, V2StageSurfaceSnapshot>>
}

/** Host-only API configuration consumed by the project-scoped OpenAPI adapter. */
export interface ProjectOpenApiConfig {
  readonly id: 'project'
  readonly source: string
  readonly baseUrl?: string
  readonly headers: Readonly<Record<string, string>>
  readonly credentials: readonly {
    readonly header: string
    readonly env: string
    readonly prefix: string
  }[]
  readonly allowedMethods: readonly string[]
  readonly allowPrivateNetwork: boolean
}

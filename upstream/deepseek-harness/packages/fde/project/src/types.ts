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

/** Combined read model for the four project delivery views. */
export interface ProjectSurfaceSnapshot {
  readonly workspaceId: string
  readonly title: string
  readonly apiDocs: ApiDocsSnapshot
  readonly architecture: ProjectArchitecture | null
  readonly architectureError?: string
  readonly evaluation: EvaluationSnapshot
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

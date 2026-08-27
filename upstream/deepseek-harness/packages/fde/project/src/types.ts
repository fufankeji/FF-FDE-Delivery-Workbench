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

/** Controlled requirement-Wiki topics shared by Agent validation and Galaxy View. */
export const REQUIREMENT_WIKI_TOPICS = [
  'business-goal',
  'role',
  'process',
  'system-data',
  'rule',
  'constraint',
  'acceptance',
  'risk',
  'conflict',
  'unknown',
] as const

/** Controlled relation meanings shared by Agent validation and Galaxy View. */
export const REQUIREMENT_WIKI_RELATIONS = [
  'depends-on',
  'part-of',
  'uses',
  'produces',
  'constrains',
  'conflicts-with',
  'validates',
  'relates-to',
] as const

/** One bounded Wiki topic. */
export type RequirementWikiTopic = typeof REQUIREMENT_WIKI_TOPICS[number]
/** One bounded Wiki relation meaning. */
export type RequirementWikiRelationType = typeof REQUIREMENT_WIKI_RELATIONS[number]

/** Exact local derivative admitted to one Wiki build. */
export interface RequirementWikiSource {
  readonly sourceId: string
  readonly storedName: string
  readonly relativePath: string
  readonly derivedPath: string
  readonly bytes: number
  readonly mtimeMs: number
  readonly parser: string
  readonly parserVersion: string
}

/** One traceable candidate knowledge page. */
export interface RequirementWikiPage {
  readonly id: string
  readonly topic: RequirementWikiTopic
  readonly title: string
  readonly summary?: string
  readonly body: string
  readonly sourceIds: readonly string[]
}

/** One traceable relation between pages in the same Wiki revision. */
export interface RequirementWikiRelation {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly type: RequirementWikiRelationType
  readonly label?: string
  readonly directed: boolean
  readonly sourceIds: readonly string[]
}

/** One candidate conflict or unknown that remains outside confirmed facts. */
export interface RequirementWikiIssue {
  readonly id: string
  readonly title: string
  readonly detail: string
  readonly impact?: string
  readonly pageIds: readonly string[]
  readonly sourceIds: readonly string[]
}

/** Complete immutable candidate Wiki revision. */
export interface RequirementWikiVersion {
  readonly schemaVersion: 1
  readonly revision: number
  readonly buildId: string
  readonly generatedAt: string
  readonly generatedBy: string
  readonly sourceCatalogFingerprint: string
  readonly sources: readonly RequirementWikiSource[]
  readonly pages: readonly RequirementWikiPage[]
  readonly relations: readonly RequirementWikiRelation[]
  readonly conflicts: readonly RequirementWikiIssue[]
  readonly unknowns: readonly RequirementWikiIssue[]
}

/** Durable lifecycle of the latest explicit Wiki build. */
export interface RequirementWikiBuild {
  readonly schemaVersion: 1
  readonly id: string
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly expectedRevision: number
  readonly sourceCatalogFingerprint: string
  readonly sources: readonly RequirementWikiSource[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly message?: string
  readonly publishedRevision?: number
}

/** Project-level requirement Wiki state presented by the trusted Host route. */
export interface RequirementWikiSnapshot {
  readonly status: 'absent' | 'ready' | 'stale'
  readonly current: RequirementWikiVersion | null
  readonly build: RequirementWikiBuild | null
  readonly message?: string
}

/** Combined read model for project delivery views and the requirement Wiki. */
export interface ProjectSurfaceSnapshot {
  readonly workspaceId: string
  readonly title: string
  readonly apiDocs: ApiDocsSnapshot
  readonly architecture: ProjectArchitecture | null
  readonly architectureError?: string
  readonly evaluation: EvaluationSnapshot
  readonly requirementWiki: RequirementWikiSnapshot
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

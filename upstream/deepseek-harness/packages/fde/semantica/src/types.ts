/** Durable contracts owned by the project-scoped Semantica provider. */

export type DesignExecutionMechanism = 'manual' | 'rules' | 'software' | 'retrieval' | 'model' | 'agent' | 'hybrid'
export type DesignSemanticMode = 'schema' | 'ontology'
export type SemanticConclusion = 'pending' | 'not_required' | 'validated' | 'validation_failed' | 'insufficient_evidence'
export type DefinitionStatus = 'missing' | 'draft' | 'review' | 'published' | 'stale'
export type ProviderRunKind = 'extract' | 'propose-schema' | 'publish-schema' | 'build' | 'validate' | 'context' | 'slice'
export type ProviderRunStatus = 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'stale'
export type FdeDesignDecisionOutcome = 'go' | 'revise' | 'narrow' | 'stop'

export interface DesignRouteInput {
  readonly execution: {
    readonly mechanism: DesignExecutionMechanism
    readonly label: string
    readonly rationale: string
  }
  readonly semantics: {
    readonly mode: DesignSemanticMode
    readonly rationale: string
  }
}

export interface SemanticSourceBinding {
  readonly sourceId: string
  readonly name: string
  readonly relativePath: string
  readonly contentPath: string
  readonly digest: string
  readonly bytes: number
  readonly modifiedAt: string
  readonly parseStatus: string
  readonly permissionScope: string
  readonly authority: 'primary' | 'supporting'
  readonly boundAt: string
}

export interface SemanticPropertyDefinition {
  readonly id: string
  readonly label: string
  readonly dataType: 'string' | 'number' | 'boolean' | 'date' | 'datetime'
  readonly required: boolean
  readonly unique: boolean
}

export interface SemanticFieldMappingDefinition {
  readonly sourceField: string
  readonly targetProperty: string
}

export interface SemanticClassDefinition {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly aliases: readonly string[]
  readonly identityKeys: readonly string[]
  readonly properties: readonly SemanticPropertyDefinition[]
  readonly fieldMappings: readonly SemanticFieldMappingDefinition[]
  readonly extractionPatterns: readonly string[]
}

export interface SemanticRelationshipDefinition {
  readonly id: string
  readonly label: string
  readonly domain: string
  readonly range: string
  readonly description?: string
  readonly cardinality: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
  readonly extractionPatterns: readonly string[]
}

export interface CompetencyQuestionDefinition {
  readonly id: string
  readonly text: string
  readonly required: boolean
  readonly query: {
    readonly kind: 'lookup' | 'edge' | 'path'
    readonly sourceType?: string
    readonly relationshipType?: string
    readonly targetType?: string
    readonly maxDepth: number
    readonly minAnswers: number
  }
}

export interface SemanticRuleDefinition {
  readonly id: string
  readonly label: string
  readonly description: string
}

export interface SemanticDefinition {
  readonly status: DefinitionStatus
  readonly version: string
  readonly revision: number
  readonly digest?: string
  readonly updatedAt?: string
  readonly competencyQuestions: readonly CompetencyQuestionDefinition[]
  readonly classes: readonly SemanticClassDefinition[]
  readonly relationships: readonly SemanticRelationshipDefinition[]
  readonly provenanceRules: readonly SemanticRuleDefinition[]
  readonly temporalRules: readonly SemanticRuleDefinition[]
  readonly confidenceThreshold: number
  readonly shaclSeverity: 'Violation' | 'Warning' | 'Info'
}

export interface SemanticEntityCandidate {
  readonly id: string
  readonly label: string
  readonly type: string
  readonly summary?: string
  readonly confidence: number
  readonly sourceRefs: readonly string[]
  readonly validFrom?: string
  readonly validUntil?: string
  readonly properties: Readonly<Record<string, string | number | boolean | null>>
  readonly decision: 'pending' | 'accepted' | 'rejected'
}

export interface SemanticRelationshipCandidate {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly type: string
  readonly label?: string
  readonly confidence: number
  readonly sourceRefs: readonly string[]
  readonly validFrom?: string
  readonly validUntil?: string
  readonly decision: 'pending' | 'accepted' | 'rejected'
}

export interface SemanticCandidates {
  readonly status: 'not_run' | 'ready' | 'failed' | 'stale'
  readonly updatedAt?: string
  readonly entities: readonly SemanticEntityCandidate[]
  readonly relationships: readonly SemanticRelationshipCandidate[]
  readonly warnings: readonly string[]
}

export interface ProviderRunRecord {
  readonly id: string
  readonly kind: ProviderRunKind
  readonly status: ProviderRunStatus
  readonly startedAt: string
  readonly completedAt?: string
  readonly providerVersion?: string
  readonly definitionVersion?: string
  readonly definitionDigest?: string
  readonly sourceDigests: readonly string[]
  readonly summary?: string
  readonly evidencePaths: readonly string[]
  readonly diagnostics: readonly string[]
}

export interface SemanticQuestionResult {
  readonly questionId: string
  readonly status: 'passed' | 'failed' | 'unavailable'
  readonly answerCount: number
  readonly nodeIds: readonly string[]
  readonly edgeIds: readonly string[]
  readonly sourceRefs: readonly string[]
  readonly message: string
}

export interface SemanticValidationResult {
  readonly runId: string
  readonly status: 'passed' | 'failed' | 'unavailable' | 'stale'
  readonly checkedAt: string
  readonly graphRevision: string
  readonly definitionDigest: string
  readonly structuralValid: boolean
  readonly issues: readonly { readonly code: string; readonly severity: string; readonly message: string }[]
  readonly questions: readonly SemanticQuestionResult[]
}

export interface AgentContextResult {
  readonly runId: string
  readonly status: 'ready' | 'failed' | 'stale'
  readonly createdAt: string
  readonly questionId?: string
  readonly seedNodeId?: string
  readonly query: string
  readonly schemaVersion: string
  readonly graphRevision: string
  readonly entities: readonly Record<string, unknown>[]
  readonly relationships: readonly Record<string, unknown>[]
  readonly constraints: readonly string[]
  readonly derivedFacts: readonly string[]
  readonly sources: readonly string[]
  readonly permissionScope: string
}

export interface VerticalSliceResult {
  readonly runId: string
  readonly status: 'succeeded' | 'failed' | 'stale'
  readonly createdAt: string
  readonly task: string
  readonly result: string
  readonly contextRunId?: string
  readonly evidenceRefs: readonly string[]
  readonly diagnostics: readonly string[]
}

export interface FdeDesignDecisionRecord {
  readonly id: string
  readonly outcome: FdeDesignDecisionOutcome
  readonly rationale: string
  readonly decidedAt: string
  /** Exact semantic-workspace revision created by this decision. */
  readonly workspaceRevision: number
  /** Digest of the route, inputs, definitions, runs, validation, context, and slice reviewed by the FDE. */
  readonly evidenceDigest: string
  readonly routeConclusion: SemanticConclusion
  readonly semanticMode: DesignSemanticMode
  readonly definitionDigest?: string
  readonly graphRevision?: string
  readonly sliceRunId?: string
}

export interface SemanticWorkspaceState {
  readonly schemaVersion: 1
  readonly revision: number
  readonly updatedAt: string
  readonly evidenceDigest: string
  readonly provider: {
    readonly id: 'semantica'
    readonly expectedVersion: '0.6.7'
    readonly status: 'unchecked' | 'ready' | 'unavailable' | 'invalid'
    readonly version?: string
    readonly configDigest?: string
    readonly checkedAt?: string
    readonly message?: string
  }
  readonly route?: DesignRouteInput & { readonly conclusion: SemanticConclusion }
  readonly sources: readonly SemanticSourceBinding[]
  readonly definition: SemanticDefinition
  readonly candidates: SemanticCandidates
  readonly runs: readonly ProviderRunRecord[]
  readonly validation?: SemanticValidationResult
  readonly context?: AgentContextResult
  readonly slice?: VerticalSliceResult
  readonly decision?: FdeDesignDecisionRecord
}

export interface SemanticProviderConfig {
  readonly pythonCommand: string
  readonly semanticaSource?: string
  readonly operationTimeoutMs: number
  readonly maxSourceBytes: number
  readonly maxSources: number
}

/** Workspace-owned stage-four semantic definitions, runs, and evidence. */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { listProjectSources, resolveProjectSource } from '@deepseek-ai/dsh-fde-source'
import { runSemantica } from './python.ts'
import { parseSemanticDefinition } from './definition.ts'
import type {
  AgentContextResult,
  CompetencyQuestionDefinition,
  DesignRouteInput,
  FdeDesignDecisionOutcome,
  ProviderRunKind,
  ProviderRunRecord,
  SemanticCandidates,
  SemanticClassDefinition,
  SemanticDefinition,
  SemanticEntityCandidate,
  SemanticProviderConfig,
  SemanticRelationshipCandidate,
  SemanticRelationshipDefinition,
  SemanticRuleDefinition,
  SemanticSourceBinding,
  SemanticValidationResult,
  SemanticWorkspaceState,
  VerticalSliceResult,
} from './types.ts'

export const SEMANTIC_WORKSPACE_PATH = '.fde/design/semantica/workspace.json'
export const SEMANTIC_ONTOLOGY_PATH = '.fde/design/semantica/ontology.json'
export const SEMANTIC_SHACL_PATH = '.fde/design/semantica/ontology.shacl.ttl'
export const SEMANTIC_RAW_GRAPH_PATH = '.fde/design/semantica/graph.json'
export const DESIGN_GRAPH_PATH = '.fde/design/knowledge-graph.json'
export const DESIGN_STAGE_PATH = '.fde/stages/design.json'
const RUN_DIRECTORY = '.fde/design/semantica/runs'
const MECHANISM_ARTIFACT_PATH = 'fde-deliverables/04-solution-design/mechanism-selection.md'
const VERTICAL_SLICE_ARTIFACT_PATH = 'fde-deliverables/04-solution-design/vertical-slice-record.md'
const MAX_STATE_BYTES = 4 * 1024 * 1024
const MAX_VISIBLE_CANDIDATES = 500
const VALIDATION_CHECKS_VERSION = 'project-constraints-v1'

function isoNow(): string { return new Date().toISOString() }
function digest(value: string | Buffer): string { return `sha256:${createHash('sha256').update(value).digest('hex')}` }
function pretty(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n` }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

function emptyDefinition(): SemanticDefinition {
  return {
    status: 'missing', version: '0.1.0', revision: 0,
    competencyQuestions: [], classes: [], relationships: [], provenanceRules: [], temporalRules: [],
    confidenceThreshold: 0.65, shaclSeverity: 'Violation',
  }
}

function emptyCandidates(): SemanticCandidates {
  return { status: 'not_run', entities: [], relationships: [], warnings: [] }
}

function semanticEvidenceDigest(state: Omit<SemanticWorkspaceState, 'evidenceDigest'> | SemanticWorkspaceState): string {
  return digest(JSON.stringify({
    provider: {
      id: state.provider.id, expectedVersion: state.provider.expectedVersion, status: state.provider.status,
      version: state.provider.version, configDigest: state.provider.configDigest,
    },
    route: state.route,
    sources: state.sources,
    definition: state.definition,
    candidates: state.candidates,
    runs: state.runs,
    validation: state.validation,
    context: state.context,
    slice: state.slice,
  }))
}

function emptyState(): SemanticWorkspaceState {
  const state = {
    schemaVersion: 1, revision: 0, updatedAt: isoNow(),
    provider: { id: 'semantica', expectedVersion: '0.6.7', status: 'unchecked' },
    sources: [], definition: emptyDefinition(), candidates: emptyCandidates(), runs: [],
  } as const
  return { ...state, evidenceDigest: semanticEvidenceDigest(state) }
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../'))
}

async function projectPath(root: string, relativePath: string): Promise<string> {
  const canonicalRoot = await realpath(resolve(root))
  const candidate = await realpath(join(canonicalRoot, relativePath))
  if (!isInside(canonicalRoot, candidate)) throw new Error('项目语义文件越过了当前 Workspace。')
  return candidate
}

function statePath(root: string): string { return join(root, SEMANTIC_WORKSPACE_PATH) }

/** Read the current Provider state; absence is an explicit empty workspace. */
export async function readSemanticWorkspace(root: string): Promise<SemanticWorkspaceState> {
  try {
    const filename = await projectPath(root, SEMANTIC_WORKSPACE_PATH)
    const info = await stat(filename)
    if (!info.isFile() || info.size > MAX_STATE_BYTES) throw new Error('语义工作区状态不是普通 JSON，或超过 4 MiB。')
    const raw = JSON.parse(await readFile(filename, 'utf8')) as unknown
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('语义工作区状态结构无效。')
    }
    const record = raw as Record<string, unknown>
    if (record.schemaVersion !== 1 || !Array.isArray(record.sources) || !Array.isArray(record.runs)) {
      throw new Error('语义工作区状态结构无效。')
    }
    const value = record as unknown as SemanticWorkspaceState
    return {
      ...value,
      evidenceDigest: typeof value.evidenceDigest === 'string' ? value.evidenceDigest : semanticEvidenceDigest(value),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState()
    throw error
  }
}

async function replaceState(
  root: string,
  operation: (current: SemanticWorkspaceState) => Promise<SemanticWorkspaceState> | SemanticWorkspaceState,
): Promise<SemanticWorkspaceState> {
  const filename = statePath(root)
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 })
  return await withFileLock(filename, async () => {
    const current = await readSemanticWorkspace(root)
    const next = await operation(clone(current))
    const value: SemanticWorkspaceState = {
      ...next, schemaVersion: 1, revision: current.revision + 1, updatedAt: isoNow(),
      evidenceDigest: semanticEvidenceDigest(next),
    }
    await writeFileAtomic(filename, pretty(value), { mode: 0o600, dirMode: 0o700 })
    await writeDesignStageState(root, value)
    if (value.route !== undefined) {
      await writeFileAtomic(join(root, MECHANISM_ARTIFACT_PATH), mechanismMarkdown(value), { mode: 0o600, dirMode: 0o700 })
    }
    return value
  }, { waitMs: 90_000 })
}

function latestRun(state: SemanticWorkspaceState, kind: ProviderRunKind): ProviderRunRecord | undefined {
  return [...state.runs].reverse().find(item => item.kind === kind)
}

function ontologyStatus(state: SemanticWorkspaceState): string {
  if (state.route?.semantics.mode !== 'ontology') return 'not_applicable'
  return state.definition.status === 'missing' ? 'not_started' : state.definition.status
}

function routeProgress(state: SemanticWorkspaceState): {
  readonly status: string
  readonly workItems: readonly object[]
  readonly recommendation: string
} {
  if (state.route === undefined) return {
    status: 'working', recommendation: 'pending',
    workItems: [
      { id: 'mechanism', status: 'current' }, { id: 'architecture', status: 'waiting' },
      { id: 'slice', status: 'waiting' }, { id: 'decision', status: 'waiting' },
    ],
  }
  const sliceSucceeded = state.slice?.status === 'succeeded'
  const build = latestRun(state, 'build')
  const currentSourceDigests = state.sources.map(item => item.digest)
  const buildCurrent = build?.status === 'succeeded'
    && build.definitionDigest === state.definition.digest
    && build.sourceDigests.length === currentSourceDigests.length
    && build.sourceDigests.every((item, index) => item === currentSourceDigests[index])
  const validationCurrent = state.validation?.status === 'passed'
    && state.validation.definitionDigest === state.definition.digest
    && state.validation.checksVersion === VALIDATION_CHECKS_VERSION
  const contextCurrent = state.context?.status === 'ready'
    && state.context.schemaVersion === state.definition.version
    && state.context.graphRevision === state.validation?.graphRevision
  const semanticsReady = state.route.semantics.mode === 'schema'
    ? true
    : state.provider.status === 'ready' && state.provider.version === state.provider.expectedVersion
      && state.sources.length > 0 && state.definition.status === 'published'
      && buildCurrent && validationCurrent && contextCurrent
  const conclusionReady = state.route.conclusion !== 'pending' && state.route.conclusion !== 'insufficient_evidence'
  const reviewReady = semanticsReady && sliceSucceeded && conclusionReady
  const decisionCurrent = state.decision?.evidenceDigest === state.evidenceDigest
  return {
    status: reviewReady ? 'review-ready' : state.slice?.status === 'failed' ? 'blocked' : 'working',
    recommendation: state.route.conclusion === 'validated' || state.route.conclusion === 'not_required'
      ? 'go' : state.route.conclusion === 'validation_failed' ? 'revise' : 'pending',
    workItems: [
      { id: 'mechanism', status: 'complete' },
      { id: 'architecture', status: semanticsReady ? 'complete' : 'current' },
      { id: 'slice', status: sliceSucceeded ? 'complete' : semanticsReady ? 'current' : 'waiting' },
      { id: 'decision', status: decisionCurrent ? 'complete' : reviewReady ? 'current' : sliceSucceeded ? 'current' : 'waiting' },
    ],
  }
}

async function writeDesignStageState(root: string, state: SemanticWorkspaceState): Promise<void> {
  const filename = join(root, DESIGN_STAGE_PATH)
  let existing: Record<string, unknown> = {}
  try { existing = JSON.parse(await readFile(filename, 'utf8')) as Record<string, unknown> } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const progress = routeProgress(state)
  const build = latestRun(state, 'build')
  const next = {
    ...existing,
    schemaVersion: 1,
    stage: 'design',
    status: progress.status,
    workItems: progress.workItems,
    blockers: Array.isArray(existing.blockers) ? existing.blockers : [],
    recommendation: progress.recommendation,
    design: state.route === undefined ? {
      execution: { status: 'undecided' },
      semantics: { mode: 'undecided', conclusion: 'pending' },
      ontology: { status: 'not_applicable' },
      graphBuild: { status: 'not_applicable' },
    } : {
      execution: { status: 'selected', ...state.route.execution },
      semantics: { ...state.route.semantics, conclusion: state.route.conclusion },
      ontology: {
        status: ontologyStatus(state),
        ...(state.definition.status === 'missing' ? {} : {
          schemaVersion: state.definition.version,
          classCount: state.definition.classes.length,
          relationshipTypeCount: state.definition.relationships.length,
        }),
      },
      graphBuild: state.route.semantics.mode === 'ontology'
        ? { status: build?.status ?? 'waiting', ...(build?.summary === undefined ? {} : { message: build.summary }) }
        : { status: 'not_applicable' },
    },
  }
  await writeFileAtomic(filename, pretty(next), { mode: 0o600, dirMode: 0o700 })
}

function mechanismMarkdown(state: SemanticWorkspaceState): string {
  const route = state.route
  if (route === undefined) throw new Error('第四阶段路线尚未形成。')
  const decision = state.decision
  const decisionCurrent = decision?.evidenceDigest === state.evidenceDigest
  return `# 实现方式选择记录\n\n- 状态：${decision === undefined ? '候选，等待 FDE 评审' : decisionCurrent ? `FDE 已提交 ${decision.outcome}` : '候选已变化，上次 FDE 决定待重评'}\n- 主执行机制：${route.execution.label}（${route.execution.mechanism}）\n- 语义基础：${route.semantics.mode === 'ontology' ? '正式本体／知识图谱' : '普通数据／接口 Schema'}\n- 机制结论：${route.conclusion}\n\n## 执行机制依据\n\n${route.execution.rationale}\n\n## 语义基础依据\n\n${route.semantics.rationale}\n\n## FDE 人工决定\n\n${decision === undefined ? '尚未提交。' : `- 决定：${decision.outcome}\n- 状态：${decisionCurrent ? '当前有效' : '证据变化，待重评'}\n- 时间：${decision.decidedAt}\n- 工作区修订：${String(decision.workspaceRevision)}\n- 依据：${decision.rationale}`}\n\n> Semantica 的运行结论与 FDE 人工决定相互独立；只有 Go 会推进项目阶段。\n`
}

/** Save the independent execution-mechanism and semantic-foundation choice. */
export async function configureDesignRoute(root: string, route: DesignRouteInput): Promise<SemanticWorkspaceState> {
  const state = await replaceState(root, (current) => {
    return {
      ...current,
      route: { ...route, conclusion: route.semantics.mode === 'schema' ? 'not_required' : 'pending' },
      definition: route.semantics.mode === 'ontology' ? current.definition : emptyDefinition(),
      candidates: route.semantics.mode === 'ontology' ? current.candidates : emptyCandidates(),
      runs: current.runs.map(item => item.status === 'succeeded' ? { ...item, status: 'stale' as const } : item),
      ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
      ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
      ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
    }
  })
  return state
}

/** Persist one explicit FDE outcome against the exact current stage-four evidence revision. */
export async function recordFdeDesignDecision(
  root: string,
  expectedRevision: number,
  outcome: FdeDesignDecisionOutcome,
  rationale: string,
): Promise<SemanticWorkspaceState> {
  const normalizedRationale = boundedText(rationale, 'FDE 决定依据', 2_000)
  const state = await replaceState(root, (current) => {
    if (current.revision !== expectedRevision) throw new Error('第四阶段证据已变化，请刷新后重新提交决定。')
    if (current.route === undefined) throw new Error('请先完成双轴机制判断。')
    const progress = routeProgress(current)
    if (outcome === 'go' && progress.status !== 'review-ready') {
      throw new Error('当前版本尚未达到可评审状态，不能提交 Go。')
    }
    return {
      ...current,
      decision: {
        id: `decision_${randomUUID()}`,
        outcome,
        rationale: normalizedRationale,
        decidedAt: isoNow(),
        workspaceRevision: current.revision + 1,
        evidenceDigest: current.evidenceDigest,
        routeConclusion: current.route.conclusion,
        semanticMode: current.route.semantics.mode,
        ...(current.definition.digest === undefined ? {} : { definitionDigest: current.definition.digest }),
        ...(current.validation?.graphRevision === undefined ? {} : { graphRevision: current.validation.graphRevision }),
        ...(current.slice?.runId === undefined ? {} : { sliceRunId: current.slice.runId }),
      },
    }
  })
  return state
}

/** Verify the configured Python runtime and record the actual Semantica version. */
export async function checkProvider(root: string, config: SemanticProviderConfig): Promise<SemanticWorkspaceState> {
  const configDigest = digest(JSON.stringify({
    pythonCommand: config.pythonCommand,
    semanticaSource: config.semanticaSource ?? '',
  }))
  try {
    const result = await runSemantica<{ readonly version: string }>(config, 'health', {})
    return await replaceState(root, (current) => {
      const changed = current.provider.configDigest !== undefined && current.provider.configDigest !== configDigest
      const { message: _message, ...providerWithoutMessage } = current.provider
      return {
        ...current,
        provider: {
          ...providerWithoutMessage, status: result.version === current.provider.expectedVersion ? 'ready' : 'invalid',
          version: result.version, configDigest, checkedAt: isoNow(),
          ...(result.version === current.provider.expectedVersion ? {} : { message: `需要 ${current.provider.expectedVersion}，当前为 ${result.version}。` }),
        },
        ...(changed ? {
          runs: current.runs.map(item => item.status === 'succeeded' ? { ...item, status: 'stale' as const } : item),
          ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
          ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
          ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
          ...(current.route?.semantics.mode !== 'ontology' ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
        } : {}),
      }
    })
  } catch (error) {
    await replaceState(root, (current) => {
      const changed = current.provider.configDigest !== undefined && current.provider.configDigest !== configDigest
      return {
        ...current,
        provider: {
          ...current.provider, status: 'unavailable', configDigest, checkedAt: isoNow(),
          message: error instanceof Error ? error.message : String(error),
        },
        ...(changed ? {
          runs: current.runs.map(item => item.status === 'succeeded' ? { ...item, status: 'stale' as const } : item),
          ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
          ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
          ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
          ...(current.route?.semantics.mode !== 'ontology' ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
        } : {}),
      }
    })
    throw error
  }
}

/** Bind only stable source records already owned by this project. */
export async function bindSemanticSources(
  root: string,
  sourceIds: readonly string[],
  permissionScope: string,
  authority: 'primary' | 'supporting' = 'primary',
): Promise<SemanticWorkspaceState> {
  const unique = [...new Set(sourceIds)]
  if (unique.length === 0 || unique.length > 12) throw new Error('请选择 1 到 12 份项目代表材料。')
  const normalizedPermissionScope = boundedText(permissionScope, '材料权限范围', 1_000)
  const records = await listProjectSources(root)
  const byId = new Map(records.map(item => [item.sourceId, item] as const))
  const bindings: SemanticSourceBinding[] = []
  for (const sourceId of unique) {
    const record = byId.get(sourceId)
    if (record === undefined) throw new Error(`项目资料 ${sourceId} 不存在。`)
    if (record.parse.status !== 'ready' || record.parse.derivedPath === undefined) {
      throw new Error(`${record.originalName} 尚未完成本地识别，不能进入语义构建。`)
    }
    const resolved = await resolveProjectSource(root, sourceId)
    const contentPath = await projectPath(root, record.parse.derivedPath)
    const [original, content] = await Promise.all([readFile(resolved.path), readFile(contentPath)])
    bindings.push({
      sourceId, name: record.originalName, relativePath: record.relativePath,
      contentPath: record.parse.derivedPath, digest: digest(original), bytes: content.byteLength,
      modifiedAt: record.modifiedAt,
      parseStatus: record.parse.status,
      permissionScope: normalizedPermissionScope,
      authority,
      boundAt: isoNow(),
    })
  }
  return await replaceState(root, (current) => {
    if (current.route?.semantics.mode !== 'ontology') throw new Error('只有正式本体／知识图谱路线可以绑定 Semantica 材料。')
    return {
      ...current, sources: bindings,
      candidates: current.candidates.status === 'not_run' ? current.candidates : { ...current.candidates, status: 'stale' },
      runs: current.runs.map(item => (
        item.status === 'succeeded' && item.kind !== 'publish-schema'
          ? { ...item, status: 'stale' as const }
          : item
      )),
      ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' } }),
      ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' } }),
      ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' } }),
      route: { ...current.route, conclusion: 'pending' },
    }
  })
}

function boundedId(value: string, label: string): string {
  const result = value.trim()
  if (!/^[a-z][a-z0-9._-]{0,79}$/iu.test(result)) throw new Error(`${label} 必须使用 1 到 80 个字母或数字组成的稳定 ID。`)
  return result
}
function boundedText(value: string, label: string, max = 1_000): string {
  const result = value.trim()
  if (result === '' || result.length > max) throw new Error(`${label} 必须是 1 到 ${String(max)} 个字符。`)
  return result
}
function stringList(values: readonly string[], label: string, maxItems = 20): readonly string[] {
  if (values.length > maxItems) throw new Error(`${label} 最多 ${String(maxItems)} 项。`)
  return values.map((value, index) => boundedText(value, `${label}[${String(index)}]`, 300))
}

function normalizeDefinition(input: Omit<SemanticDefinition, 'status' | 'revision' | 'digest' | 'updatedAt'>, revision: number): SemanticDefinition {
  if (!Number.isFinite(input.confidenceThreshold) || input.confidenceThreshold < 0 || input.confidenceThreshold > 1) {
    throw new Error('置信度阈值必须在 0 到 1 之间。')
  }
  const ids = new Set<string>()
  const takeId = (value: string, label: string): string => {
    const id = boundedId(value, label)
    if (ids.has(id)) throw new Error(`定义 ID ${id} 重复。`)
    ids.add(id); return id
  }
  const classes: SemanticClassDefinition[] = input.classes.map((item, index) => ({
    id: takeId(item.id, `classes[${String(index)}].id`), label: boundedText(item.label, `classes[${String(index)}].label`, 120),
    ...(item.description === undefined || item.description.trim() === '' ? {} : { description: boundedText(item.description, `classes[${String(index)}].description`, 600) }),
    aliases: stringList(item.aliases, `classes[${String(index)}].aliases`, 30),
    identityKeys: stringList(item.identityKeys, `classes[${String(index)}].identityKeys`),
    extractionPatterns: stringList(item.extractionPatterns, `classes[${String(index)}].extractionPatterns`, 12),
    properties: item.properties.map((property, propertyIndex) => ({
      id: boundedId(property.id, `classes[${String(index)}].properties[${String(propertyIndex)}].id`),
      label: boundedText(property.label, `classes[${String(index)}].properties[${String(propertyIndex)}].label`, 120),
      dataType: property.dataType, required: property.required, unique: property.unique,
    })),
    fieldMappings: item.fieldMappings.map((mapping, mappingIndex) => ({
      sourceField: boundedText(mapping.sourceField, `classes[${String(index)}].fieldMappings[${String(mappingIndex)}].sourceField`, 200),
      targetProperty: boundedId(mapping.targetProperty, `classes[${String(index)}].fieldMappings[${String(mappingIndex)}].targetProperty`),
    })),
  }))
  for (const item of classes) {
    const propertyIds = new Set(item.properties.map(property => property.id))
    for (const mapping of item.fieldMappings) {
      if (!propertyIds.has(mapping.targetProperty)) throw new Error(`类 ${item.id} 的字段映射必须指向已定义属性。`)
    }
  }
  const classIds = new Set(classes.map(item => item.id))
  const relationships: SemanticRelationshipDefinition[] = input.relationships.map((item, index) => {
    const id = takeId(item.id, `relationships[${String(index)}].id`)
    if (!classIds.has(item.domain) || !classIds.has(item.range)) throw new Error(`关系 ${id} 的 Domain／Range 必须引用已定义类。`)
    return {
      id, label: boundedText(item.label, `relationships[${String(index)}].label`, 120), domain: item.domain, range: item.range,
      ...(item.description === undefined || item.description.trim() === '' ? {} : { description: boundedText(item.description, `relationships[${String(index)}].description`, 600) }),
      cardinality: item.cardinality,
      extractionPatterns: stringList(item.extractionPatterns, `relationships[${String(index)}].extractionPatterns`, 12),
    }
  })
  const questions: CompetencyQuestionDefinition[] = input.competencyQuestions.map((item, index) => ({
    id: takeId(item.id, `competencyQuestions[${String(index)}].id`),
    text: boundedText(item.text, `competencyQuestions[${String(index)}].text`, 500),
    required: item.required,
    query: {
      kind: item.query.kind,
      ...(item.query.sourceType === undefined || item.query.sourceType === '' ? {} : { sourceType: item.query.sourceType }),
      ...(item.query.relationshipType === undefined || item.query.relationshipType === '' ? {} : { relationshipType: item.query.relationshipType }),
      ...(item.query.targetType === undefined || item.query.targetType === '' ? {} : { targetType: item.query.targetType }),
      maxDepth: Math.max(1, Math.min(8, Math.trunc(item.query.maxDepth))),
      minAnswers: Math.max(1, Math.min(1_000, Math.trunc(item.query.minAnswers))),
    },
  }))
  const rules = (items: readonly SemanticRuleDefinition[], label: string): SemanticRuleDefinition[] => items.map((item, index) => ({
    id: takeId(item.id, `${label}[${String(index)}].id`), label: boundedText(item.label, `${label}[${String(index)}].label`, 120),
    description: boundedText(item.description, `${label}[${String(index)}].description`, 1_000),
  }))
  const provisional = {
    status: 'draft' as const, version: boundedText(input.version, 'definition.version', 80), revision,
    competencyQuestions: questions, classes, relationships,
    provenanceRules: rules(input.provenanceRules, 'provenanceRules'),
    temporalRules: rules(input.temporalRules, 'temporalRules'),
    confidenceThreshold: input.confidenceThreshold, shaclSeverity: input.shaclSeverity, updatedAt: isoNow(),
  }
  return { ...provisional, digest: digest(JSON.stringify(provisional)) }
}

/** Save one versioned editable definition and invalidate dependent evidence. */
export async function saveSemanticDefinition(
  root: string,
  expectedRevision: number,
  input: Omit<SemanticDefinition, 'status' | 'revision' | 'digest' | 'updatedAt'>,
): Promise<SemanticWorkspaceState> {
  return await replaceState(root, (current) => {
    if (current.route?.semantics.mode !== 'ontology') throw new Error('当前项目没有选择正式本体／知识图谱路线。')
    if (current.definition.revision !== expectedRevision) throw new Error('本体定义已被更新，请刷新后重新编辑。')
    const definition = normalizeDefinition(parseSemanticDefinition(input), current.definition.revision + 1)
    return {
      ...current, definition,
      candidates: current.candidates.status === 'not_run' ? current.candidates : { ...current.candidates, status: 'stale' },
      runs: current.runs.map(item => item.status === 'succeeded' ? { ...item, status: 'stale' as const } : item),
      ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
      ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
      ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
      route: { ...current.route, conclusion: 'pending' },
    }
  })
}

async function readBoundDocuments(
  root: string,
  state: SemanticWorkspaceState,
  config: SemanticProviderConfig,
): Promise<readonly object[]> {
  if (state.sources.length === 0) throw new Error('请先绑定本轮获准使用的代表材料。')
  if (state.sources.length > config.maxSources) throw new Error(`本轮最多绑定 ${String(config.maxSources)} 份代表材料。`)
  let total = 0
  const documents: object[] = []
  for (const binding of state.sources) {
    const record = await resolveProjectSource(root, binding.sourceId)
    const original = await readFile(record.path)
    if (digest(original) !== binding.digest) throw new Error(`${binding.name} 的版本已变化，请重新绑定后再运行。`)
    const contentPath = await projectPath(root, binding.contentPath)
    const text = await readFile(contentPath, 'utf8')
    total += Buffer.byteLength(text)
    if (total > config.maxSourceBytes) throw new Error(`本轮材料文本超过 ${String(config.maxSourceBytes)} 字节限制，请缩小代表集。`)
    documents.push({ sourceId: binding.sourceId, name: binding.name, path: binding.contentPath, text })
  }
  return documents
}

async function beginRun(
  root: string,
  kind: ProviderRunKind,
): Promise<{ readonly state: SemanticWorkspaceState; readonly run: ProviderRunRecord }> {
  const runId = `run_${randomUUID()}`
  const state = await replaceState(root, (current) => {
    if (current.route?.semantics.mode !== 'ontology') {
      throw new Error('当前项目没有选择正式本体／知识图谱路线。')
    }
    const run: ProviderRunRecord = {
      id: runId, kind, status: 'running', startedAt: isoNow(),
      ...(current.provider.version === undefined ? {} : { providerVersion: current.provider.version }),
      ...(current.definition.status === 'missing' ? {} : {
        definitionVersion: current.definition.version,
        definitionDigest: current.definition.digest,
      }),
      sourceDigests: current.sources.map(item => item.digest), evidencePaths: [], diagnostics: [],
    }
    return { ...current, runs: [...current.runs, run].slice(-80) }
  })
  const run = state.runs.find(item => item.id === runId)
  if (run === undefined) throw new Error('Semantica 运行记录未能保存。')
  return { state, run }
}

async function finishRun(root: string, runId: string, patch: Partial<ProviderRunRecord>): Promise<SemanticWorkspaceState> {
  const state = await replaceState(root, current => ({
    ...current,
    runs: current.runs.map(item => item.id === runId ? { ...item, ...patch, completedAt: isoNow() } : item),
  }))
  const run = state.runs.find(item => item.id === runId)
  if (run !== undefined) await writeFileAtomic(join(root, RUN_DIRECTORY, `${runId}.json`), pretty(run), { mode: 0o600, dirMode: 0o700 })
  return state
}

async function failRun(root: string, run: ProviderRunRecord, error: unknown): Promise<never> {
  const message = error instanceof Error ? error.message : String(error)
  await finishRun(root, run.id, { status: 'failed', summary: message, diagnostics: [message] })
  throw error
}

/** Extract traceable candidates from bound project materials. */
export async function extractCandidates(root: string, config: SemanticProviderConfig): Promise<SemanticWorkspaceState> {
  const { state, run } = await beginRun(root, 'extract')
  try {
    if (state.provider.status !== 'ready') throw new Error('Semantica Provider 尚未通过版本检查。')
    const documents = await readBoundDocuments(root, state, config)
    const result = await runSemantica<{
      readonly entities: SemanticEntityCandidate[]
      readonly relationships: SemanticRelationshipCandidate[]
      readonly warnings: string[]
    }>(
      config, 'extract', { documents, definition: state.definition },
    )
    if (result.entities.length > MAX_VISIBLE_CANDIDATES || result.relationships.length > MAX_VISIBLE_CANDIDATES) {
      throw new Error(`候选超过 ${String(MAX_VISIBLE_CANDIDATES)} 项限制，请缩小代表材料或收紧抽取规则。`)
    }
    await replaceState(root, current => ({
      ...current,
      candidates: { status: 'ready', updatedAt: isoNow(), entities: result.entities, relationships: result.relationships, warnings: result.warnings },
      runs: current.runs.map(item => item.status === 'succeeded' ? { ...item, status: 'stale' as const } : item),
      ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
      ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
      ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
      ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
    }))
    return await finishRun(root, run.id, {
      status: 'succeeded', summary: `形成 ${String(result.entities.length)} 个实体候选、${String(result.relationships.length)} 条关系候选。`,
      diagnostics: result.warnings,
    })
  } catch (error) { return await failRun(root, run, error) }
}

function proposedDefinition(current: SemanticDefinition, ontology: Record<string, unknown>): SemanticDefinition {
  const rawClasses = Array.isArray(ontology.classes) ? ontology.classes : []
  const rawProperties = Array.isArray(ontology.properties) ? ontology.properties : []
  const classes: SemanticClassDefinition[] = rawClasses.flatMap((value) => {
    if (value === null || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    if (typeof item.name !== 'string') return []
    return [{ id: item.name, label: typeof item.label === 'string' ? item.label : item.name, aliases: [], identityKeys: [], properties: [], fieldMappings: [], extractionPatterns: [] }]
  })
  const classIds = new Set(classes.map(item => item.id))
  const relationships: SemanticRelationshipDefinition[] = rawProperties.flatMap((value) => {
    if (value === null || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    const domain = Array.isArray(item.domain) && typeof item.domain[0] === 'string' ? item.domain[0] : undefined
    const range = Array.isArray(item.range) && typeof item.range[0] === 'string' ? item.range[0] : undefined
    if (item.type !== 'object' || typeof item.name !== 'string' || domain === undefined || range === undefined || !classIds.has(domain) || !classIds.has(range)) return []
    return [{ id: item.name, label: typeof item.label === 'string' ? item.label : item.name, domain, range, cardinality: 'many-to-many', extractionPatterns: [] }]
  })
  return normalizeDefinition({
    version: current.version, competencyQuestions: current.competencyQuestions,
    classes: classes.length === 0 ? current.classes : classes,
    relationships: relationships.length === 0 ? current.relationships : relationships,
    provenanceRules: current.provenanceRules, temporalRules: current.temporalRules,
    confidenceThreshold: current.confidenceThreshold, shaclSeverity: current.shaclSeverity,
  }, current.revision + 1)
}

/** Ask Semantica to infer a candidate schema from the current reviewed sample. */
export async function proposeSchema(root: string, config: SemanticProviderConfig): Promise<SemanticWorkspaceState> {
  const { state, run } = await beginRun(root, 'propose-schema')
  try {
    if (state.provider.status !== 'ready') throw new Error('Semantica Provider 尚未通过版本检查。')
    if (state.candidates.status !== 'ready' || state.candidates.entities.length === 0) throw new Error('当前没有可用于生成 Schema 的候选实体。')
    const result = await runSemantica<{ readonly ontology: Record<string, unknown> }>(config, 'propose-schema', { candidates: state.candidates })
    const definition = proposedDefinition(state.definition, result.ontology)
    await replaceState(root, (current) => {
      return {
        ...current,
        definition,
        runs: current.runs.map(item => (
          item.status === 'succeeded' && item.kind !== 'extract'
            ? { ...item, status: 'stale' as const }
            : item
        )),
        ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
        ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
        ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
        ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
      }
    })
    return await finishRun(root, run.id, { status: 'succeeded', summary: `Semantica 形成 ${String(definition.classes.length)} 个候选类、${String(definition.relationships.length)} 种候选关系。`, diagnostics: [] })
  } catch (error) { return await failRun(root, run, error) }
}

/** Apply explicit candidate review decisions without promoting pending facts. */
export async function reviewCandidates(
  root: string,
  decisions: readonly { readonly id: string; readonly decision: 'accepted' | 'rejected' }[],
): Promise<SemanticWorkspaceState> {
  const byId = new Map(decisions.map(item => [item.id, item.decision] as const))
  return await replaceState(root, (current) => {
    const { validation: _validation, context: _context, slice: _slice, ...retained } = current
    return {
      ...retained,
      candidates: {
        ...current.candidates,
        entities: current.candidates.entities.map((item) => {
          const decision = byId.get(item.id)
          return decision === undefined ? item : { ...item, decision }
        }),
        relationships: current.candidates.relationships.map((item) => {
          const decision = byId.get(item.id)
          return decision === undefined ? item : { ...item, decision }
        }),
      },
      runs: current.runs.map(item => item.kind === 'build' || item.kind === 'validate' || item.kind === 'context' || item.kind === 'slice'
        ? { ...item, status: item.status === 'succeeded' ? 'stale' as const : item.status }
        : item),
      ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
      ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
      ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
      ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
    }
  })
}

/** Validate and publish the exact current definition through Semantica. */
export async function publishSchema(root: string, config: SemanticProviderConfig): Promise<SemanticWorkspaceState> {
  const { state, run } = await beginRun(root, 'publish-schema')
  try {
    if (state.provider.status !== 'ready') throw new Error('Semantica Provider 尚未通过版本检查。')
    if (state.definition.status === 'missing' || state.definition.classes.length === 0) throw new Error('请先保存包含至少一个类的本体定义。')
    const result = await runSemantica<{ readonly ontology: object; readonly validation: { readonly valid?: boolean }; readonly shacl: string }>(config, 'publish-schema', { definition: state.definition })
    if (result.validation.valid === false) throw new Error('Semantica 本体结构校验未通过。')
    await Promise.all([
      writeFileAtomic(join(root, SEMANTIC_ONTOLOGY_PATH), pretty(result.ontology), { mode: 0o600, dirMode: 0o700 }),
      writeFileAtomic(join(root, SEMANTIC_SHACL_PATH), result.shacl, { mode: 0o600, dirMode: 0o700 }),
    ])
    await replaceState(root, current => ({
      ...current,
      definition: { ...current.definition, status: 'published', updatedAt: isoNow() },
      ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: 'pending' } }),
    }))
    return await finishRun(root, run.id, {
      status: 'succeeded', summary: `已发布 Ontology ${state.definition.version}，并生成 SHACL。`,
      evidencePaths: [SEMANTIC_ONTOLOGY_PATH, SEMANTIC_SHACL_PATH], diagnostics: [],
    })
  } catch (error) { return await failRun(root, run, error) }
}

interface SemanticaGraph {
  readonly entities: readonly Record<string, unknown>[]
  readonly relationships: readonly Record<string, unknown>[]
  readonly metadata?: Record<string, unknown>
}

function graphText(value: unknown, label: string, fallback?: string): string {
  if (typeof value === 'string' && value.trim() !== '') return value
  if (fallback !== undefined) return fallback
  throw new Error(`Semantica 图谱中的${label}无效。`)
}

function graphStringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function displayGraph(state: SemanticWorkspaceState, graph: SemanticaGraph): object {
  const classes = new Map(state.definition.classes.map(item => [item.id, item] as const))
  const communities = state.definition.classes.map(item => ({
    id: `type:${item.id}`, label: item.label, level: 1,
    nodeIds: graph.entities
      .filter(entity => entity.type === item.id)
      .map(entity => graphText(entity.id, '实体 ID')),
  })).filter(item => item.nodeIds.length > 0)
  const revision = digest(JSON.stringify({
    graph,
    definition: state.definition.digest,
    sources: state.sources.map(item => item.digest),
  }))
  return {
    schemaVersion: 1,
    provider: { id: 'semantica', version: state.provider.version },
    graphId: `workspace-${digest(state.sources.map(item => item.sourceId).join('|')).slice(-12)}`,
    revision, ontologyVersion: state.definition.version, updatedAt: isoNow(),
    nodes: graph.entities.map((entity) => {
      const id = graphText(entity.id, '实体 ID')
      const type = graphText(entity.type, '实体类型', 'Entity')
      return {
        id,
        label: graphText(entity.name, '实体名称', id),
        type,
        summary: typeof entity.summary === 'string' ? entity.summary : undefined,
        communityId: classes.has(type) ? `type:${type}` : undefined,
        confidence: typeof entity.confidence === 'number' ? entity.confidence : undefined,
        validFrom: typeof entity.validFrom === 'string' ? entity.validFrom : undefined,
        validUntil: typeof entity.validUntil === 'string' ? entity.validUntil : undefined,
        sourceRefs: graphStringList(entity.sourceRefs),
      }
    }),
    edges: graph.relationships.map((edge, index) => ({
      id: typeof edge.id === 'string' ? edge.id : `edge-${String(index + 1)}`,
      source: graphText(edge.source, '关系起点'),
      target: graphText(edge.target, '关系终点'),
      type: graphText(edge.type, '关系类型', 'related_to'),
      label: typeof edge.label === 'string' ? edge.label : undefined,
      weight: 1,
      confidence: typeof edge.confidence === 'number' ? edge.confidence : undefined,
      validFrom: typeof edge.validFrom === 'string' ? edge.validFrom : undefined,
      validUntil: typeof edge.validUntil === 'string' ? edge.validUntil : undefined,
      sourceRefs: graphStringList(edge.sourceRefs),
    })),
    communities,
  }
}

/** Build the project graph from accepted candidates through Semantica. */
export async function buildGraph(root: string, config: SemanticProviderConfig): Promise<SemanticWorkspaceState> {
  const { state, run } = await beginRun(root, 'build')
  try {
    if (state.provider.status !== 'ready') throw new Error('Semantica Provider 尚未通过版本检查。')
    if (state.definition.status !== 'published') throw new Error('只有已发布的当前 Ontology 才能用于构建。')
    if (state.candidates.status !== 'ready') throw new Error('候选知识尚未形成或已过期，请按当前定义重新抽取并审核。')
    await readBoundDocuments(root, state, config)
    const entities = state.candidates.entities.filter(item => item.decision === 'accepted')
    const acceptedIds = new Set(entities.map(item => item.id))
    const relationships = state.candidates.relationships.filter(item => item.decision === 'accepted' && acceptedIds.has(item.source) && acceptedIds.has(item.target))
    if (entities.length === 0) throw new Error('还没有经人工接受的候选实体，不能构建正式项目图谱。')
    const result = await runSemantica<{
      readonly graph: SemanticaGraph
      readonly validation: { readonly is_valid?: boolean; readonly issues?: readonly object[] }
    }>(
      config, 'build', { entities, relationships, definition: state.definition },
    )
    const snapshot = displayGraph(state, result.graph)
    await Promise.all([
      writeFileAtomic(join(root, SEMANTIC_RAW_GRAPH_PATH), pretty(result.graph), { mode: 0o600, dirMode: 0o700 }),
      writeFileAtomic(join(root, DESIGN_GRAPH_PATH), pretty(snapshot), { mode: 0o600, dirMode: 0o700 }),
    ])
    await replaceState(root, current => ({
      ...current,
      ...(current.validation === undefined ? {} : { validation: { ...current.validation, status: 'stale' as const } }),
      ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
      ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
      ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
    }))
    return await finishRun(root, run.id, {
      status: 'succeeded',
      summary: `Semantica 已构建 ${String(result.graph.entities.length)} 个实体、${String(result.graph.relationships.length)} 条关系；结构验证仍需独立运行。`,
      evidencePaths: [SEMANTIC_RAW_GRAPH_PATH, DESIGN_GRAPH_PATH],
      diagnostics: result.validation.is_valid === false ? ['构建时预检查发现结构问题，必须独立运行验证。'] : [],
    })
  } catch (error) { return await failRun(root, run, error) }
}

async function readRawGraph(root: string): Promise<SemanticaGraph> {
  try { return JSON.parse(await readFile(await projectPath(root, SEMANTIC_RAW_GRAPH_PATH), 'utf8')) as SemanticaGraph } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('项目知识图谱尚未构建。')
    throw error
  }
}

/** Independently validate graph structure and execute every competency question. */
export async function validateGraph(root: string, config: SemanticProviderConfig): Promise<SemanticWorkspaceState> {
  const { state, run } = await beginRun(root, 'validate')
  try {
    if (state.definition.status !== 'published' || state.definition.digest === undefined) throw new Error('当前 Ontology 尚未发布。')
    await readBoundDocuments(root, state, config)
    const graph = await readRawGraph(root)
    const display = JSON.parse(await readFile(await projectPath(root, DESIGN_GRAPH_PATH), 'utf8')) as { revision: string }
    const result = await runSemantica<{
      readonly structural: {
        readonly is_valid: boolean
        readonly issues: readonly { readonly code: string; readonly severity: string; readonly message: string }[]
      }
      readonly questions: SemanticValidationResult['questions']
    }>(config, 'validate', { graph, definition: state.definition, allowedSourceIds: state.sources.map(item => item.sourceId) })
    const requiredIds = new Set(state.definition.competencyQuestions.filter(item => item.required).map(item => item.id))
    const requiredResults = result.questions.filter(item => requiredIds.has(item.questionId))
    const requiredPassed = requiredIds.size > 0 && requiredResults.length === requiredIds.size
      && requiredResults.every(item => item.status === 'passed')
    const validation: SemanticValidationResult = {
      checksVersion: VALIDATION_CHECKS_VERSION,
      runId: run.id, status: result.structural.is_valid && requiredPassed ? 'passed' : 'failed', checkedAt: isoNow(),
      graphRevision: display.revision, definitionDigest: state.definition.digest,
      structuralValid: result.structural.is_valid, issues: result.structural.issues, questions: result.questions,
    }
    await replaceState(root, (current) => {
      return {
        ...current, validation,
        ...(current.context === undefined ? {} : { context: { ...current.context, status: 'stale' as const } }),
        ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
        ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: validation.status === 'failed' ? 'validation_failed' as const : 'pending' as const } }),
      }
    })
    const evidencePath = `${RUN_DIRECTORY}/${run.id}.validation.json`
    await writeFileAtomic(join(root, evidencePath), pretty(validation), { mode: 0o600, dirMode: 0o700 })
    return await finishRun(root, run.id, {
      status: 'succeeded', summary: validation.status === 'passed' ? '结构校验与全部必答能力问题查询已通过。' : '验证已执行，但存在结构问题或未通过的必答能力问题。',
      evidencePaths: [evidencePath], diagnostics: validation.issues.map(item => item.message),
    })
  } catch (error) { return await failRun(root, run, error) }
}

/** Read a validated subgraph without changing design evidence or its FDE decision.
 * @param root - Registered project root.
 * @param config - Local provider configuration.
 * @param input - Exact published question or node selection; query describes the task only.
 * @returns Version-bound context, logged by the calling Harness tool.
 */
export async function queryAgentContext(
  root: string,
  config: SemanticProviderConfig,
  input: { readonly questionId?: string; readonly seedNodeId?: string; readonly query: string; readonly maxDepth: number },
): Promise<AgentContextResult> {
  if (!input.questionId?.trim() && !input.seedNodeId?.trim()) throw new Error('请选择已发布的 questionId 或当前图谱的 seedNodeId；query 仅描述任务，不执行自由文本检索。')
  boundedText(input.query, '查询任务', 2_000)
  if (!Number.isInteger(input.maxDepth) || input.maxDepth < 0 || input.maxDepth > 3) throw new Error('查询深度必须为 0–3。')
  const state = await readSemanticWorkspace(root)
  if (state.provider.status !== 'ready') throw new Error('Semantica Provider 尚未通过版本检查。')
  if (state.validation?.status !== 'passed' || state.validation.definitionDigest !== state.definition.digest) {
    throw new Error('当前图谱尚未通过同版本独立验证，不能进入 Agent 上下文。')
  }
  if (state.validation.checksVersion !== VALIDATION_CHECKS_VERSION) throw new Error('图谱验证记录未覆盖当前项目约束检查，请先重新验证；原始图谱和阶段历史保留。')
  await readBoundDocuments(root, state, config)
  const runtime = await runSemantica<{ readonly version: string }>(config, 'health', {})
  if (runtime.version !== state.provider.expectedVersion) throw new Error(`需要 Semantica ${state.provider.expectedVersion}，当前为 ${runtime.version}。`)
  const graph = await readRawGraph(root)
  const displayPath = await projectPath(root, DESIGN_GRAPH_PATH)
  const displayBytes = await readFile(displayPath, 'utf8')
  const display = JSON.parse(displayBytes) as { revision?: unknown }
  if (display.revision !== state.validation.graphRevision) throw new Error('当前图谱修订与验证回执不一致，请重新验证。')
  const result = await runSemantica<{ readonly entities: readonly Record<string, unknown>[]; readonly relationships: readonly Record<string, unknown>[]; readonly sources: readonly string[]; readonly constraints: readonly string[]; readonly derivedFacts: readonly string[] }>(config, 'context', {
    graph, definition: state.definition, questionId: input.questionId, seedNodeId: input.seedNodeId,
    query: input.query, maxDepth: input.maxDepth, minConfidence: state.definition.confidenceThreshold,
    allowedSourceIds: state.sources.map(item => item.sourceId),
  })
  if ((await readSemanticWorkspace(root)).evidenceDigest !== state.evidenceDigest
    || await readFile(displayPath, 'utf8') !== displayBytes
    || digest(pretty(await readRawGraph(root))) !== digest(pretty(graph))) throw new Error('查询期间图谱或定义发生变化，请重新查询。')
  if (result.entities.length === 0) throw new Error('当前查询没有返回满足来源、有效时间和置信度条件的实体。')
  return {
    runId: `query_${randomUUID()}`, status: 'ready', createdAt: isoNow(),
    ...(input.questionId === undefined ? {} : { questionId: input.questionId }),
    ...(input.seedNodeId === undefined ? {} : { seedNodeId: input.seedNodeId }),
    query: input.query, schemaVersion: state.definition.version, graphRevision: state.validation.graphRevision,
    entities: result.entities, relationships: result.relationships, constraints: result.constraints,
    derivedFacts: result.derivedFacts, sources: result.sources,
    permissionScope: [...new Set(state.sources.map(item => item.permissionScope))].join('；'),
  }
}

/** Create stage-four validation context; replacing it requires a new vertical slice. */
export async function createAgentContext(
  root: string,
  config: SemanticProviderConfig,
  input: { readonly questionId?: string; readonly seedNodeId?: string; readonly query: string; readonly maxDepth: number },
): Promise<SemanticWorkspaceState> {
  if (!input.questionId?.trim() && !input.seedNodeId?.trim()) throw new Error('请选择已发布的 questionId 或当前图谱的 seedNodeId。')
  const { run } = await beginRun(root, 'context')
  try {
    const context: AgentContextResult = { ...await queryAgentContext(root, config, input), runId: run.id }
    const evidencePath = `${RUN_DIRECTORY}/${run.id}.context.json`
    await writeFileAtomic(join(root, evidencePath), pretty(context), { mode: 0o600, dirMode: 0o700 })
    await replaceState(root, (current) => {
      return {
        ...current,
        context,
        ...(current.slice === undefined ? {} : { slice: { ...current.slice, status: 'stale' as const } }),
        ...(current.route === undefined ? {} : { route: { ...current.route, conclusion: 'pending' as const } }),
      }
    })
    return await finishRun(root, run.id, {
      status: 'succeeded', summary: `受控查询返回 ${String(context.entities.length)} 个实体、${String(context.relationships.length)} 条关系。`,
      evidencePaths: [evidencePath], diagnostics: [],
    })
  } catch (error) { return await failRun(root, run, error) }
}

function verticalSliceMarkdown(state: SemanticWorkspaceState, slice: VerticalSliceResult): string {
  return `# 纵向切片验证记录\n\n- 状态：${slice.status}\n- 运行 ID：${slice.runId}\n- 运行时间：${slice.createdAt}\n- 语义路线：${state.route?.semantics.mode ?? '未选择'}\n- Ontology：${state.definition.status === 'published' ? state.definition.version : '不适用或未发布'}\n- Agent Context：${slice.contextRunId ?? '不适用'}\n\n## 真实任务\n\n${slice.task}\n\n## 真实结果\n\n${slice.result}\n\n## 证据引用\n\n${slice.evidenceRefs.map(item => `- ${item}`).join('\n')}\n\n## 诊断\n\n${slice.diagnostics.length === 0 ? '- 无' : slice.diagnostics.map(item => `- ${item}`).join('\n')}\n\n> 本记录只保存本次真实运行回执，不等于 FDE 已作出阶段决定。\n`
}

async function validateEvidenceRefs(root: string, refs: readonly string[]): Promise<void> {
  for (const ref of refs) {
    const filename = await projectPath(root, ref)
    const info = await stat(filename)
    if (!info.isFile() || info.size === 0 || info.size > MAX_STATE_BYTES || !(await readFile(filename, 'utf8')).trim()) throw new Error(`纵向切片证据 ${ref} 必须是项目内非空文件，且不超过 4 MiB。`)
  }
}

/** Record a truthful externally executed vertical slice; never synthesizes success. */
export async function reportVerticalSlice(
  root: string,
  input: { readonly status: 'succeeded' | 'failed'; readonly task: string; readonly result: string; readonly contextRunId?: string; readonly evidenceRefs: readonly string[]; readonly diagnostics?: readonly string[] },
): Promise<SemanticWorkspaceState> {
  const state = await readSemanticWorkspace(root)
  if (state.route === undefined) throw new Error('请先完成双轴机制判断。')
  if (input.evidenceRefs.length === 0) throw new Error('纵向切片必须至少包含一项可追溯运行证据。')
  const evidenceRefs = stringList(input.evidenceRefs, '纵向切片证据', 32)
  await validateEvidenceRefs(root, evidenceRefs)
  if (state.route.semantics.mode === 'ontology') {
    if (state.validation?.status !== 'passed' || state.validation.definitionDigest !== state.definition.digest) {
      throw new Error('本体路线必须先通过当前 Ontology 版本的独立验证。')
    }
    if (state.context?.status !== 'ready'
      || state.context.schemaVersion !== state.definition.version
      || state.context.graphRevision !== state.validation.graphRevision) {
      throw new Error('本体路线必须先形成当前版本的受控 Agent 上下文。')
    }
    if (input.contextRunId !== state.context.runId) throw new Error('纵向切片引用的 Agent Context 不是当前有效版本。')
  }
  const runId = `run_${randomUUID()}`
  const slice: VerticalSliceResult = {
    runId, status: input.status, createdAt: isoNow(), task: boundedText(input.task, '纵向切片任务', 2_000),
    result: boundedText(input.result, '纵向切片结果', 4_000),
    ...(input.contextRunId === undefined ? {} : { contextRunId: input.contextRunId }),
    evidenceRefs, diagnostics: stringList(input.diagnostics ?? [], '纵向切片诊断', 32),
  }
  const next = await replaceState(root, (current) => {
    const conclusion = current.route?.semantics.mode === 'schema'
      ? 'not_required'
      : input.status === 'failed' || current.validation?.status === 'failed'
        ? 'validation_failed'
        : current.validation?.status === 'passed' && current.context?.status === 'ready'
          ? 'validated' : 'insufficient_evidence'
    const run: ProviderRunRecord = {
      id: runId, kind: 'slice', status: input.status, startedAt: slice.createdAt, completedAt: slice.createdAt,
      ...(current.provider.version === undefined ? {} : { providerVersion: current.provider.version }),
      ...(current.definition.status === 'missing' ? {} : { definitionVersion: current.definition.version, definitionDigest: current.definition.digest }),
      sourceDigests: current.sources.map(item => item.digest), summary: slice.result,
      evidencePaths: [...slice.evidenceRefs], diagnostics: [...slice.diagnostics],
    }
    if (current.route === undefined) throw new Error('第四阶段路线已变化，请重新运行纵向切片。')
    return {
      ...current, slice, runs: [...current.runs, run].slice(-80),
      route: { ...current.route, conclusion },
    }
  })
  await Promise.all([
    writeFileAtomic(join(root, RUN_DIRECTORY, `${runId}.json`), pretty(next.runs.find(item => item.id === runId)), { mode: 0o600, dirMode: 0o700 }),
    writeFileAtomic(join(root, VERTICAL_SLICE_ARTIFACT_PATH), verticalSliceMarkdown(next, slice), { mode: 0o600, dirMode: 0o700 }),
  ])
  return next
}

/** Business projection and validation contract for the first FDE stage. */

import { readFile, realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type {
  DiscoveryCapabilityRouteSnapshot,
  DiscoveryEvidenceKind,
  DiscoveryEvidenceReferenceSnapshot,
  DiscoveryEvidenceState,
  DiscoverySourceAdapterSnapshot,
  DiscoveryStageArtifactSnapshot,
  DiscoveryStageSnapshot,
  DiscoveryWorkflowCandidateSnapshot,
  DiscoveryWorkflowCatalogSnapshot,
  DiscoveryWorkflowDisposition,
  DiscoveryWorkItemId,
  RequirementArtifactSnapshot,
  RequirementArtifactsSnapshot,
} from './types.ts'
import { REQUIREMENT_ARTIFACT_ROOT } from './requirement-artifacts.ts'

const REFRAME_PATH = `${REQUIREMENT_ARTIFACT_ROOT}/engagement-reframe.md`
const WORKFLOW_CATALOG_PATH = '.fde/discovery/workflows.json' as const
const ARTIFACT_CATALOG_PATH = '.fde/discovery/artifacts.json' as const
const MAX_DISCOVERY_JSON_BYTES = 256 * 1024
const MAX_DISCOVERY_MARKDOWN_BYTES = 512 * 1024
const WORKFLOW_DISPOSITIONS = new Set<DiscoveryWorkflowDisposition>(['candidate', 'selected', 'deferred', 'rejected'])
const EVIDENCE_STATES = new Set<DiscoveryEvidenceState>(['confirmed', 'inferred', 'unverified'])
const EVIDENCE_KINDS = new Set<DiscoveryEvidenceKind>(['project-file', 'conversation', 'interview', 'observation', 'system', 'policy', 'external'])
const STRUCTURE_STATES = new Set<DiscoveryStageArtifactSnapshot['structureState']>(['missing', 'invalid', 'starter_valid', 'complete_valid', 'not_applicable'])

const FDE_GUIDE_COMMIT = '060ef0f3b67743b2e1fc3705763d423eae980236'
const FDE_ENGINEERING_COMMIT = 'ee045a66db5242617ccea9e5e33139a2980ab55e'

function source(
  id: string,
  commit: string,
  license: string,
  artifact: string,
): DiscoverySourceAdapterSnapshot {
  return { id, version: commit.slice(0, 8), commit, license, artifact }
}

const FDE_GUIDE_SOURCE = (artifact: string): DiscoverySourceAdapterSnapshot => source(
  'davidahmann/fde-guide', FDE_GUIDE_COMMIT, 'Apache-2.0', artifact,
)
const FDE_ENGINEERING_SOURCE = (artifact: string): DiscoverySourceAdapterSnapshot => source(
  'rpraharaj/forward-deployed-engineer', FDE_ENGINEERING_COMMIT, 'MIT', artifact,
)
const PRODUCT_SOURCE = (artifact: string): DiscoverySourceAdapterSnapshot => ({
  id: 'ff-fde-workbench/discovery-contract',
  version: 'F005-v2',
  commit: 'product-spec/F005',
  license: 'project',
  artifact,
})

/** Pinned method-first route used by stage one and exposed for transparent diagnostics. */
export const DISCOVERY_CAPABILITY_ROUTE: DiscoveryCapabilityRouteSnapshot = {
  primaryMethod: {
    skill: 'qualify-ai-workflow', layer: 'method',
    condition: '所有第一阶段候选工作流先执行资格判断。',
    source: FDE_GUIDE_SOURCE('qualify-ai-workflow'),
  },
  conditionalMethod: {
    skill: 'reframe-ai-engagement', layer: 'method',
    condition: '仅当现场事实推翻继承边界、成功标准或停止条件时追加。',
    source: FDE_GUIDE_SOURCE('reframe-ai-engagement'),
  },
  engineering: [
    { skill: 'fde-orient', layer: 'engineering', condition: '项目首次定向或任务性质发生改变。', source: FDE_ENGINEERING_SOURCE('fde-orient') },
    { skill: 'knowledge-interview', layer: 'engineering', condition: '存在只能由真实流程知情者补齐的事实缺口。', source: FDE_ENGINEERING_SOURCE('knowledge-interview') },
    { skill: 'ownership-map', layer: 'engineering', condition: '需要确认维护者、审批人或决策权。', source: FDE_ENGINEERING_SOURCE('ownership-map') },
    { skill: 'repo-recon', layer: 'engineering', condition: '候选问题明确落到既有代码或系统。', source: FDE_ENGINEERING_SOURCE('repo-recon') },
    { skill: 'stakeholder-brief', layer: 'engineering', condition: '需要向管理者提交一个可执行决定。', source: FDE_ENGINEERING_SOURCE('stakeholder-brief') },
  ],
}

const WORK_ITEMS: readonly { readonly id: DiscoveryWorkItemId; readonly title: string; readonly purpose: string }[] = [
  { id: 'collect-originals', title: '收集原始情况', purpose: '保留客户说法、资料和已知现场条件。' },
  { id: 'restore-workflow', title: '还原真实工作', purpose: '核对正常流程、异常流程、人工回退和责任人。' },
  { id: 'qualify-value', title: '核对问题价值', purpose: '找到可验证的业务结果、现状基线和停止条件。' },
  { id: 'form-conclusion', title: '形成阶段结论', purpose: '整理候选材料，供 FDE 做 Go、Revise、Narrow 或 Stop 决定。' },
] as const

type DiscoveryArtifactId = DiscoveryStageArtifactSnapshot['id']

const DISCOVERY_ARTIFACT_ID_ALIASES: Readonly<Record<string, DiscoveryArtifactId>> = {
  'requirement-research-report': 'research-report',
}

interface ArtifactDefinition {
  readonly id: DiscoveryArtifactId
  readonly title: string
  readonly path: string
  readonly required: boolean
  readonly purpose: string
  readonly source: DiscoverySourceAdapterSnapshot
  readonly markers: readonly string[]
}

const ARTIFACT_DEFINITIONS: Readonly<Record<DiscoveryArtifactId, ArtifactDefinition>> = {
  'research-report': {
    id: 'research-report', title: '现场观察记录', path: `${REQUIREMENT_ARTIFACT_ROOT}/requirement-research-report.md`, required: true,
    purpose: '记录人员陈述、代表案例、现场观察与未验证推断。',
    source: FDE_GUIDE_SOURCE('field-observation-log'),
    markers: ['## 来源事实', '## 代表案例', '## 现场观察', '## 未验证事项'],
  },
  'confirmation-checklist': {
    id: 'confirmation-checklist', title: '事实确认清单', path: `${REQUIREMENT_ARTIFACT_ROOT}/confirmation-checklist.md`, required: true,
    purpose: '集中管理待核对事实、证据来源、责任人和当前结论。',
    source: PRODUCT_SOURCE('fact-confirmation-list'),
    markers: ['## 待确认事项', '## 已确认事项', '## 决策权'],
  },
  'requirement-baseline': {
    id: 'requirement-baseline', title: '工作流章程', path: `${REQUIREMENT_ARTIFACT_ROOT}/requirement-baseline.md`, required: true,
    purpose: '冻结候选工作流、业务结果、边界、人工回退和停止条件。',
    source: FDE_GUIDE_SOURCE('workflow-charter'),
    markers: ['## 候选工作流', '## 业务结果', '## 现状基线', '## 范围与非目标', '## 人工回退', '## 停止条件'],
  },
  'engagement-reframe': {
    id: 'engagement-reframe', title: '项目重新界定记录', path: REFRAME_PATH, required: false,
    purpose: '仅在现场事实推翻原始边界、成功标准或停止条件时需要。',
    source: FDE_GUIDE_SOURCE('engagement-reframe'),
    markers: ['## 触发事实', '## 原边界', '## 新边界', '## 安全回退', '## 决策人'],
  },
}

interface ArtifactCatalogItem {
  readonly id: DiscoveryArtifactId
  readonly version: number
  readonly contentPath: string
  readonly sourceAdapter: DiscoverySourceAdapterSnapshot
  readonly structureState: DiscoveryStageArtifactSnapshot['structureState']
  readonly evidenceState: DiscoveryEvidenceState
  readonly evidenceRefs: readonly DiscoveryEvidenceReferenceSnapshot[]
}

interface ArtifactCatalogResult {
  readonly status: 'missing' | 'ready' | 'invalid'
  readonly items: ReadonlyMap<DiscoveryArtifactId, ArtifactCatalogItem>
  readonly message?: string
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function boundedText(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new Error(`${field} 必须是 1 至 ${String(max)} 字符的文本。`)
  }
  return value.trim()
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${field} 必须是最多 100 项的数组。`)
  return value.map((item, index) => boundedText(item, `${field}[${String(index)}]`, 1000))
}

function evidenceReference(value: unknown, field: string): DiscoveryEvidenceReferenceSnapshot {
  const item = record(value)
  if (item === undefined) throw new Error(`${field} 必须是对象。`)
  const state = item.state
  if (typeof state !== 'string' || !EVIDENCE_STATES.has(state as DiscoveryEvidenceState)) throw new Error(`${field}.state 无效。`)
  const kind = item.kind
  if (typeof kind !== 'string' || !EVIDENCE_KINDS.has(kind as DiscoveryEvidenceKind)) throw new Error(`${field}.kind 无效。`)
  return {
    id: boundedText(item.id, `${field}.id`, 200),
    state: state as DiscoveryEvidenceState,
    kind: kind as DiscoveryEvidenceKind,
    ref: boundedText(item.ref, `${field}.ref`, 1000),
    summary: boundedText(item.summary, `${field}.summary`, 1000),
  }
}

function evidenceReferences(
  value: unknown,
  field: string,
  referencedEvidence: ReadonlyMap<string, DiscoveryEvidenceReferenceSnapshot> = new Map(),
): readonly DiscoveryEvidenceReferenceSnapshot[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) {
    throw new Error(`${field} 必须包含 1 至 200 条逐条证据引用。`)
  }
  const items = value.map((item, index) => {
    if (typeof item !== 'string') return evidenceReference(item, `${field}[${String(index)}]`)
    const resolved = referencedEvidence.get(item)
    if (resolved === undefined) throw new Error(`${field}[${String(index)}] 未指向候选工作流中的已有证据。`)
    return resolved
  })
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error(`${field} 的 id 不能重复。`)
  return items
}

function workflowCandidate(value: unknown, index: number): DiscoveryWorkflowCandidateSnapshot {
  const item = record(value)
  if (item === undefined) throw new Error(`workflows[${String(index)}] 必须是对象。`)
  const disposition = item.disposition
  if (typeof disposition !== 'string' || !WORKFLOW_DISPOSITIONS.has(disposition as DiscoveryWorkflowDisposition)) {
    throw new Error(`workflows[${String(index)}].disposition 无效。`)
  }
  const refs = evidenceReferences(item.evidenceRefs, `workflows[${String(index)}].evidenceRefs`)
  return {
    id: boundedText(item.id, `workflows[${String(index)}].id`),
    title: boundedText(item.title, `workflows[${String(index)}].title`),
    actor: boundedText(item.actor, `workflows[${String(index)}].actor`),
    trigger: boundedText(item.trigger, `workflows[${String(index)}].trigger`),
    problem: boundedText(item.problem, `workflows[${String(index)}].problem`),
    disposition: disposition as DiscoveryWorkflowDisposition,
    evidence: {
      confirmed: refs.filter(ref => ref.state === 'confirmed').length,
      inferred: refs.filter(ref => ref.state === 'inferred').length,
      unverified: refs.filter(ref => ref.state === 'unverified').length,
    },
    evidenceRefs: refs,
  }
}

async function readDiscoveryJson(projectRoot: string, path: string): Promise<Record<string, unknown>> {
  const root = await realpath(resolve(projectRoot))
  const candidate = await realpath(join(projectRoot, path))
  if (!isInside(root, candidate)) throw new Error('发现阶段状态文件越过项目目录。')
  const value = await stat(candidate)
  if (!value.isFile()) throw new Error('发现阶段状态路径不是普通文件。')
  if (value.size > MAX_DISCOVERY_JSON_BYTES) throw new Error('发现阶段状态文件超过 256 KB。')
  const parsed = record(JSON.parse(await readFile(candidate, 'utf8')))
  if (parsed === undefined) throw new Error('发现阶段状态文件必须是 JSON 对象。')
  return parsed
}

async function loadWorkflowCatalog(projectRoot: string): Promise<DiscoveryWorkflowCatalogSnapshot> {
  const base = { path: WORKFLOW_CATALOG_PATH, items: [] as readonly DiscoveryWorkflowCandidateSnapshot[] }
  try {
    const parsed = await readDiscoveryJson(projectRoot, WORKFLOW_CATALOG_PATH)
    if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.workflows)) {
      throw new Error('候选工作流文件不符合 schemaVersion 2。')
    }
    if (parsed.workflows.length > 50) throw new Error('候选工作流不能超过 50 项。')
    const items = parsed.workflows.map(workflowCandidate)
    const ids = new Set(items.map(item => item.id))
    if (ids.size !== items.length) throw new Error('候选工作流 id 不能重复。')
    const selectedWorkflowId = parsed.selectedWorkflowId
    if (selectedWorkflowId !== undefined && (typeof selectedWorkflowId !== 'string' || !ids.has(selectedWorkflowId))) {
      throw new Error('selectedWorkflowId 必须指向一个已有候选工作流。')
    }
    return { path: WORKFLOW_CATALOG_PATH, status: 'ready', ...(selectedWorkflowId === undefined ? {} : { selectedWorkflowId }), items }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...base, status: 'missing' }
    return { ...base, status: 'invalid', message: error instanceof Error ? error.message : String(error) }
  }
}

function sourceAdapter(value: unknown, field: string): DiscoverySourceAdapterSnapshot {
  const item = record(value)
  if (item === undefined) throw new Error(`${field} 必须是对象。`)
  return {
    id: boundedText(item.id, `${field}.id`, 200),
    version: boundedText(item.version, `${field}.version`, 100),
    commit: boundedText(item.commit, `${field}.commit`, 100),
    license: boundedText(item.license, `${field}.license`, 100),
    artifact: boundedText(item.artifact, `${field}.artifact`, 200),
  }
}

function sameSource(actual: DiscoverySourceAdapterSnapshot, expected: DiscoverySourceAdapterSnapshot): boolean {
  return actual.id === expected.id
    && actual.version === expected.version
    && actual.commit === expected.commit
    && actual.license === expected.license
    && actual.artifact === expected.artifact
}

function artifactCatalogItem(
  value: unknown,
  index: number,
  referencedEvidence: ReadonlyMap<string, DiscoveryEvidenceReferenceSnapshot>,
): ArtifactCatalogItem {
  const item = record(value)
  if (item === undefined) throw new Error(`artifacts[${String(index)}] 必须是对象。`)
  const rawId = item.id
  if (typeof rawId !== 'string') throw new Error(`artifacts[${String(index)}].id 无效。`)
  const id = DISCOVERY_ARTIFACT_ID_ALIASES[rawId] ?? rawId
  if (!(id in ARTIFACT_DEFINITIONS)) throw new Error(`artifacts[${String(index)}].id 无效。`)
  const definition = ARTIFACT_DEFINITIONS[id as DiscoveryArtifactId]
  const version = item.version
  if (!Number.isSafeInteger(version) || Number(version) < 1) throw new Error(`artifacts[${String(index)}].version 必须是正整数。`)
  const contentPath = boundedText(item.contentPath, `artifacts[${String(index)}].contentPath`, 500)
  if (contentPath !== definition.path) throw new Error(`artifacts[${String(index)}].contentPath 与固定产物路径不一致。`)
  const structureState = item.structureState
  if (typeof structureState !== 'string' || !STRUCTURE_STATES.has(structureState as DiscoveryStageArtifactSnapshot['structureState'])) {
    throw new Error(`artifacts[${String(index)}].structureState 无效。`)
  }
  const evidenceState = item.evidenceState
  if (typeof evidenceState !== 'string' || !EVIDENCE_STATES.has(evidenceState as DiscoveryEvidenceState)) {
    throw new Error(`artifacts[${String(index)}].evidenceState 无效。`)
  }
  const adapter = sourceAdapter(item.sourceAdapter, `artifacts[${String(index)}].sourceAdapter`)
  if (!sameSource(adapter, definition.source)) throw new Error(`artifacts[${String(index)}].sourceAdapter 不是已审查的固定版本。`)
  stringList(item.inputRefs, `artifacts[${String(index)}].inputRefs`)
  stringList(item.decisionRefs, `artifacts[${String(index)}].decisionRefs`)
  if (item.supersedes !== null) stringList(item.supersedes, `artifacts[${String(index)}].supersedes`)
  return {
    id: id as DiscoveryArtifactId,
    version: Number(version),
    contentPath,
    sourceAdapter: adapter,
    structureState: structureState as DiscoveryStageArtifactSnapshot['structureState'],
    evidenceState: evidenceState as DiscoveryEvidenceState,
    evidenceRefs: evidenceReferences(item.evidenceRefs, `artifacts[${String(index)}].evidenceRefs`, referencedEvidence),
  }
}

async function loadArtifactCatalog(
  projectRoot: string,
  referencedEvidence: ReadonlyMap<string, DiscoveryEvidenceReferenceSnapshot>,
): Promise<ArtifactCatalogResult> {
  try {
    const parsed = await readDiscoveryJson(projectRoot, ARTIFACT_CATALOG_PATH)
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.artifacts)) throw new Error('Artifact Catalog 不符合 schemaVersion 1。')
    if (parsed.artifacts.length > 20) throw new Error('Artifact Catalog 不能超过 20 项。')
    const items = parsed.artifacts.map((item, index) => artifactCatalogItem(item, index, referencedEvidence))
    if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Artifact Catalog 的 id 不能重复。')
    return { status: 'ready', items: new Map(items.map(item => [item.id, item])) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing', items: new Map() }
    return { status: 'invalid', items: new Map(), message: error instanceof Error ? error.message : String(error) }
  }
}

async function contentStructureMessage(projectRoot: string, definition: ArtifactDefinition): Promise<string | undefined> {
  try {
    const root = await realpath(resolve(projectRoot))
    const candidate = await realpath(join(projectRoot, definition.path))
    if (!isInside(root, candidate)) return '产物越过项目目录。'
    const value = await stat(candidate)
    if (!value.isFile()) return '产物不是普通文件。'
    if (value.size > MAX_DISCOVERY_MARKDOWN_BYTES) return '产物超过 512 KB，无法执行结构校验。'
    const content = await readFile(candidate, 'utf8')
    const missing = definition.markers.filter(marker => !content.includes(marker))
    return missing.length === 0 ? undefined : `缺少最小章节：${missing.join('、')}。`
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function projectArtifact(
  projectRoot: string,
  base: RequirementArtifactSnapshot | undefined,
  definition: ArtifactDefinition,
  catalog: ArtifactCatalogResult,
): Promise<DiscoveryStageArtifactSnapshot> {
  let resolvedBase = base
  if (resolvedBase === undefined) {
    try {
      const root = await realpath(resolve(projectRoot))
      const candidate = await realpath(join(projectRoot, definition.path))
      if (!isInside(root, candidate)) throw new Error('阶段产物越过项目目录。')
      const value = await stat(candidate)
      if (!value.isFile()) throw new Error('阶段产物不是普通文件。')
      resolvedBase = {
        id: 'research-report',
        title: definition.title,
        path: definition.path,
        status: 'present',
        bytes: value.size,
        updatedAt: value.mtime.toISOString(),
      }
    } catch (error) {
      resolvedBase = {
        id: 'research-report',
        title: definition.title,
        path: definition.path,
        status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'error',
        ...(error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT' ? { message: error.message } : {}),
      }
    }
  }
  const status = resolvedBase.status
  const record = catalog.items.get(definition.id)
  const defaultStructure = definition.required ? 'missing' : 'not_applicable'
  if (status !== 'present') {
    return {
      ...definition,
      status,
      structureState: status === 'error' ? 'invalid' : defaultStructure,
      evidenceState: 'unverified',
      evidenceRefs: [],
      ...(resolvedBase.message === undefined ? {} : { message: resolvedBase.message }),
    }
  }
  if (catalog.status !== 'ready') {
    return {
      ...resolvedBase, ...definition, status: 'present', structureState: 'invalid', evidenceState: 'unverified', evidenceRefs: [],
      message: catalog.status === 'missing' ? '文件已存在，但尚未登记 Artifact 来源、版本、结构与证据。' : `Artifact Catalog 无效：${catalog.message ?? '未知错误'}。`,
    }
  }
  if (record === undefined) {
    return { ...resolvedBase, ...definition, status: 'present', structureState: 'invalid', evidenceState: 'unverified', evidenceRefs: [], message: '文件已存在，但 Artifact Catalog 没有匹配记录。' }
  }
  const contentMessage = await contentStructureMessage(projectRoot, definition)
  const claimedReady = record.structureState === 'starter_valid' || record.structureState === 'complete_valid'
  return {
    ...resolvedBase,
    ...definition,
    status: 'present',
    version: record.version,
    sourceAdapter: record.sourceAdapter,
    structureState: contentMessage === undefined && claimedReady ? record.structureState : 'invalid',
    evidenceState: record.evidenceState,
    evidenceRefs: record.evidenceRefs,
    ...(contentMessage === undefined && claimedReady ? {} : { message: contentMessage ?? 'Artifact Catalog 尚未把该产物标为 starter_valid 或 complete_valid。' }),
  }
}

/**
 * Project the stage-one fixed files and structured contracts into one trusted business model.
 * @param projectRoot - canonical project root.
 * @param requirements - trusted fixed requirement-artifact snapshot.
 * @returns deterministic routing, evidence, maturity, work and manual-review readiness.
 */
export async function loadDiscoveryStage(
  projectRoot: string,
  requirements: RequirementArtifactsSnapshot,
): Promise<DiscoveryStageSnapshot> {
  const workflows = await loadWorkflowCatalog(projectRoot)
  const referencedEvidence = new Map(workflows.items.flatMap(item => item.evidenceRefs).map(item => [item.id, item]))
  const artifactCatalog = await loadArtifactCatalog(projectRoot, referencedEvidence)
  const requirementById = new Map(requirements.artifacts.map(item => [item.id, item]))
  const artifacts = await Promise.all((Object.values(ARTIFACT_DEFINITIONS) as ArtifactDefinition[]).map(
    async definition => await projectArtifact(projectRoot, requirementById.get(definition.id as RequirementArtifactSnapshot['id']), definition, artifactCatalog),
  ))
  const mature = (artifact: DiscoveryStageArtifactSnapshot): boolean => artifact.status === 'present'
    && (artifact.structureState === 'starter_valid' || artifact.structureState === 'complete_valid')
    && artifact.evidenceRefs.length > 0
  const presentCount = artifacts.filter(artifact => artifact.required && mature(artifact)).length
  const currentIndex = presentCount === 0 ? 0 : presentCount === 1 ? 1 : presentCount === 2 ? 2 : 3
  const reviewReady = presentCount === requirements.requiredCount && workflows.status === 'ready' && workflows.items.length > 0
  const status = reviewReady ? 'ready-for-review' : presentCount === 0 ? 'collecting' : presentCount === 1 ? 'understanding' : 'qualifying'
  const blockers = artifacts
    .filter(artifact => artifact.required && !mature(artifact))
    .map(artifact => artifact.status === 'missing'
      ? `尚未形成“${artifact.title}”候选版。`
      : artifact.message ?? `“${artifact.title}”尚未达到可评审的结构与证据状态。`)
  if (workflows.status === 'missing') blockers.push('尚未形成带逐条证据引用的候选工作流。')
  if (workflows.status === 'invalid') blockers.push(`候选工作流结构无效：${workflows.message ?? '未知错误'}。`)
  if (workflows.status === 'ready' && workflows.items.length === 0) blockers.push('候选工作流仍为空，尚不能提交阶段评审。')
  return {
    question: '哪个真实工作流问题值得继续解决？',
    status,
    currentWorkId: WORK_ITEMS[currentIndex]!.id,
    workItems: WORK_ITEMS.map((item, index) => ({
      ...item,
      status: reviewReady || index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'waiting',
    })),
    workflows,
    route: DISCOVERY_CAPABILITY_ROUTE,
    artifacts,
    requiredCount: requirements.requiredCount,
    presentCount,
    reviewReady,
    blockers,
  }
}

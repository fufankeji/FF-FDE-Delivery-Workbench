/** Read-only business surfaces for V2 lifecycle stages two through eight. */

import { readFile, realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type {
  V2DesignSnapshot,
  V2InvestigationSnapshot,
  V2KnowledgeGraphSnapshot,
  V2LifecycleStageId,
  V2SemanticWorkspaceSnapshot,
  V2StageArtifactSnapshot,
  V2StageSurfaceSnapshot,
} from './types.ts'

const MAX_STATE_BYTES = 256 * 1024
const DESIGN_GRAPH_PATH = '.fde/design/knowledge-graph.json' as const
const MAX_GRAPH_BYTES = 2 * 1024 * 1024
const MAX_GRAPH_NODES = 500
const MAX_GRAPH_EDGES = 1_500
const MAX_GRAPH_COMMUNITIES = 100
const SEMANTIC_WORKSPACE_PATH = '.fde/design/semantica/workspace.json' as const
const MAX_SEMANTIC_WORKSPACE_BYTES = 4 * 1024 * 1024
const MAX_SEMANTIC_SOURCES = 40
const MAX_SEMANTIC_DEFINITIONS = 500
const MAX_SEMANTIC_CANDIDATES = 500
const MAX_SEMANTIC_RUNS = 80

interface StageDefinition {
  readonly id: V2LifecycleStageId
  readonly index: number
  readonly title: string
  readonly objective: string
  readonly explanation: string
  readonly statePath: string
  readonly skill: string
  readonly prompt: string
  readonly workItems: readonly { readonly id: string; readonly title: string; readonly purpose: string }[]
  readonly artifacts: readonly {
    readonly id: string
    readonly title: string
    readonly path: string
    readonly purpose: string
    readonly required: boolean
  }[]
}

/** Product-owned stage definitions shared by Host state and the guided workbench. */
export const V2_STAGE_DEFINITIONS: readonly StageDefinition[] = [
  {
    id: 'definition', index: 2, title: '定义结果、范围与责任',
    objective: '把要取得的业务结果、这次做到哪里、由谁决定和何时停止说清楚。',
    explanation: '从已经确认的真实流程出发，建立当前基线、成功标准、交付边界、责任人和继续或停止条件。',
    statePath: '.fde/stages/definition.json', skill: 'engineer-ai-value',
    prompt: '请基于第一阶段已经确认的业务流程，帮我定义本项目的业务结果、当前基线、成功标准、交付范围、非目标、责任人和停止条件，并形成第二阶段的固定记录。不要代替 FDE 确认结论。',
    workItems: [
      { id: 'baseline', title: '建立当前基线', purpose: '记录现在的结果、成本、时长和主要问题。' },
      { id: 'outcome', title: '明确成功标准', purpose: '说清楚取得什么结果才算成功，如何衡量。' },
      { id: 'scope', title: '划定交付边界', purpose: '明确本次做什么、不做什么，以及何时停止或调整。' },
      { id: 'ownership', title: '确认责任与计划', purpose: '明确决定人、执行人、客户配合事项和交付节奏。' },
    ],
    artifacts: [
      { id: 'outcome-contract', title: '业务结果与范围约定', path: 'fde-deliverables/02-outcome-scope/outcome-contract.md', purpose: '记录结果、范围、非目标、责任人和停止条件。', required: true },
      { id: 'value-case', title: '价值测算记录', path: 'fde-deliverables/02-outcome-scope/value-case.md', purpose: '记录当前基线、预期收益、成本和继续投入条件。', required: true },
      { id: 'delivery-plan', title: '交付计划', path: 'fde-deliverables/02-outcome-scope/delivery-plan.md', purpose: '记录阶段安排、依赖、客户配合和决策节点。', required: true },
    ],
  },
  {
    id: 'investigation', index: 3, title: '调查数据、系统、接口、安全与组织',
    objective: '弄清客户现场允许做什么、现有条件能支持什么、还缺什么。',
    explanation: '核对数据质量、系统边界、接口能力、访问权限、审批流程和真实负责人，不在未知条件上设计方案。',
    statePath: '.fde/stages/investigation.json', skill: 'fde-investigate-environment',
    prompt: '请根据已确认的业务结果和当前项目资料，调查数据、系统、接口、访问权限、安全要求和组织责任，标出已确认事实、缺口、风险与待客户补充事项，并形成第三阶段固定记录。',
    workItems: [
      { id: 'data', title: '检查数据条件', purpose: '确认数据来源、质量、规模、敏感性和可取得方式。' },
      { id: 'systems', title: '梳理系统与接口', purpose: '确认现有系统、调用链、接口限制和变更落点。' },
      { id: 'access', title: '核对权限与安全', purpose: '确认账号、权限、隐私、安全和法务要求。' },
      { id: 'owners', title: '确认现场责任人', purpose: '确认系统负责人、审批人、业务专家和等待事项。' },
    ],
    artifacts: [
      { id: 'data-readiness', title: '数据可用性评估', path: 'fde-deliverables/03-environment/data-readiness.md', purpose: '记录数据来源、质量、敏感性、缺口和取得条件。', required: true },
      { id: 'system-access-map', title: '系统与访问清单', path: 'fde-deliverables/03-environment/system-access-map.md', purpose: '记录系统、接口、账号、权限和实际负责人。', required: true },
      { id: 'governance-review', title: '安全与治理核对记录', path: 'fde-deliverables/03-environment/governance-review.md', purpose: '记录安全、隐私、法务、审批和人工升级路径。', required: true },
    ],
  },
  {
    id: 'design', index: 4, title: '设计方案并完成端到端纵向切片',
    objective: '选择最合适的实现方式，并先走通一条可以验证的完整业务链路。',
    explanation: '比较规则、传统软件、检索、模型和 Agent 等方式，明确系统边界、工具权限、失败回退并完成最小纵向切片。',
    statePath: '.fde/stages/design.json', skill: 'fde-design-vertical-slice',
    prompt: '请根据前三阶段的已确认事实，比较可行的实现方式，形成推荐方案、系统边界、工具和权限设计、失败回退方式，并规划一条可运行的端到端纵向切片。不要把候选方案写成已确认结论。',
    workItems: [
      { id: 'mechanism', title: '选择实现方式', purpose: '比较规则、软件、检索、模型、Agent 与人工处理。' },
      { id: 'architecture', title: '明确系统边界', purpose: '说明系统、数据、工具、权限和人工审批如何协作。' },
      { id: 'slice', title: '走通纵向切片', purpose: '先打通一个从输入到结果的完整业务链路。' },
      { id: 'decision', title: '核对方案决定', purpose: '记录方案取舍、风险、待确认事项和下一步。' },
    ],
    artifacts: [
      { id: 'mechanism-selection', title: '实现方式选择记录', path: 'fde-deliverables/04-solution-design/mechanism-selection.md', purpose: '记录比较过的方案、选择理由和不采用项。', required: true },
      { id: 'solution-design', title: '生产方案设计', path: 'fde-deliverables/04-solution-design/solution-design.md', purpose: '记录系统边界、工具、权限、回退和关键合同。', required: true },
      { id: 'vertical-slice-record', title: '纵向切片验证记录', path: 'fde-deliverables/04-solution-design/vertical-slice-record.md', purpose: '记录端到端最小链路、运行结果和未解决问题。', required: true },
    ],
  },
  {
    id: 'evaluation', index: 5, title: '运行 PoC 与 Eval',
    objective: '用真实案例和明确指标，证明关键假设是否成立。',
    explanation: '把成功标准映射成测试用例、数据集、阈值和证据，运行验证并如实记录通过、警告和失败。',
    statePath: '.fde/stages/evaluation.json', skill: 'fde-run-poc-eval',
    prompt: '请根据已确认的成功标准和当前候选方案，设计并运行最小 PoC 与 Eval。建立真实案例、边界案例、指标、阈值和证据关系，如实记录未运行、失败和需要人工确认的项目。',
    workItems: [
      { id: 'plan', title: '制定验证计划', purpose: '把每条成功标准映射到用例、数据和证据。' },
      { id: 'cases', title: '准备测试案例', purpose: '准备真实、边界、对抗和失败回退案例。' },
      { id: 'run', title: '运行 PoC 与 Eval', purpose: '执行验证并保存每项结果和可追溯证据。' },
      { id: 'conclusion', title: '形成验证结论', purpose: '说明哪些假设成立、哪些失败以及是否继续。' },
    ],
    artifacts: [
      { id: 'evaluation-plan', title: '验证计划', path: 'fde-deliverables/05-poc-eval/evaluation-plan.md', purpose: '记录用例、数据集、指标、阈值和证据要求。', required: true },
      { id: 'evaluation-report', title: '验证报告', path: 'fde-deliverables/05-poc-eval/evaluation-report.md', purpose: '记录真实运行结果、失败、警告和证据。', required: true },
      { id: 'evaluation-baseline', title: '验证基线', path: 'fde-deliverables/05-poc-eval/evaluation-baseline.md', purpose: '冻结本轮候选版本、环境、数据和可比较结果。', required: true },
    ],
  },
  {
    id: 'pilot', index: 6, title: '企业集成、可靠性改造与受控 Pilot',
    objective: '把已验证能力接入客户现场，在有限范围内稳定运行。',
    explanation: '完成真实系统集成、权限与审计、可靠性改造、运行手册和回滚准备，再经授权进入受控试点。',
    statePath: '.fde/stages/pilot.json', skill: 'fde-integration-pilot',
    prompt: '请基于已通过的 PoC 与 Eval，规划并记录企业系统集成、权限审计、可靠性改造和受控 Pilot。任何真实部署或外部写入都必须等待 FDE 明确授权，并保存运行与回滚证据。',
    workItems: [
      { id: 'integration', title: '完成企业集成', purpose: '接入真实系统、数据、身份和审批链路。' },
      { id: 'reliability', title: '补齐可靠性', purpose: '处理监控、降级、恢复、审计和成本边界。' },
      { id: 'readiness', title: '确认试点准备', purpose: '核对范围、人员、环境、风险和回滚条件。' },
      { id: 'pilot', title: '运行受控试点', purpose: '在明确范围内运行，记录业务结果和现场问题。' },
    ],
    artifacts: [
      { id: 'pilot-scope', title: '试点范围与授权', path: 'fde-deliverables/06-pilot/pilot-scope.md', purpose: '记录试点对象、边界、授权、成功和停止条件。', required: true },
      { id: 'pilot-runbook', title: '试点运行与回滚手册', path: 'fde-deliverables/06-pilot/pilot-runbook.md', purpose: '记录启动、监控、异常、回滚和责任人。', required: true },
      { id: 'pilot-report', title: '试点结果记录', path: 'fde-deliverables/06-pilot/pilot-report.md', purpose: '记录真实运行、用户反馈、问题和处理决定。', required: true },
    ],
  },
  {
    id: 'production', index: 7, title: '进入生产、推动采用并验收交接',
    objective: '让系统在生产环境持续产生业务结果，并把责任真正交给客户团队。',
    explanation: '完成生产就绪审查、受控发布、观察期、用户采用、客户验收、培训和运维责任移交。',
    statePath: '.fde/stages/production.json', skill: 'fde-production-handover',
    prompt: '请根据试点结果准备生产发布、观察期、用户采用、客户验收和责任移交材料。只记录已有证据；客户接受、生产授权、培训完成和责任转移必须由 FDE 人工记录。',
    workItems: [
      { id: 'readiness', title: '审查生产就绪', purpose: '核对发布、监控、容量、安全、回滚和责任人。' },
      { id: 'release', title: '受控进入生产', purpose: '按授权窗口发布并保存变更与回滚证据。' },
      { id: 'adoption', title: '推动使用与验收', purpose: '记录用户采用、业务结果、反馈和验收结论。' },
      { id: 'handover', title: '完成责任交接', purpose: '完成培训、访问权限和运维责任转移。' },
    ],
    artifacts: [
      { id: 'production-review', title: '生产就绪与发布记录', path: 'fde-deliverables/07-production-handover/production-review.md', purpose: '记录生产检查、授权、发布、观察和回滚情况。', required: true },
      { id: 'customer-acceptance', title: '客户验收记录', path: 'fde-deliverables/07-production-handover/customer-acceptance.md', purpose: '记录验收范围、证据、条件项和客户决定。', required: true },
      { id: 'handover-record', title: '培训与责任移交记录', path: 'fde-deliverables/07-production-handover/handover-record.md', purpose: '记录培训、账号权限、运维责任和未决事项。', required: true },
    ],
  },
  {
    id: 'improvement', index: 8, title: '持续改进并沉淀可复用能力',
    objective: '把生产证据转成经过验证的改进，并沉淀下一次可复用的能力。',
    explanation: '根据业务指标、运行事件、用户反馈和成本证据选择改进项，受控发布并判断哪些现场经验值得复用。',
    statePath: '.fde/stages/improvement.json', skill: 'fde-continuous-improvement',
    prompt: '请根据生产运行证据、业务指标、事故、用户反馈和成本记录，选择本轮最值得做的改进，说明验证方法与发布边界，并记录哪些现场经验可以沉淀为可复用能力。',
    workItems: [
      { id: 'evidence', title: '汇总生产证据', purpose: '汇总业务结果、运行指标、问题、反馈和成本。' },
      { id: 'prioritize', title: '选择改进事项', purpose: '按影响、风险和证据选择本轮改进，明确不做项。' },
      { id: 'validate', title: '验证并受控发布', purpose: '先测试改进，再按边界发布并观察结果。' },
      { id: 'productize', title: '沉淀可复用能力', purpose: '记录可复用模板、工具、方法和适用边界。' },
    ],
    artifacts: [
      { id: 'field-learning-register', title: '现场经验登记', path: 'fde-deliverables/08-improvement/field-learning-register.md', purpose: '记录现场问题、证据、通用性和复用边界。', required: true },
      { id: 'improvement-record', title: '改进与验证记录', path: 'fde-deliverables/08-improvement/improvement-record.md', purpose: '记录改进内容、测试、指标变化和结果。', required: true },
      { id: 'controlled-release-record', title: '受控发布记录', path: 'fde-deliverables/08-improvement/controlled-release-record.md', purpose: '记录发布范围、观察、回滚和后续决定。', required: true },
    ],
  },
] as const

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

async function inspectArtifact(root: string, definition: StageDefinition['artifacts'][number]): Promise<V2StageArtifactSnapshot> {
  try {
    const info = await stat(join(root, definition.path))
    if (!info.isFile()) throw new Error('固定产物路径不是普通文件。')
    return { ...definition, status: 'present', bytes: info.size, updatedAt: info.mtime.toISOString() }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...definition, status: 'missing' }
    return { ...definition, status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

async function readState(root: string, definition: StageDefinition): Promise<{ status: 'missing' | 'ready' | 'invalid'; value?: Record<string, unknown>; message?: string }> {
  try {
    const path = join(root, definition.statePath)
    const info = await stat(path)
    if (!info.isFile() || info.size > MAX_STATE_BYTES) throw new Error('阶段状态文件不是普通 JSON，或超过 256 KiB。')
    const value = asRecord(JSON.parse(await readFile(path, 'utf8')) as unknown)
    if (value === undefined) throw new Error('根对象必须是 JSON 对象。')
    if (value.schemaVersion !== 1) throw new Error('schemaVersion 必须是 1。')
    if (value.stage !== definition.id) throw new Error(`stage 必须是 ${definition.id}。`)
    if (stageStatus(value.status) === undefined) throw new Error('status 必须是 working、blocked 或 review-ready。')

    if (!Array.isArray(value.workItems)) throw new Error('workItems 必须是数组，不能写成对象映射。')
    const expectedWorkIds = new Set(definition.workItems.map(item => item.id))
    const foundWorkIds = new Set<string>()
    for (const raw of value.workItems) {
      const item = asRecord(raw)
      if (item === undefined || typeof item.id !== 'string' || !expectedWorkIds.has(item.id)) {
        throw new Error('workItems 包含未知或无效的固定工作项 ID。')
      }
      if (foundWorkIds.has(item.id)) throw new Error(`workItems 中的 ${item.id} 重复。`)
      if (workStatus(item.status) === undefined) throw new Error(`workItems.${item.id}.status 无效。`)
      foundWorkIds.add(item.id)
    }
    const missingWorkIds = definition.workItems.filter(item => !foundWorkIds.has(item.id)).map(item => item.id)
    if (missingWorkIds.length > 0) throw new Error(`workItems 缺少固定工作项：${missingWorkIds.join('、')}。`)

    if (!Array.isArray(value.blockers)) throw new Error('blockers 必须是数组。')
    const blockerIds = new Set<string>()
    for (const raw of value.blockers) {
      const blocker = asRecord(raw)
      if (blocker === undefined || typeof blocker.id !== 'string' || blocker.id.trim() === '') {
        throw new Error('blockers 每项必须包含非空 id。')
      }
      if (blockerIds.has(blocker.id)) throw new Error(`blockers 中的 ${blocker.id} 重复。`)
      if (typeof blocker.title !== 'string' || blocker.title.trim() === '') throw new Error(`blockers.${blocker.id}.title 必须是非空字符串。`)
      if (blocker.severity !== 'low' && blocker.severity !== 'medium' && blocker.severity !== 'high' && blocker.severity !== 'critical') {
        throw new Error(`blockers.${blocker.id}.severity 无效。`)
      }
      if (blocker.status !== 'open' && blocker.status !== 'resolved') throw new Error(`blockers.${blocker.id}.status 无效。`)
      blockerIds.add(blocker.id)
    }
    if (recommendationStatus(value.recommendation) === undefined) {
      throw new Error('recommendation 必须是 pending、go、revise、narrow 或 stop。')
    }
    if (definition.id === 'investigation') parseInvestigation(value.investigation)
    if (definition.id === 'design') parseDesign(value.design)
    return { status: 'ready', value }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' }
    return { status: 'invalid', message: error instanceof Error ? error.message : String(error) }
  }
}

function stageStatus(value: unknown): 'working' | 'blocked' | 'review-ready' | undefined {
  return value === 'working' || value === 'blocked' || value === 'review-ready' ? value : undefined
}

function workStatus(value: unknown): 'complete' | 'current' | 'waiting' | 'blocked' | undefined {
  return value === 'complete' || value === 'current' || value === 'waiting' || value === 'blocked' ? value : undefined
}

function recommendationStatus(value: unknown): V2StageSurfaceSnapshot['recommendation'] | undefined {
  return value === 'pending' || value === 'go' || value === 'revise' || value === 'narrow' || value === 'stop' ? value : undefined
}

function recommendation(value: unknown): V2StageSurfaceSnapshot['recommendation'] {
  return recommendationStatus(value) ?? 'pending'
}

function requiredText(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path}.${key} 必须是非空字符串。`)
  return value
}

function optionalText(record: Record<string, unknown>, key: string, path: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path}.${key} 必须是非空字符串。`)
  return value
}

function investigationStatus(value: unknown): 'confirmed' | 'conditional' | 'pending' | 'blocked' | undefined {
  return value === 'confirmed' || value === 'conditional' || value === 'pending' || value === 'blocked' ? value : undefined
}

function actionBoundaryStatus(value: unknown): 'allowed' | 'conditional' | 'pending' | 'denied' | 'not-applicable' | undefined {
  return value === 'allowed' || value === 'conditional' || value === 'pending' || value === 'denied' || value === 'not-applicable' ? value : undefined
}

function parseInvestigation(value: unknown): V2InvestigationSnapshot | undefined {
  if (value === undefined) return undefined
  const record = asRecord(value)
  if (record === undefined) throw new Error('investigation 必须是 JSON 对象。')
  for (const key of ['systems', 'connections', 'actionBoundaries', 'dataFindings', 'governanceReviews']) {
    if (!Array.isArray(record[key])) throw new Error(`investigation.${key} 必须是数组。`)
  }

  const systemIds = new Set<string>()
  const systems = (record.systems as unknown[]).map((raw, index): V2InvestigationSnapshot['systems'][number] => {
    const path = `investigation.systems[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const id = requiredText(item, 'id', path)
    if (systemIds.has(id)) throw new Error(`investigation.systems 中的 ${id} 重复。`)
    if (item.kind !== 'data' && item.kind !== 'system' && item.kind !== 'external' && item.kind !== 'actor') throw new Error(`${path}.kind 无效。`)
    const status = investigationStatus(item.status)
    if (status === undefined) throw new Error(`${path}.status 无效。`)
    const owner = optionalText(item, 'owner', path)
    const note = optionalText(item, 'note', path)
    systemIds.add(id)
    return {
      id,
      label: requiredText(item, 'label', path),
      kind: item.kind,
      status,
      ...(owner === undefined ? {} : { owner }),
      ...(note === undefined ? {} : { note }),
    }
  })

  const connections = (record.connections as unknown[]).map((raw, index) => {
    const path = `investigation.connections[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const from = requiredText(item, 'from', path)
    const to = requiredText(item, 'to', path)
    if (!systemIds.has(from) || !systemIds.has(to)) throw new Error(`${path} 必须引用已登记的系统节点。`)
    const label = optionalText(item, 'label', path)
    return { from, to, ...(label === undefined ? {} : { label }) }
  })

  const actionBoundaries = (record.actionBoundaries as unknown[]).map((raw, index) => {
    const path = `investigation.actionBoundaries[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const read = actionBoundaryStatus(item.read)
    const suggest = actionBoundaryStatus(item.suggest)
    const draft = actionBoundaryStatus(item.draft)
    const execute = actionBoundaryStatus(item.execute)
    if (read === undefined || suggest === undefined || draft === undefined || execute === undefined) throw new Error(`${path} 包含无效动作边界状态。`)
    return { target: requiredText(item, 'target', path), read, suggest, draft, execute }
  })

  const dataFindings = (record.dataFindings as unknown[]).map((raw, index): V2InvestigationSnapshot['dataFindings'][number] => {
    const path = `investigation.dataFindings[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const status = item.status
    if (status !== 'confirmed' && status !== 'warning' && status !== 'pending' && status !== 'blocked') throw new Error(`${path}.status 无效。`)
    return { label: requiredText(item, 'label', path), value: requiredText(item, 'value', path), status }
  })

  const governanceReviews = (record.governanceReviews as unknown[]).map((raw, index): V2InvestigationSnapshot['governanceReviews'][number] => {
    const path = `investigation.governanceReviews[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const area = item.area
    if (area !== 'security' && area !== 'privacy' && area !== 'legal' && area !== 'procurement' && area !== 'finance' && area !== 'business') throw new Error(`${path}.area 无效。`)
    const status = investigationStatus(item.status)
    if (status === undefined) throw new Error(`${path}.status 无效。`)
    const owner = optionalText(item, 'owner', path)
    const note = optionalText(item, 'note', path)
    return { area, status, ...(owner === undefined ? {} : { owner }), ...(note === undefined ? {} : { note }) }
  })

  return { systems, connections, actionBoundaries, dataFindings, governanceReviews }
}

type ParsedDesignState = Omit<V2DesignSnapshot, 'graph' | 'workspace'> & {
  readonly graphBuildStatus: V2DesignSnapshot['graph']['buildStatus']
  readonly graphBuildMessage?: string
}

function optionalCount(record: Record<string, unknown>, key: string, path: string): number | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100_000) {
    throw new Error(`${path}.${key} 必须是非负整数。`)
  }
  return value as number
}

function parseDesign(value: unknown): ParsedDesignState | undefined {
  if (value === undefined) return undefined
  const record = asRecord(value)
  if (record === undefined) throw new Error('design 必须是 JSON 对象。')
  const execution = asRecord(record.execution)
  const semantics = asRecord(record.semantics)
  const ontology = asRecord(record.ontology)
  const graphBuild = asRecord(record.graphBuild)
  if (execution === undefined || semantics === undefined || ontology === undefined || graphBuild === undefined) {
    throw new Error('design 必须包含 execution、semantics、ontology 和 graphBuild。')
  }

  const executionStatus = execution.status
  if (executionStatus !== 'undecided' && executionStatus !== 'candidate' && executionStatus !== 'selected') {
    throw new Error('design.execution.status 无效。')
  }
  const mechanism = execution.mechanism
  if (mechanism !== undefined && mechanism !== 'manual' && mechanism !== 'rules' && mechanism !== 'software'
    && mechanism !== 'retrieval' && mechanism !== 'model' && mechanism !== 'agent' && mechanism !== 'hybrid') {
    throw new Error('design.execution.mechanism 无效。')
  }
  if (executionStatus !== 'undecided' && mechanism === undefined) {
    throw new Error('design.execution 已形成候选时必须包含 mechanism。')
  }
  const executionLabel = optionalText(execution, 'label', 'design.execution')
  const executionRationale = optionalText(execution, 'rationale', 'design.execution')

  const semanticMode = semantics.mode
  if (semanticMode !== 'undecided' && semanticMode !== 'schema' && semanticMode !== 'ontology') {
    throw new Error('design.semantics.mode 无效。')
  }
  const semanticConclusion = semantics.conclusion
  if (semanticConclusion !== 'pending' && semanticConclusion !== 'not_required' && semanticConclusion !== 'validated'
    && semanticConclusion !== 'validation_failed' && semanticConclusion !== 'insufficient_evidence') {
    throw new Error('design.semantics.conclusion 无效。')
  }
  if (semanticMode === 'schema' && semanticConclusion !== 'pending' && semanticConclusion !== 'not_required') {
    throw new Error('普通 Schema 路线的本体机制结论只能是 pending 或 not_required。')
  }
  if (semanticMode !== 'ontology' && (semanticConclusion === 'validated' || semanticConclusion === 'validation_failed')) {
    throw new Error('只有本体路线可以记录 validated 或 validation_failed。')
  }
  const semanticRationale = optionalText(semantics, 'rationale', 'design.semantics')

  const ontologyStatus = ontology.status
  if (ontologyStatus !== 'not_applicable' && ontologyStatus !== 'not_started' && ontologyStatus !== 'draft'
    && ontologyStatus !== 'review' && ontologyStatus !== 'published' && ontologyStatus !== 'stale') {
    throw new Error('design.ontology.status 无效。')
  }
  if (semanticMode !== 'ontology' && ontologyStatus !== 'not_applicable') {
    throw new Error('未选择本体路线时 design.ontology.status 必须是 not_applicable。')
  }
  const ontologyVersion = optionalText(ontology, 'schemaVersion', 'design.ontology')
  const classCount = optionalCount(ontology, 'classCount', 'design.ontology')
  const relationshipTypeCount = optionalCount(ontology, 'relationshipTypeCount', 'design.ontology')

  const graphBuildStatus = graphBuild.status
  if (graphBuildStatus !== 'not_applicable' && graphBuildStatus !== 'waiting' && graphBuildStatus !== 'running'
    && graphBuildStatus !== 'succeeded' && graphBuildStatus !== 'failed' && graphBuildStatus !== 'cancelled'
    && graphBuildStatus !== 'stale') {
    throw new Error('design.graphBuild.status 无效。')
  }
  if (semanticMode !== 'ontology' && graphBuildStatus !== 'not_applicable') {
    throw new Error('未选择本体路线时 design.graphBuild.status 必须是 not_applicable。')
  }

  const graphBuildMessage = optionalText(graphBuild, 'message', 'design.graphBuild')
  return {
    execution: {
      status: executionStatus,
      ...(mechanism === undefined ? {} : { mechanism }),
      ...(executionLabel === undefined ? {} : { label: executionLabel }),
      ...(executionRationale === undefined ? {} : { rationale: executionRationale }),
    },
    semantics: {
      mode: semanticMode,
      conclusion: semanticConclusion,
      ...(semanticRationale === undefined ? {} : { rationale: semanticRationale }),
    },
    ontology: {
      status: ontologyStatus,
      ...(ontologyVersion === undefined ? {} : { schemaVersion: ontologyVersion }),
      ...(classCount === undefined ? {} : { classCount }),
      ...(relationshipTypeCount === undefined ? {} : { relationshipTypeCount }),
    },
    graphBuildStatus,
    ...(graphBuildMessage === undefined ? {} : { graphBuildMessage }),
  }
}

function boundedText(record: Record<string, unknown>, key: string, path: string, max = 240): string {
  const value = requiredText(record, key, path).trim()
  if (value.length > max) throw new Error(`${path}.${key} 不能超过 ${String(max)} 个字符。`)
  return value
}

function optionalBoundedText(record: Record<string, unknown>, key: string, path: string, max = 600): string | undefined {
  const value = optionalText(record, key, path)?.trim()
  if (value !== undefined && value.length > max) throw new Error(`${path}.${key} 不能超过 ${String(max)} 个字符。`)
  return value
}

function optionalConfidence(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} 必须是 0 到 1 之间的数字。`)
  }
  return value
}

function optionalDate(record: Record<string, unknown>, key: string, path: string): string | undefined {
  const value = optionalBoundedText(record, key, path, 80)
  if (value !== undefined && !Number.isFinite(Date.parse(value))) throw new Error(`${path}.${key} 必须是有效日期时间。`)
  return value
}

function stringList(value: unknown, path: string, maxItems = 32): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${path} 必须是最多 ${String(maxItems)} 项的字符串数组。`)
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim() === '' || item.length > 500) {
      throw new Error(`${path}[${String(index)}] 必须是 1 到 500 个字符的字符串。`)
    }
    return item.trim()
  })
}

function parseKnowledgeGraph(value: unknown): V2KnowledgeGraphSnapshot {
  const record = asRecord(value)
  if (record === undefined) throw new Error('知识图谱快照根对象必须是 JSON 对象。')
  if (record.schemaVersion !== 1) throw new Error('知识图谱快照 schemaVersion 必须是 1。')
  const provider = asRecord(record.provider)
  if (provider === undefined) throw new Error('知识图谱快照 provider 必须是 JSON 对象。')
  if (!Array.isArray(record.nodes) || record.nodes.length > MAX_GRAPH_NODES) {
    throw new Error(`知识图谱快照 nodes 必须是最多 ${String(MAX_GRAPH_NODES)} 项的数组。`)
  }
  if (!Array.isArray(record.edges) || record.edges.length > MAX_GRAPH_EDGES) {
    throw new Error(`知识图谱快照 edges 必须是最多 ${String(MAX_GRAPH_EDGES)} 项的数组。`)
  }
  if (!Array.isArray(record.communities) || record.communities.length > MAX_GRAPH_COMMUNITIES) {
    throw new Error(`知识图谱快照 communities 必须是最多 ${String(MAX_GRAPH_COMMUNITIES)} 项的数组。`)
  }

  const nodeIds = new Set<string>()
  const nodes = record.nodes.map((raw, index): V2KnowledgeGraphSnapshot['nodes'][number] => {
    const path = `nodes[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const id = boundedText(item, 'id', path, 200)
    if (nodeIds.has(id)) throw new Error(`知识图谱节点 ${id} 重复。`)
    nodeIds.add(id)
    const summary = optionalBoundedText(item, 'summary', path, 1_200)
    const communityId = optionalBoundedText(item, 'communityId', path, 200)
    const confidence = optionalConfidence(item.confidence, `${path}.confidence`)
    const validFrom = optionalDate(item, 'validFrom', path)
    const validUntil = optionalDate(item, 'validUntil', path)
    return {
      id,
      label: boundedText(item, 'label', path, 240),
      type: boundedText(item, 'type', path, 160),
      ...(summary === undefined ? {} : { summary }),
      ...(communityId === undefined ? {} : { communityId }),
      ...(confidence === undefined ? {} : { confidence }),
      ...(validFrom === undefined ? {} : { validFrom }),
      ...(validUntil === undefined ? {} : { validUntil }),
      sourceRefs: stringList(item.sourceRefs, `${path}.sourceRefs`),
    }
  })

  const edgeIds = new Set<string>()
  const edges = record.edges.map((raw, index): V2KnowledgeGraphSnapshot['edges'][number] => {
    const path = `edges[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const id = boundedText(item, 'id', path, 200)
    if (edgeIds.has(id)) throw new Error(`知识图谱关系 ${id} 重复。`)
    edgeIds.add(id)
    const source = boundedText(item, 'source', path, 200)
    const target = boundedText(item, 'target', path, 200)
    if (!nodeIds.has(source) || !nodeIds.has(target)) throw new Error(`${path} 必须引用已登记的节点。`)
    const weight = item.weight
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > 1_000) {
      throw new Error(`${path}.weight 必须是大于 0 且不超过 1000 的数字。`)
    }
    const label = optionalBoundedText(item, 'label', path, 240)
    const confidence = optionalConfidence(item.confidence, `${path}.confidence`)
    const validFrom = optionalDate(item, 'validFrom', path)
    const validUntil = optionalDate(item, 'validUntil', path)
    return {
      id,
      source,
      target,
      type: boundedText(item, 'type', path, 160),
      ...(label === undefined ? {} : { label }),
      weight,
      ...(confidence === undefined ? {} : { confidence }),
      ...(validFrom === undefined ? {} : { validFrom }),
      ...(validUntil === undefined ? {} : { validUntil }),
      sourceRefs: stringList(item.sourceRefs, `${path}.sourceRefs`),
    }
  })

  const communityIds = new Set<string>()
  const communities = record.communities.map((raw, index): V2KnowledgeGraphSnapshot['communities'][number] => {
    const path = `communities[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const id = boundedText(item, 'id', path, 200)
    if (communityIds.has(id)) throw new Error(`知识图谱社区 ${id} 重复。`)
    communityIds.add(id)
    const level = item.level
    if (!Number.isInteger(level) || (level as number) < 0 || (level as number) > 16) throw new Error(`${path}.level 必须是 0 到 16 的整数。`)
    const nodeIdsInCommunity = stringList(item.nodeIds, `${path}.nodeIds`, MAX_GRAPH_NODES)
    if (nodeIdsInCommunity.some(nodeId => !nodeIds.has(nodeId))) throw new Error(`${path}.nodeIds 包含未知节点。`)
    return { id, label: boundedText(item, 'label', path, 240), level: level as number, nodeIds: nodeIdsInCommunity }
  })
  for (const node of nodes) {
    if (node.communityId !== undefined && !communityIds.has(node.communityId)) {
      throw new Error(`节点 ${node.id} 引用了未知社区 ${node.communityId}。`)
    }
  }

  const updatedAt = boundedText(record, 'updatedAt', '知识图谱快照', 80)
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error('知识图谱快照 updatedAt 必须是有效日期时间。')
  const providerVersion = optionalBoundedText(provider, 'version', 'provider', 120)
  return {
    schemaVersion: 1,
    provider: { id: boundedText(provider, 'id', 'provider', 120), ...(providerVersion === undefined ? {} : { version: providerVersion }) },
    graphId: boundedText(record, 'graphId', '知识图谱快照', 200),
    revision: boundedText(record, 'revision', '知识图谱快照', 120),
    ontologyVersion: boundedText(record, 'ontologyVersion', '知识图谱快照', 120),
    updatedAt,
    nodes,
    edges,
    communities,
  }
}

function isInside(root: string, candidate: string): boolean {
  const value = relative(root, candidate)
  return value !== '' && value !== '..' && !value.startsWith(`..${sep}`) && !value.startsWith('../')
}

async function loadKnowledgeGraph(
  root: string,
  buildStatus: V2DesignSnapshot['graph']['buildStatus'],
): Promise<V2DesignSnapshot['graph']> {
  try {
    const canonicalRoot = await realpath(resolve(root))
    const candidate = await realpath(join(root, DESIGN_GRAPH_PATH))
    if (!isInside(canonicalRoot, candidate)) throw new Error('知识图谱快照越过项目目录。')
    const info = await stat(candidate)
    if (!info.isFile() || info.size > MAX_GRAPH_BYTES) throw new Error('知识图谱快照不是普通 JSON，或超过 2 MiB。')
    const snapshot = parseKnowledgeGraph(JSON.parse(await readFile(candidate, 'utf8')) as unknown)
    return { path: DESIGN_GRAPH_PATH, status: 'ready', buildStatus, snapshot }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path: DESIGN_GRAPH_PATH, status: 'missing', buildStatus }
    return { path: DESIGN_GRAPH_PATH, status: 'invalid', buildStatus, message: error instanceof Error ? error.message : String(error) }
  }
}

function array(value: unknown, path: string, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${path} 必须是最多 ${String(max)} 项的数组。`)
  return value
}

function integer(value: unknown, path: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) throw new Error(`${path} 必须是非负整数。`)
  return value as number
}

function dateText(record: Record<string, unknown>, key: string, path: string): string {
  const value = boundedText(record, key, path, 80)
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${path}.${key} 必须是有效日期时间。`)
  return value
}

function emptySemanticWorkspace(status: 'missing' | 'invalid', message?: string): V2SemanticWorkspaceSnapshot {
  return {
    status,
    path: SEMANTIC_WORKSPACE_PATH,
    provider: { id: 'semantica', expectedVersion: '0.6.7', status: status === 'invalid' ? 'invalid' : 'unchecked' },
    sources: [],
    definition: {
      status: 'missing', version: '0.1.0', revision: 0,
      competencyQuestions: [], classes: [], relationships: [], provenanceRules: [], temporalRules: [],
      confidenceThreshold: 0.65, shaclSeverity: 'Violation',
    },
    candidates: { status: 'not_run', entities: [], relationships: [], warnings: [] },
    runs: [],
    ...(message === undefined ? {} : { message }),
  }
}

function parseRule(value: unknown, path: string): V2SemanticWorkspaceSnapshot['definition']['provenanceRules'][number] {
  const record = asRecord(value)
  if (record === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
  return {
    id: boundedText(record, 'id', path, 80),
    label: boundedText(record, 'label', path, 120),
    description: boundedText(record, 'description', path, 1_000),
  }
}

function parseSemanticWorkspace(value: unknown): V2SemanticWorkspaceSnapshot {
  const record = asRecord(value)
  if (record === undefined || record.schemaVersion !== 1) throw new Error('语义工作区 schemaVersion 必须是 1。')
  const provider = asRecord(record.provider)
  const definition = asRecord(record.definition)
  const candidates = asRecord(record.candidates)
  if (provider === undefined || definition === undefined || candidates === undefined) {
    throw new Error('语义工作区必须包含 provider、definition 和 candidates。')
  }
  if (provider.id !== 'semantica' || provider.expectedVersion !== '0.6.7') throw new Error('语义工作区 Provider 标识或目标版本无效。')
  const providerStatus = provider.status
  if (providerStatus !== 'unchecked' && providerStatus !== 'ready' && providerStatus !== 'unavailable' && providerStatus !== 'invalid') {
    throw new Error('语义工作区 Provider 状态无效。')
  }
  const checkedAt = optionalDate(provider, 'checkedAt', 'provider')
  const providerVersion = optionalBoundedText(provider, 'version', 'provider', 80)
  const providerConfigDigest = optionalBoundedText(provider, 'configDigest', 'provider', 160)
  const providerMessage = optionalBoundedText(provider, 'message', 'provider', 1_000)
  const routeRecord = asRecord(record.route)
  const route: V2SemanticWorkspaceSnapshot['route'] = routeRecord === undefined ? undefined : (() => {
    const execution = asRecord(routeRecord.execution)
    const semantics = asRecord(routeRecord.semantics)
    if (execution === undefined || semantics === undefined) throw new Error('route 必须包含 execution 和 semantics。')
    const mechanism = execution.mechanism
    if (mechanism !== 'manual' && mechanism !== 'rules' && mechanism !== 'software' && mechanism !== 'retrieval'
      && mechanism !== 'model' && mechanism !== 'agent' && mechanism !== 'hybrid') throw new Error('route.execution.mechanism 无效。')
    const mode = semantics.mode
    if (mode !== 'schema' && mode !== 'ontology') throw new Error('route.semantics.mode 无效。')
    const conclusion = routeRecord.conclusion
    if (conclusion !== 'pending' && conclusion !== 'not_required' && conclusion !== 'validated'
      && conclusion !== 'validation_failed' && conclusion !== 'insufficient_evidence') throw new Error('route.conclusion 无效。')
    if (mode === 'schema' && conclusion !== 'pending' && conclusion !== 'not_required') throw new Error('普通 Schema 路线不能记录本体验证结论。')
    return {
      execution: {
        mechanism,
        label: boundedText(execution, 'label', 'route.execution', 120),
        rationale: boundedText(execution, 'rationale', 'route.execution', 2_000),
      },
      semantics: {
        mode,
        rationale: boundedText(semantics, 'rationale', 'route.semantics', 2_000),
      },
      conclusion,
    }
  })()
  const sources = array(record.sources, 'sources', MAX_SEMANTIC_SOURCES).map((raw, index): V2SemanticWorkspaceSnapshot['sources'][number] => {
    const path = `sources[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    if (item.authority !== 'primary' && item.authority !== 'supporting') throw new Error(`${path}.authority 无效。`)
    return {
      sourceId: boundedText(item, 'sourceId', path, 200),
      name: boundedText(item, 'name', path, 300),
      relativePath: boundedText(item, 'relativePath', path, 1_000),
      digest: boundedText(item, 'digest', path, 160),
      bytes: integer(item.bytes, `${path}.bytes`, 64 * 1024 * 1024),
      modifiedAt: dateText(item, 'modifiedAt', path),
      parseStatus: boundedText(item, 'parseStatus', path, 80),
      permissionScope: boundedText(item, 'permissionScope', path, 1_000),
      authority: item.authority,
    }
  })

  const definitionStatus = definition.status
  if (definitionStatus !== 'missing' && definitionStatus !== 'draft' && definitionStatus !== 'review'
    && definitionStatus !== 'published' && definitionStatus !== 'stale') throw new Error('definition.status 无效。')
  const questions = array(definition.competencyQuestions, 'definition.competencyQuestions', 100).map((raw, index): V2SemanticWorkspaceSnapshot['definition']['competencyQuestions'][number] => {
    const path = `definition.competencyQuestions[${String(index)}]`
    const item = asRecord(raw)
    const query = asRecord(item?.query)
    if (item === undefined || query === undefined) throw new Error(`${path} 必须包含 query。`)
    if (query.kind !== 'lookup' && query.kind !== 'edge' && query.kind !== 'path') throw new Error(`${path}.query.kind 无效。`)
    const sourceType = optionalBoundedText(query, 'sourceType', `${path}.query`, 160)
    const relationshipType = optionalBoundedText(query, 'relationshipType', `${path}.query`, 160)
    const targetType = optionalBoundedText(query, 'targetType', `${path}.query`, 160)
    return {
      id: boundedText(item, 'id', path, 80), text: boundedText(item, 'text', path, 500), required: item.required === true,
      query: {
        kind: query.kind,
        ...(sourceType === undefined ? {} : { sourceType }),
        ...(relationshipType === undefined ? {} : { relationshipType }),
        ...(targetType === undefined ? {} : { targetType }),
        maxDepth: integer(query.maxDepth, `${path}.query.maxDepth`, 8),
        minAnswers: integer(query.minAnswers, `${path}.query.minAnswers`, 1_000),
      },
    }
  })
  const classes = array(definition.classes, 'definition.classes', MAX_SEMANTIC_DEFINITIONS).map((raw, index): V2SemanticWorkspaceSnapshot['definition']['classes'][number] => {
    const path = `definition.classes[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const description = optionalBoundedText(item, 'description', path, 600)
    return {
      id: boundedText(item, 'id', path, 80), label: boundedText(item, 'label', path, 120),
      ...(description === undefined ? {} : { description }),
      aliases: stringList(Array.isArray(item.aliases) ? item.aliases : [], `${path}.aliases`, 30),
      identityKeys: stringList(item.identityKeys, `${path}.identityKeys`, 20),
      properties: array(item.properties, `${path}.properties`, 100).map((rawProperty, propertyIndex) => {
        const propertyPath = `${path}.properties[${String(propertyIndex)}]`
        const property = asRecord(rawProperty)
        if (property === undefined) throw new Error(`${propertyPath} 必须是 JSON 对象。`)
        const dataType = property.dataType
        if (dataType !== 'string' && dataType !== 'number' && dataType !== 'boolean' && dataType !== 'date' && dataType !== 'datetime') {
          throw new Error(`${propertyPath}.dataType 无效。`)
        }
        return {
          id: boundedText(property, 'id', propertyPath, 80), label: boundedText(property, 'label', propertyPath, 120),
          dataType, required: property.required === true, unique: property.unique === true,
        }
      }),
      fieldMappings: array(Array.isArray(item.fieldMappings) ? item.fieldMappings : [], `${path}.fieldMappings`, 100).map((rawMapping, mappingIndex) => {
        const mappingPath = `${path}.fieldMappings[${String(mappingIndex)}]`
        const mapping = asRecord(rawMapping)
        if (mapping === undefined) throw new Error(`${mappingPath} 必须是 JSON 对象。`)
        return {
          sourceField: boundedText(mapping, 'sourceField', mappingPath, 200),
          targetProperty: boundedText(mapping, 'targetProperty', mappingPath, 80),
        }
      }),
      extractionPatterns: stringList(item.extractionPatterns, `${path}.extractionPatterns`, 12),
    }
  })
  const relationships = array(definition.relationships, 'definition.relationships', MAX_SEMANTIC_DEFINITIONS).map((raw, index): V2SemanticWorkspaceSnapshot['definition']['relationships'][number] => {
    const path = `definition.relationships[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const cardinality = item.cardinality
    if (cardinality !== 'one-to-one' && cardinality !== 'one-to-many' && cardinality !== 'many-to-one' && cardinality !== 'many-to-many') {
      throw new Error(`${path}.cardinality 无效。`)
    }
    const description = optionalBoundedText(item, 'description', path, 600)
    return {
      id: boundedText(item, 'id', path, 80), label: boundedText(item, 'label', path, 120),
      domain: boundedText(item, 'domain', path, 80), range: boundedText(item, 'range', path, 80),
      ...(description === undefined ? {} : { description }), cardinality,
      extractionPatterns: stringList(item.extractionPatterns, `${path}.extractionPatterns`, 12),
    }
  })
  const confidenceThreshold = definition.confidenceThreshold
  if (typeof confidenceThreshold !== 'number' || !Number.isFinite(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
    throw new Error('definition.confidenceThreshold 必须在 0 到 1 之间。')
  }
  if (definition.shaclSeverity !== 'Violation' && definition.shaclSeverity !== 'Warning' && definition.shaclSeverity !== 'Info') {
    throw new Error('definition.shaclSeverity 无效。')
  }
  const definitionDigest = optionalBoundedText(definition, 'digest', 'definition', 160)
  const definitionUpdatedAt = optionalDate(definition, 'updatedAt', 'definition')

  const candidateStatus = candidates.status
  if (candidateStatus !== 'not_run' && candidateStatus !== 'ready' && candidateStatus !== 'failed' && candidateStatus !== 'stale') {
    throw new Error('candidates.status 无效。')
  }
  const candidateUpdatedAt = optionalDate(candidates, 'updatedAt', 'candidates')
  const parseDecision = (value: unknown, path: string): 'pending' | 'accepted' | 'rejected' => {
    if (value !== 'pending' && value !== 'accepted' && value !== 'rejected') throw new Error(`${path}.decision 无效。`)
    return value
  }
  const entities = array(candidates.entities, 'candidates.entities', MAX_SEMANTIC_CANDIDATES).map((raw, index): V2SemanticWorkspaceSnapshot['candidates']['entities'][number] => {
    const path = `candidates.entities[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    return {
      id: boundedText(item, 'id', path, 200), label: boundedText(item, 'label', path, 300), type: boundedText(item, 'type', path, 160),
      confidence: optionalConfidence(item.confidence, `${path}.confidence`) ?? 0,
      sourceRefs: stringList(item.sourceRefs, `${path}.sourceRefs`), decision: parseDecision(item.decision, path),
    }
  })
  const relationshipCandidates = array(candidates.relationships, 'candidates.relationships', MAX_SEMANTIC_CANDIDATES).map((raw, index): V2SemanticWorkspaceSnapshot['candidates']['relationships'][number] => {
    const path = `candidates.relationships[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
    const label = optionalBoundedText(item, 'label', path, 300)
    return {
      id: boundedText(item, 'id', path, 200), source: boundedText(item, 'source', path, 200), target: boundedText(item, 'target', path, 200),
      type: boundedText(item, 'type', path, 160), ...(label === undefined ? {} : { label }),
      confidence: optionalConfidence(item.confidence, `${path}.confidence`) ?? 0,
      sourceRefs: stringList(item.sourceRefs, `${path}.sourceRefs`), decision: parseDecision(item.decision, path),
    }
  })
  const runKinds = new Set(['extract', 'propose-schema', 'publish-schema', 'build', 'validate', 'context', 'slice'])
  const runStatuses = new Set(['waiting', 'running', 'succeeded', 'failed', 'cancelled', 'stale'])
  const runs = array(record.runs, 'runs', MAX_SEMANTIC_RUNS).map((raw, index): V2SemanticWorkspaceSnapshot['runs'][number] => {
    const path = `runs[${String(index)}]`
    const item = asRecord(raw)
    if (item === undefined || typeof item.kind !== 'string' || !runKinds.has(item.kind) || typeof item.status !== 'string' || !runStatuses.has(item.status)) {
      throw new Error(`${path} 类型或状态无效。`)
    }
    const completedAt = optionalDate(item, 'completedAt', path)
    const runProviderVersion = optionalBoundedText(item, 'providerVersion', path, 80)
    const definitionVersion = optionalBoundedText(item, 'definitionVersion', path, 80)
    const definitionDigest = optionalBoundedText(item, 'definitionDigest', path, 160)
    const summary = optionalBoundedText(item, 'summary', path, 2_000)
    return {
      id: boundedText(item, 'id', path, 200),
      kind: item.kind as V2SemanticWorkspaceSnapshot['runs'][number]['kind'],
      status: item.status as V2SemanticWorkspaceSnapshot['runs'][number]['status'],
      startedAt: dateText(item, 'startedAt', path),
      ...(completedAt === undefined ? {} : { completedAt }),
      ...(runProviderVersion === undefined ? {} : { providerVersion: runProviderVersion }),
      ...(definitionVersion === undefined ? {} : { definitionVersion }),
      ...(definitionDigest === undefined ? {} : { definitionDigest }),
      sourceDigests: stringList(item.sourceDigests, `${path}.sourceDigests`, MAX_SEMANTIC_SOURCES),
      ...(summary === undefined ? {} : { summary }),
      evidencePaths: stringList(item.evidencePaths, `${path}.evidencePaths`, 40),
      diagnostics: stringList(item.diagnostics, `${path}.diagnostics`, 40),
    }
  }).slice(-30)

  const validationRecord = asRecord(record.validation)
  const validation: V2SemanticWorkspaceSnapshot['validation'] = validationRecord === undefined ? undefined : (() => {
    if (validationRecord.status !== 'passed' && validationRecord.status !== 'failed'
      && validationRecord.status !== 'unavailable' && validationRecord.status !== 'stale') throw new Error('validation.status 无效。')
    return {
      runId: boundedText(validationRecord, 'runId', 'validation', 200), status: validationRecord.status,
      checkedAt: dateText(validationRecord, 'checkedAt', 'validation'),
      graphRevision: boundedText(validationRecord, 'graphRevision', 'validation', 160),
      definitionDigest: boundedText(validationRecord, 'definitionDigest', 'validation', 160),
      structuralValid: validationRecord.structuralValid === true,
      issues: array(validationRecord.issues, 'validation.issues', 200).map((raw, index) => {
        const path = `validation.issues[${String(index)}]`; const item = asRecord(raw)
        if (item === undefined) throw new Error(`${path} 必须是 JSON 对象。`)
        return { code: boundedText(item, 'code', path, 160), severity: boundedText(item, 'severity', path, 80), message: boundedText(item, 'message', path, 1_000) }
      }),
      questions: array(validationRecord.questions, 'validation.questions', 100).map((raw, index) => {
        const path = `validation.questions[${String(index)}]`; const item = asRecord(raw)
        if (item === undefined || (item.status !== 'passed' && item.status !== 'failed' && item.status !== 'unavailable')) throw new Error(`${path}.status 无效。`)
        return {
          questionId: boundedText(item, 'questionId', path, 80), status: item.status,
          answerCount: integer(item.answerCount, `${path}.answerCount`, 100_000), sourceRefs: stringList(item.sourceRefs, `${path}.sourceRefs`, 40),
          message: boundedText(item, 'message', path, 1_000),
        }
      }),
    }
  })()
  const contextRecord = asRecord(record.context)
  const context: V2SemanticWorkspaceSnapshot['context'] = contextRecord === undefined ? undefined : (() => {
    if (contextRecord.status !== 'ready' && contextRecord.status !== 'failed' && contextRecord.status !== 'stale') throw new Error('context.status 无效。')
    return {
      runId: boundedText(contextRecord, 'runId', 'context', 200), status: contextRecord.status,
      createdAt: dateText(contextRecord, 'createdAt', 'context'), query: boundedText(contextRecord, 'query', 'context', 1_000),
      schemaVersion: boundedText(contextRecord, 'schemaVersion', 'context', 80), graphRevision: boundedText(contextRecord, 'graphRevision', 'context', 160),
      entityCount: array(contextRecord.entities, 'context.entities', MAX_SEMANTIC_CANDIDATES).length,
      relationshipCount: array(contextRecord.relationships, 'context.relationships', MAX_SEMANTIC_CANDIDATES).length,
      sources: stringList(contextRecord.sources, 'context.sources', 40), permissionScope: boundedText(contextRecord, 'permissionScope', 'context', 1_000),
    }
  })()
  const sliceRecord = asRecord(record.slice)
  const slice: V2SemanticWorkspaceSnapshot['slice'] = sliceRecord === undefined ? undefined : (() => {
    if (sliceRecord.status !== 'succeeded' && sliceRecord.status !== 'failed' && sliceRecord.status !== 'stale') throw new Error('slice.status 无效。')
    const contextRunId = optionalBoundedText(sliceRecord, 'contextRunId', 'slice', 200)
    return {
      runId: boundedText(sliceRecord, 'runId', 'slice', 200), status: sliceRecord.status,
      createdAt: dateText(sliceRecord, 'createdAt', 'slice'), task: boundedText(sliceRecord, 'task', 'slice', 2_000),
      result: boundedText(sliceRecord, 'result', 'slice', 4_000), ...(contextRunId === undefined ? {} : { contextRunId }),
      evidenceRefs: stringList(sliceRecord.evidenceRefs, 'slice.evidenceRefs', 32), diagnostics: stringList(sliceRecord.diagnostics, 'slice.diagnostics', 32),
    }
  })()
  const decisionRecord = asRecord(record.decision)
  const workspaceRevision = integer(record.revision, 'revision')
  const evidenceDigest = optionalBoundedText(record, 'evidenceDigest', '语义工作区', 160)
  const decision: V2SemanticWorkspaceSnapshot['decision'] = decisionRecord === undefined ? undefined : (() => {
    if (decisionRecord.outcome !== 'go' && decisionRecord.outcome !== 'revise'
      && decisionRecord.outcome !== 'narrow' && decisionRecord.outcome !== 'stop') throw new Error('decision.outcome 无效。')
    if (decisionRecord.routeConclusion !== 'pending' && decisionRecord.routeConclusion !== 'not_required'
      && decisionRecord.routeConclusion !== 'validated' && decisionRecord.routeConclusion !== 'validation_failed'
      && decisionRecord.routeConclusion !== 'insufficient_evidence') throw new Error('decision.routeConclusion 无效。')
    if (decisionRecord.semanticMode !== 'schema' && decisionRecord.semanticMode !== 'ontology') throw new Error('decision.semanticMode 无效。')
    const definitionDigest = optionalBoundedText(decisionRecord, 'definitionDigest', 'decision', 160)
    const graphRevision = optionalBoundedText(decisionRecord, 'graphRevision', 'decision', 160)
    const sliceRunId = optionalBoundedText(decisionRecord, 'sliceRunId', 'decision', 200)
    const decisionWorkspaceRevision = integer(decisionRecord.workspaceRevision, 'decision.workspaceRevision')
    const decisionEvidenceDigest = boundedText(decisionRecord, 'evidenceDigest', 'decision', 160)
    return {
      id: boundedText(decisionRecord, 'id', 'decision', 200), outcome: decisionRecord.outcome,
      rationale: boundedText(decisionRecord, 'rationale', 'decision', 2_000),
      decidedAt: dateText(decisionRecord, 'decidedAt', 'decision'), workspaceRevision: decisionWorkspaceRevision,
      evidenceDigest: decisionEvidenceDigest,
      status: evidenceDigest !== undefined && decisionEvidenceDigest === evidenceDigest ? 'current' : 'stale',
      routeConclusion: decisionRecord.routeConclusion, semanticMode: decisionRecord.semanticMode,
      ...(definitionDigest === undefined ? {} : { definitionDigest }),
      ...(graphRevision === undefined ? {} : { graphRevision }),
      ...(sliceRunId === undefined ? {} : { sliceRunId }),
    }
  })()
  const updatedAt = dateText(record, 'updatedAt', '语义工作区')
  return {
    status: 'ready', path: SEMANTIC_WORKSPACE_PATH, revision: workspaceRevision, updatedAt,
    ...(evidenceDigest === undefined ? {} : { evidenceDigest }),
    provider: {
      id: 'semantica', expectedVersion: '0.6.7', status: providerStatus,
      ...(providerVersion === undefined ? {} : { version: providerVersion }),
      ...(providerConfigDigest === undefined ? {} : { configDigest: providerConfigDigest }),
      ...(checkedAt === undefined ? {} : { checkedAt }),
      ...(providerMessage === undefined ? {} : { message: providerMessage }),
    },
    ...(route === undefined ? {} : { route }),
    sources,
    definition: {
      status: definitionStatus,
      version: boundedText(definition, 'version', 'definition', 80),
      revision: integer(definition.revision, 'definition.revision'),
      ...(definitionDigest === undefined ? {} : { digest: definitionDigest }),
      ...(definitionUpdatedAt === undefined ? {} : { updatedAt: definitionUpdatedAt }),
      competencyQuestions: questions, classes, relationships,
      provenanceRules: array(definition.provenanceRules, 'definition.provenanceRules', 100).map((item, index) => parseRule(item, `definition.provenanceRules[${String(index)}]`)),
      temporalRules: array(definition.temporalRules, 'definition.temporalRules', 100).map((item, index) => parseRule(item, `definition.temporalRules[${String(index)}]`)),
      confidenceThreshold, shaclSeverity: definition.shaclSeverity,
    },
    candidates: {
      status: candidateStatus, ...(candidateUpdatedAt === undefined ? {} : { updatedAt: candidateUpdatedAt }),
      entities, relationships: relationshipCandidates, warnings: stringList(candidates.warnings, 'candidates.warnings', 100),
    },
    runs,
    ...(validation === undefined ? {} : { validation }),
    ...(context === undefined ? {} : { context }),
    ...(slice === undefined ? {} : { slice }),
    ...(decision === undefined ? {} : { decision }),
  }
}

async function loadSemanticWorkspace(root: string): Promise<V2SemanticWorkspaceSnapshot> {
  try {
    const canonicalRoot = await realpath(resolve(root))
    const candidate = await realpath(join(root, SEMANTIC_WORKSPACE_PATH))
    if (!isInside(canonicalRoot, candidate)) throw new Error('语义工作区状态越过项目目录。')
    const info = await stat(candidate)
    if (!info.isFile() || info.size > MAX_SEMANTIC_WORKSPACE_BYTES) throw new Error('语义工作区状态不是普通 JSON，或超过 4 MiB。')
    return parseSemanticWorkspace(JSON.parse(await readFile(candidate, 'utf8')) as unknown)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptySemanticWorkspace('missing')
    return emptySemanticWorkspace('invalid', error instanceof Error ? error.message : String(error))
  }
}

async function loadDesign(root: string, value: unknown): Promise<V2DesignSnapshot | undefined> {
  const design = parseDesign(value)
  if (design === undefined) return undefined
  const { graphBuildStatus, graphBuildMessage, ...state } = design
  const workspace = await loadSemanticWorkspace(root)
  if (design.semantics.mode !== 'ontology') {
    return { ...state, graph: { path: DESIGN_GRAPH_PATH, status: 'not_applicable', buildStatus: 'not_applicable' }, workspace }
  }
  const graph = await loadKnowledgeGraph(root, graphBuildStatus)
  return {
    ...state,
    graph: graphBuildMessage === undefined || graph.message !== undefined ? graph : { ...graph, message: graphBuildMessage },
    workspace,
  }
}

/** Load one V2 stage without mutating project files or trusting declared artifact presence. */
export async function loadV2StageSurface(root: string, stageId: V2LifecycleStageId): Promise<V2StageSurfaceSnapshot> {
  const definition = V2_STAGE_DEFINITIONS.find(item => item.id === stageId)
  if (definition === undefined) throw new Error(`未知 V2 阶段：${stageId}`)
  const [state, artifacts] = await Promise.all([
    readState(root, definition),
    Promise.all(definition.artifacts.map(async artifact => await inspectArtifact(root, artifact))),
  ])
  const presentCount = artifacts.filter(item => item.status === 'present').length
  const rawWork = Array.isArray(state.value?.workItems) ? state.value.workItems : []
  const declared = new Map(rawWork.map((raw) => {
    const record = asRecord(raw)
    return [typeof record?.id === 'string' ? record.id : '', workStatus(record?.status)] as const
  }))
  const workItems = definition.workItems.map((item, index) => ({
    ...item,
    status: declared.get(item.id) ?? (index === 0 ? 'current' as const : 'waiting' as const),
  }))
  const currentWorkId = workItems.find(item => item.status === 'current' || item.status === 'blocked')?.id
    ?? workItems.at(-1)?.id
    ?? ''
  const rawBlockers = Array.isArray(state.value?.blockers) ? state.value.blockers : []
  const blockers: V2StageSurfaceSnapshot['blockers'] = rawBlockers.flatMap((raw, index) => {
    const record = asRecord(raw)
    const severity = record?.severity
    const status = record?.status
    if (record === undefined || typeof record.title !== 'string'
      || (severity !== 'low' && severity !== 'medium' && severity !== 'high' && severity !== 'critical')
      || (status !== 'open' && status !== 'resolved')) return []
    return [{
      id: typeof record.id === 'string' ? record.id : `blocker-${String(index + 1)}`,
      title: record.title,
      severity: severity,
      status: status,
    }]
  })
  const investigation = definition.id === 'investigation'
    ? parseInvestigation(state.value?.investigation)
    : undefined
  const design = definition.id === 'design'
    ? await loadDesign(root, state.value?.design)
    : undefined
  const reviewBlockers: string[] = []
  if (state.status === 'missing') reviewBlockers.push(`尚未生成阶段状态文件 ${definition.statePath}`)
  if (state.status === 'invalid') reviewBlockers.push(`阶段状态文件无法读取：${state.message ?? '结构无效'}`)
  if (definition.id === 'investigation' && state.status === 'ready' && investigation === undefined) {
    reviewBlockers.push('环境调查驾驶舱尚未形成结构化记录')
  }
  if (definition.id === 'design' && state.status === 'ready' && design === undefined) {
    reviewBlockers.push('第四阶段方案路线尚未形成结构化记录')
  }
  if (design !== undefined) {
    if (design.execution.status !== 'selected') reviewBlockers.push('执行机制尚未选定')
    if (design.semantics.mode === 'undecided') reviewBlockers.push('语义基础尚未决定')
    if (design.workspace.status === 'missing') reviewBlockers.push('第四阶段真实运行工作区尚未建立')
    if (design.workspace.status === 'invalid') reviewBlockers.push(`第四阶段真实运行工作区无法读取：${design.workspace.message ?? '结构无效'}`)
    const workspaceRoute = design.workspace.route
    if (design.semantics.mode !== 'undecided' && workspaceRoute === undefined) {
      reviewBlockers.push('第四阶段路线没有对应的真实工作区记录')
    } else if (workspaceRoute !== undefined && (
      workspaceRoute.execution.mechanism !== design.execution.mechanism
      || workspaceRoute.execution.label !== design.execution.label
      || workspaceRoute.execution.rationale !== design.execution.rationale
      || workspaceRoute.semantics.mode !== design.semantics.mode
      || workspaceRoute.semantics.rationale !== design.semantics.rationale
      || workspaceRoute.conclusion !== design.semantics.conclusion
    )) {
      reviewBlockers.push('阶段路线与当前真实运行工作区版本不一致')
    }
    if (design.semantics.mode === 'schema' && design.semantics.conclusion !== 'not_required') {
      reviewBlockers.push('普通 Schema 路线尚未形成不采用本体的候选结论')
    }
    if (design.semantics.mode === 'schema') {
      const sliceRun = design.workspace.slice === undefined
        ? undefined
        : design.workspace.runs.find(item => item.id === design.workspace.slice?.runId && item.kind === 'slice')
      if (design.workspace.slice?.status !== 'succeeded' || sliceRun?.status !== 'succeeded') {
        reviewBlockers.push('轻量路线尚未形成带项目证据的真实纵向切片')
      }
    }
    if (design.semantics.mode === 'ontology') {
      if (design.workspace.provider.status !== 'ready' || design.workspace.provider.version !== design.workspace.provider.expectedVersion) {
        reviewBlockers.push('Semantica Provider 尚未通过固定版本检查')
      }
      if (design.workspace.sources.length === 0) reviewBlockers.push('尚未绑定当前项目获准使用的代表材料')
      if (design.ontology.status !== 'published' || design.workspace.definition.status !== 'published' || design.workspace.definition.digest === undefined) {
        reviewBlockers.push('当前 Ontology Schema 尚未发布')
      }
      if (design.graph.status === 'missing') reviewBlockers.push('项目知识图谱尚未形成')
      if (design.graph.status === 'invalid') reviewBlockers.push(`项目知识图谱无法读取：${design.graph.message ?? '结构无效'}`)
      const buildRun = [...design.workspace.runs].reverse().find(item => item.kind === 'build')
      const currentSourceDigests = design.workspace.sources.map(item => item.digest)
      const currentBuild = buildRun?.status === 'succeeded'
        && buildRun.definitionDigest === design.workspace.definition.digest
        && buildRun.sourceDigests.length === currentSourceDigests.length
        && buildRun.sourceDigests.every((item, index) => item === currentSourceDigests[index])
      if (design.graph.buildStatus !== 'succeeded' || !currentBuild) reviewBlockers.push('当前图谱构建尚未成功完成，或引用版本已经变化')
      const validation = design.workspace.validation
      if (validation?.status !== 'passed'
        || validation.definitionDigest !== design.workspace.definition.digest
        || validation.graphRevision !== design.graph.snapshot?.revision) {
        reviewBlockers.push('当前 Schema 与图谱尚未通过同版本独立验证')
      }
      const context = design.workspace.context
      if (context?.status !== 'ready'
        || context.schemaVersion !== design.workspace.definition.version
        || context.graphRevision !== design.graph.snapshot?.revision) {
        reviewBlockers.push('当前验证版本尚未形成受控 Agent 上下文')
      }
      const sliceRun = design.workspace.slice === undefined
        ? undefined
        : design.workspace.runs.find(item => item.id === design.workspace.slice?.runId && item.kind === 'slice')
      if (design.workspace.slice?.status !== 'succeeded'
        || sliceRun?.status !== 'succeeded'
        || design.workspace.slice.contextRunId !== context?.runId) {
        reviewBlockers.push('尚未用当前受控上下文跑通带证据的真实纵向切片')
      }
      if (design.semantics.conclusion !== 'validated') reviewBlockers.push('当前本体机制尚未形成验证通过的候选结论')
    }
  }
  for (const artifact of artifacts.filter(item => item.required && item.status !== 'present')) reviewBlockers.push(`${artifact.title}尚未形成`)
  for (const blocker of blockers.filter(item => item.status === 'open' && (item.severity === 'high' || item.severity === 'critical'))) reviewBlockers.push(blocker.title)
  const declaredStatus = state.value?.status
  if (declaredStatus === 'review-ready' && workItems.some(item => item.status !== 'complete')) {
    reviewBlockers.push('阶段工作项尚未全部完成')
  }
  const status = reviewBlockers.length > 0 || declaredStatus === 'blocked'
    ? 'blocked'
    : declaredStatus === 'review-ready'
      ? 'review-ready'
      : 'working'
  return {
    ...definition,
    stateStatus: state.status,
    status,
    currentWorkId,
    workItems,
    blockers,
    recommendation: recommendation(state.value?.recommendation),
    artifacts,
    requiredCount: definition.artifacts.filter(item => item.required).length,
    presentCount,
    reviewReady: reviewBlockers.length === 0 && status === 'review-ready',
    reviewBlockers,
    ...(definition.id !== 'investigation' || investigation === undefined ? {} : { investigation }),
    ...(definition.id !== 'design' || design === undefined ? {} : { design }),
    ...(state.message === undefined ? {} : { message: state.message }),
  }
}

/** Load all post-discovery V2 stage surfaces for one bounded project snapshot. */
export async function loadV2StageSurfaces(
  root: string,
): Promise<Readonly<Record<V2LifecycleStageId, V2StageSurfaceSnapshot>>> {
  const entries = await Promise.all(V2_STAGE_DEFINITIONS.map(async definition => [
    definition.id,
    await loadV2StageSurface(root, definition.id),
  ] as const))
  return Object.fromEntries(entries) as Readonly<Record<V2LifecycleStageId, V2StageSurfaceSnapshot>>
}

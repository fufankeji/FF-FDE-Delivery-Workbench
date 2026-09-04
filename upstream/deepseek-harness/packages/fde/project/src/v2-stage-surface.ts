/** Read-only business surfaces for V2 lifecycle stages two through eight. */

import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { V2InvestigationSnapshot, V2LifecycleStageId, V2StageArtifactSnapshot, V2StageSurfaceSnapshot } from './types.ts'

const MAX_STATE_BYTES = 256 * 1024

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
      severity: severity as 'low' | 'medium' | 'high' | 'critical',
      status: status as 'open' | 'resolved',
    }]
  })
  const investigation = definition.id === 'investigation'
    ? parseInvestigation(state.value?.investigation)
    : undefined
  const reviewBlockers: string[] = []
  if (state.status === 'missing') reviewBlockers.push(`尚未生成阶段状态文件 ${definition.statePath}`)
  if (state.status === 'invalid') reviewBlockers.push(`阶段状态文件无法读取：${state.message ?? '结构无效'}`)
  if (definition.id === 'investigation' && state.status === 'ready' && investigation === undefined) {
    reviewBlockers.push('环境调查驾驶舱尚未形成结构化记录')
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

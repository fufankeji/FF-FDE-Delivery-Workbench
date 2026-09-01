/** V2 lifecycle Skills and model guidance. @module @deepseek-ai/dsh-fde-stage/v2-skills */

import type { StageSkillCatalogValue } from './http.ts'
import type { FdeV2StageId } from './spec.ts'

interface V2StageSkillDefinition {
  readonly stage: Exclude<FdeV2StageId, 'discovery'>
  readonly index: number
  readonly name: string
  readonly label: string
  readonly description: string
  readonly whenToUse: string
  readonly statePath: string
  readonly artifacts: readonly string[]
  readonly workItems: readonly string[]
  readonly instructions: string
}

const COMMON_V2_STAGE_RULES = `## 共同行为

先读取上一阶段已经由 FDE 确认的固定产物、用户本轮明确引用的资料和当前对话；不要把整个项目目录自动加入上下文。结论必须区分已确认事实、合理推断和待核对事项，并在文档中写明来源。

只维护下面列出的固定路径，不创建 final、new、v2 等平行最终稿。固定产物是候选记录；文件齐备不表示客户确认、外部动作已经执行或阶段已经完成。你不能代替 FDE 推进项目阶段。

同时维护本阶段 JSON 状态文件。根对象固定包含：

- \`schemaVersion: 1\`；
- \`stage\`：必须等于当前阶段 ID；
- \`status\`：只能是 \`working\`、\`blocked\` 或 \`review-ready\`；
- \`workItems\`：逐项记录固定工作项 ID 与 \`waiting\`、\`current\`、\`blocked\` 或 \`complete\`；
- \`blockers\`：每项包含稳定 \`id\`、\`title\`、\`severity\`（low／medium／high／critical）和 \`status\`（open／resolved）；
- \`recommendation\`：只能是 \`pending\`、\`go\`、\`revise\`、\`narrow\` 或 \`stop\`。

只有固定产物都已形成、工作项已如实更新且没有未解决的 high／critical 阻塞时，才可把 status 写为 review-ready。最终回复说明本轮读取了什么、更新了什么、仍缺什么，以及建议 FDE 接下来做哪一项人工判断。`

const V2_STAGE_SKILL_DEFINITIONS: readonly V2StageSkillDefinition[] = [
  {
    stage: 'definition', index: 1, name: 'fde-define-outcome-scope', label: '把成功、范围和责任说清楚',
    description: '把已确认的真实流程转成可衡量的业务结果、交付边界、责任分工和停止条件。',
    whenToUse: '第一阶段已由 FDE 确认，用户要求定义成功标准、范围、价值、责任或交付计划时使用。',
    statePath: '.fde/stages/definition.json',
    artifacts: [
      'fde-deliverables/02-outcome-scope/outcome-contract.md',
      'fde-deliverables/02-outcome-scope/value-case.md',
      'fde-deliverables/02-outcome-scope/delivery-plan.md',
    ],
    workItems: ['baseline', 'outcome', 'scope', 'ownership'],
    instructions: `建立可核对的当前基线，明确由谁用什么证据判断成功，再写交付范围、非目标、责任人、客户配合事项、完整成本、风险上限和停止条件。预测值、假设和已经测量的结果必须分开。没有验证人、基线或决策权时保持阻塞，不替客户补齐。`,
  },
  {
    stage: 'investigation', index: 2, name: 'fde-investigate-environment', label: '查清现场系统、数据和权限',
    description: '在承诺方案前调查真实数据、系统、接口、权限、安全要求和责任人。',
    whenToUse: '业务结果与范围已确认，用户要求调查客户现场条件、数据可用性、系统接入或治理要求时使用。',
    statePath: '.fde/stages/investigation.json',
    artifacts: [
      'fde-deliverables/03-environment/data-readiness.md',
      'fde-deliverables/03-environment/system-access-map.md',
      'fde-deliverables/03-environment/governance-review.md',
    ],
    workItems: ['data', 'systems', 'access', 'owners'],
    instructions: `只在用户授权的系统、目录和数据范围内调查。区分“系统存在”“技术可连接”“已经获准使用”，记录数据来源、质量、规模、敏感性、接口限制、账号权限、实际负责人、审批人和人工升级路径。安全、隐私和法务结论分别记录，任何一项都不能替代另外两项；不得读取未授权凭据或绕过访问控制。`,
  },
  {
    stage: 'design', index: 3, name: 'fde-design-vertical-slice', label: '选择实现方式并走通最小链路',
    description: '比较可行机制，形成带权限和回退的方案，并完成一条可验证的端到端纵向切片。',
    whenToUse: '现场系统、数据、权限和责任边界已经查清，用户要求选择机制、设计方案或规划纵向切片时使用。',
    statePath: '.fde/stages/design.json',
    artifacts: [
      'fde-deliverables/04-solution-design/mechanism-selection.md',
      'fde-deliverables/04-solution-design/solution-design.md',
      'fde-deliverables/04-solution-design/vertical-slice-record.md',
    ],
    workItems: ['mechanism', 'architecture', 'slice', 'decision'],
    instructions: `先比较不构建、人工优化、规则、传统软件、ML、RAG、LLM 和 Agent 等真实可行方案，不默认选择 Agent。记录系统边界、数据与动作流、身份权限、人工审批、接口合同、非功能要求、降级与回滚。纵向切片必须贯穿真实输入、关键判断、受控动作和可验证结果；尚未真实运行时只能写计划或待验证，不得写成已走通。`,
  },
  {
    stage: 'evaluation', index: 4, name: 'fde-run-poc-eval', label: '用真实案例验证关键假设',
    description: '把成功标准映射成案例、数据、阈值和证据，并如实记录 PoC 与 Eval 结果。',
    whenToUse: '候选方案和纵向切片已经形成，用户要求制定验证计划、准备案例、运行测试或整理验证结论时使用。',
    statePath: '.fde/stages/evaluation.json',
    artifacts: [
      'fde-deliverables/05-poc-eval/evaluation-plan.md',
      'fde-deliverables/05-poc-eval/evaluation-report.md',
      'fde-deliverables/05-poc-eval/evaluation-baseline.md',
    ],
    workItems: ['plan', 'cases', 'run', 'conclusion'],
    instructions: `把每条成功标准映射到候选版本、验证环境、真实案例、边界案例、失败案例、指标、阈值和证据路径。只有实际调用项目、测试或评估工具得到的结果才可记录为通过或失败；未运行、缺数据、人工例外和客户接受必须分别保存。总体均分、任务数量和 Agent 自评不能掩盖关键失败。`,
  },
  {
    stage: 'pilot', index: 5, name: 'fde-integration-pilot', label: '接入客户现场并运行受控试点',
    description: '完成企业集成、可靠性和回滚准备，在明确授权与有限范围内运行 Pilot。',
    whenToUse: 'PoC 与 Eval 已由 FDE 确认，用户要求准备企业集成、可靠性改造、试点授权、运行或复盘时使用。',
    statePath: '.fde/stages/pilot.json',
    artifacts: [
      'fde-deliverables/06-pilot/pilot-scope.md',
      'fde-deliverables/06-pilot/pilot-runbook.md',
      'fde-deliverables/06-pilot/pilot-report.md',
    ],
    workItems: ['integration', 'reliability', 'readiness', 'pilot'],
    instructions: `记录真实系统集成、身份权限、审计、监控、降级、恢复、容量和成本边界。明确试点对象、人员、环境、成功与停止条件、观察期和回滚责任人。部署、外部写入、通知真实人员或变更客户系统都必须先取得本轮明确授权；未获授权时只准备计划并保持阻塞，不能把模拟当成试点结果。`,
  },
  {
    stage: 'production', index: 6, name: 'fde-production-handover', label: '进入生产并完成验收交接',
    description: '整理生产就绪、受控发布、采用、客户验收、培训和责任移交的真实记录。',
    whenToUse: '受控试点已有真实结果，用户要求准备生产发布、观察、验收、培训或运维责任移交时使用。',
    statePath: '.fde/stages/production.json',
    artifacts: [
      'fde-deliverables/07-production-handover/production-review.md',
      'fde-deliverables/07-production-handover/customer-acceptance.md',
      'fde-deliverables/07-production-handover/handover-record.md',
    ],
    workItems: ['readiness', 'release', 'adoption', 'handover'],
    instructions: `生产授权、发布结果、观察期、用户采用、业务结果、客户验收、培训、账号权限和运维责任分别记录。没有授权不得发布，没有签署或有权责任人的明确记录不得写客户已接受，没有培训与责任转移证据不得写移交完成。任何真实外部动作都要等待明确授权，条件接受和未决事项必须保留。`,
  },
  {
    stage: 'improvement', index: 7, name: 'fde-continuous-improvement', label: '依据生产证据改进并沉淀经验',
    description: '从业务结果、运行事件、用户反馈和成本中选择改进，验证后受控发布并记录复用边界。',
    whenToUse: '系统已经进入生产并完成责任交接，用户要求复盘、选择改进、发布修订或沉淀可复用能力时使用。',
    statePath: '.fde/stages/improvement.json',
    artifacts: [
      'fde-deliverables/08-improvement/field-learning-register.md',
      'fde-deliverables/08-improvement/improvement-record.md',
      'fde-deliverables/08-improvement/controlled-release-record.md',
    ],
    workItems: ['evidence', 'prioritize', 'validate', 'productize'],
    instructions: `只从生产指标、事故、反馈、采用和成本等现有证据选择本轮改进，说明影响、风险、验证方法、不做项和回滚边界。未经测试的改动不能发布，未经授权不能改变生产系统。现场经验只有在说明适用条件、隐私处理、验证范围和不适用边界后，才能登记为可复用候选；完成一次评审只结束本轮改进，不关闭持续改进阶段。`,
  },
] as const

function contentFor(definition: V2StageSkillDefinition): string {
  const artifactList = definition.artifacts.map((path, index) => `${String(index + 1)}. \`${path}\``).join('\n')
  const workItemList = definition.workItems.map(id => `\`${id}\``).join('、')
  return `# ${definition.label}\n\n${definition.instructions}\n\n## 固定产物\n\n${artifactList}\n\n状态文件：\`${definition.statePath}\`。固定工作项 ID：${workItemList}。\n\n${COMMON_V2_STAGE_RULES}`
}

/** Skills registered by the V2 post-discovery stages. */
export const V2_STAGE_SKILLS = V2_STAGE_SKILL_DEFINITIONS.map(definition => ({
  name: definition.name,
  description: definition.description,
  whenToUse: definition.whenToUse,
  source: 'bundled-v2',
  content: contentFor(definition),
}))

/** Read-only business catalog for all post-discovery V2 stages. */
export const V2_STAGE_SKILL_CATALOG = V2_STAGE_SKILL_DEFINITIONS.map(definition => ({
  id: definition.stage,
  index: definition.index,
  methods: [{
    id: definition.name,
    label: definition.label,
    description: definition.description,
    whenToUse: definition.whenToUse,
    source: 'bundled-v2',
    content: contentFor(definition),
  }],
})) satisfies StageSkillCatalogValue['stages']

/** Return short model guidance for the current authoritative V2 stage. */
export function v2StagePrompt(stage: FdeV2StageId): string {
  const definition = V2_STAGE_SKILL_DEFINITIONS.find(item => item.stage === stage)
  if (definition === undefined) return ''
  return `当前 FDE 项目处于“${definition.label}”。用户要求开展本阶段工作时，先加载 Skill \`${definition.name}\`。严格维护固定产物与状态文件，只记录真实来源和执行证据；你不能代替 FDE 确认客户结论、执行未授权外部动作或推进项目阶段。`
}

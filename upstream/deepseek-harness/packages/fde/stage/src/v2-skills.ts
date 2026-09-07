/** V2 lifecycle Skills and model guidance. @module @deepseek-ai/dsh-fde-stage/v2-skills */

import type { StageSkillCatalogMethod, StageSkillCatalogValue } from './http.ts'
import type { FdeV2StageId } from './spec.ts'

interface V2StageSkillDefinition {
  readonly stage: Exclude<FdeV2StageId, 'discovery'>
  readonly index: number
  readonly name: string
  readonly label: string
  readonly description: string
  readonly whenToUse: string
  readonly source: string
  readonly statePath: string
  readonly artifacts: readonly string[]
  readonly workItems: readonly string[]
  readonly instructions: string
  readonly group?: 'required' | 'conditional'
}

type V2GroupedStageSkillDefinition = V2StageSkillDefinition & {
  readonly group: 'required' | 'conditional'
}

const COMMON_V2_STAGE_RULES = `## 共同行为

先读取上一阶段已经由 FDE 确认的固定产物、用户本轮明确引用的资料和当前对话；不要把整个项目目录自动加入上下文。结论必须区分已确认事实、合理推断和待核对事项，并在文档中写明来源。

只维护下面列出的固定路径，不创建 final、new、v2 等平行最终稿。固定产物是候选记录；文件齐备不表示客户确认、外部动作已经执行或阶段已经完成。你不能代替 FDE 推进项目阶段。

同时维护本阶段 JSON 状态文件。根对象固定包含：

- \`schemaVersion: 1\`；
- \`stage\`：必须等于当前阶段 ID；
- \`status\`：只能是 \`working\`、\`blocked\` 或 \`review-ready\`；
- \`workItems\`：必须是 JSON 数组，每项包含固定工作项 \`id\` 与 \`status\`；不得写成对象映射；每个固定 ID 必须恰好出现一次，\`status\` 只能是 \`waiting\`、\`current\`、\`blocked\` 或 \`complete\`；
- \`blockers\`：每项包含稳定 \`id\`、\`title\`、\`severity\`（low／medium／high／critical）和 \`status\`（open／resolved）；
- \`recommendation\`：只能是 \`pending\`、\`go\`、\`revise\`、\`narrow\` 或 \`stop\`。

先更新固定产物，再重新读取全部固定产物和当前状态，最后写入状态文件。状态文件必须是本轮最后一次文件写入；已经完成、当前处理和受阻的工作项要分别写为 complete、current 和 blocked，不能把全部工作项长期保留为 current。

只有固定产物都已形成、工作项已如实更新且没有未解决的 high／critical 阻塞时，才可把 status 写为 review-ready。最终回复必须在最后一次重读之后，说明本轮读取了什么、更新了什么、仍缺什么，以及建议 FDE 接下来做哪一项人工判断。`

const VALUE_METHOD_SOURCE = 'davidahmann/fde-guide@060ef0f3b67743b2e1fc3705763d423eae980236'
const FRAME_ENGINEERING_SOURCE = 'rpraharaj/forward-deployed-engineer@ee045a66db5242617ccea9e5e33139a2980ab55e'

const DEFINITION_STAGE_SHARED = {
  stage: 'definition',
  index: 1,
  statePath: '.fde/stages/definition.json',
  artifacts: [
    'fde-deliverables/02-outcome-scope/outcome-contract.md',
    'fde-deliverables/02-outcome-scope/value-case.md',
    'fde-deliverables/02-outcome-scope/delivery-plan.md',
  ],
  workItems: ['baseline', 'outcome', 'scope', 'ownership'],
} as const

const DEFINITION_STAGE_SKILL_DEFINITIONS: readonly V2StageSkillDefinition[] = [
  {
    ...DEFINITION_STAGE_SHARED,
    name: 'engineer-ai-value', label: '算清当前成本和问题影响', source: VALUE_METHOD_SOURCE,
    description: '用客户当前真实做法建立基线，算清问题造成的时间、成本、风险和继续投入的边界。',
    whenToUse: '第二阶段开始，需要判断当前问题有多大、改善后能带来什么结果，以及投入上限时优先使用。',
    instructions: '从已经确认的业务流程建立当前基线，记录发生频率、耗时、人力、返工、损失与风险，明确结果由谁、用什么证据验证。把已测数据、客户估算、项目预测和未知项分开；完整成本必须包含建设、接入、运行、人工复核、治理和退出成本。形成基本情景、下行情景、风险上限和停止条件，没有基线或验证人时保持阻塞。',
  },
  {
    ...DEFINITION_STAGE_SHARED,
    name: 'requirements-to-spec', label: '把成功标准写成可验收要求', source: FRAME_ENGINEERING_SOURCE,
    description: '把业务结果、范围和边界改写成能够检查、能够举证的要求与验收条件。',
    whenToUse: '业务结果和范围已有候选，需要明确做到什么、如何检查、哪些情况不在本次交付内时使用。',
    instructions: '把已确认的业务结果拆成可验证要求，逐项写明适用角色、触发条件、预期结果、业务规则、边界、非目标、失败回退和所需证据。每条要求都要回指来源，不在此阶段设计技术实现。无法验证、责任人不明或证据取得方式未知的要求必须保留为待确认，不得改写成已承诺范围。',
  },
  {
    ...DEFINITION_STAGE_SHARED,
    name: 'feasibility-probe', label: '检查现有条件是否做得到', source: FRAME_ENGINEERING_SOURCE,
    description: '用现有系统、代码、数据和权限事实检查每项要求的可行落点与缺口。',
    whenToUse: '要求已经可验证，需要判断现有条件能否支持，或哪些未知会影响承诺时使用。',
    instructions: '只在用户授权范围内，用已有项目资料、系统说明、接口、代码和数据事实逐项检查要求：现有能力是什么、需要修改哪里、依赖谁、还缺什么证据。区分“看起来可行”“已在当前环境验证”和“尚未验证”，不要在未执行真实检查时写成已经可实现；不得读取未授权凭据或改动客户系统。',
  },
  {
    ...DEFINITION_STAGE_SHARED,
    name: 'estimation', label: '估算周期、人力和主要风险', source: FRAME_ENGINEERING_SOURCE,
    description: '根据已经查到的事实给出带假设、范围和不确定性的交付估算。',
    whenToUse: '范围和主要落点已经可描述，需要评估周期、人力、外部依赖和风险缓冲时使用。',
    instructions: '以需求、可行性证据和历史可比工作为基础，按工作包给出范围估算、关键假设、客户等待时间、外部依赖、风险缓冲和置信度。未知项必须反映到区间或阻塞，不能给出没有证据的精确日期；当范围或依赖变化时更新估算来源和影响，不覆盖旧版本的依据。',
  },
  {
    ...DEFINITION_STAGE_SHARED,
    name: 'delivery-plan', label: '按风险排出交付顺序', source: FRAME_ENGINEERING_SOURCE,
    description: '先处理最可能推翻项目的风险，再安排里程碑、客户配合和阶段决定。',
    whenToUse: '成功标准、范围、可行性和估算已有候选，需要形成可执行的交付顺序时使用。',
    instructions: '按风险而不是按实现方便程度安排工作：先验证最可能推翻价值、权限、数据或集成假设的事项，再形成工作包、里程碑、负责人、客户输入、依赖、验收证据和决策节点。计划必须写明何时调整、收窄或停止；没有外部授权时只记录候选安排，不创建已确认排期。',
  },
  {
    ...DEFINITION_STAGE_SHARED,
    name: 'escalation-and-renegotiation', label: '范围、周期或资源冲突时，发起重谈', source: FRAME_ENGINEERING_SOURCE,
    description: '当范围、时间、资源或风险无法同时成立时，用证据形成可决策的调整方案。',
    whenToUse: '新约束使原范围、周期、资源或安全边界无法同时满足，且需要有权负责人重新决定时使用。',
    instructions: '保留原约定和触发冲突的事实，说明不调整会造成的业务影响，并给出少量可比较选项：收窄范围、延后时间、增加资源、降低目标或停止。每个选项写明代价、风险和需要谁决定；在有权负责人确认前保持待处理，不静默改变已接受的范围、日期或责任。',
  },
] as const

type V2StageShared = Pick<V2StageSkillDefinition, 'stage' | 'index' | 'statePath' | 'artifacts' | 'workItems'>
type V2StageMethodDefinition = Omit<V2StageSkillDefinition, keyof V2StageShared | 'group'> & {
  readonly group: 'required' | 'conditional'
}

function methodsForStage(
  shared: V2StageShared,
  methods: readonly V2StageMethodDefinition[],
): readonly V2GroupedStageSkillDefinition[] {
  return methods.map(method => ({ ...shared, ...method }))
}

const INVESTIGATION_STAGE_SHARED = {
  stage: 'investigation', index: 2, statePath: '.fde/stages/investigation.json',
  artifacts: [
    'fde-deliverables/03-environment/data-readiness.md',
    'fde-deliverables/03-environment/system-access-map.md',
    'fde-deliverables/03-environment/governance-review.md',
  ],
  workItems: ['data', 'systems', 'access', 'owners'],
} as const

const DESIGN_STAGE_SHARED = {
  stage: 'design', index: 3, statePath: '.fde/stages/design.json',
  artifacts: [
    'fde-deliverables/04-solution-design/mechanism-selection.md',
    'fde-deliverables/04-solution-design/solution-design.md',
    'fde-deliverables/04-solution-design/vertical-slice-record.md',
  ],
  workItems: ['mechanism', 'architecture', 'slice', 'decision'],
} as const

const EVALUATION_STAGE_SHARED = {
  stage: 'evaluation', index: 4, statePath: '.fde/stages/evaluation.json',
  artifacts: [
    'fde-deliverables/05-poc-eval/evaluation-plan.md',
    'fde-deliverables/05-poc-eval/evaluation-report.md',
    'fde-deliverables/05-poc-eval/evaluation-baseline.md',
  ],
  workItems: ['plan', 'cases', 'run', 'conclusion'],
} as const

const EVALUATION_WORKBENCH_RULES = `
## 第五阶段：受测版本与验证记录

阶段仍叫“运行 PoC 与 Eval”，但先在 DSH 当前项目中完成用户授权的项目开发，再对目标系统测试和阶段验收。不要把工作台 Agent 的一次回答或 Headless Trial 当作整个业务系统已通过。

在 .fde/stages/evaluation.json 根对象新增 evaluation，保留原有 schemaVersion=1、stage=evaluation、workItems 的 plan/cases/run/conclusion 和三份固定产物。受测版本与测试结果分开保存；开发留在已有 Agent 对话，工作台不采集开发任务或展示开发进度：

- evaluation.candidate：summary（本轮受测范围）、version（明确版本）、sourceFiles（本轮代码／配置／数据依赖的项目相对文件路径数组）。尚无可运行版本时保持缺失，不虚构版本或范围；缺少 summary/version 时省略字段，不写空字符串。不要求开发任务清单。
- evaluation.testing：environment（实际测试环境）、metrics（动态数组，每项 id/title/kind/required/criterion/sourceRefs）。kind 使用业务、接口、界面、AI、性能或安全等真实测试分类；criterion 写明验收条件、方法和阈值，sourceRefs 指向当前项目中约定该条件的文件。required 必须是布尔值，不能为通过门禁而把关键项目改成可选。
- 准备好定义后调用 project_evaluation_get，读取 testing.fingerprint。它由候选文件真实内容、版本、环境、指标和依据生成；不得自行编造。sourceFiles 必须列全本轮受测实现与依赖，不包含阶段状态自身；当前读取支持最多 100 个候选文件、单文件 8 MiB、全部引用 32 MiB，超限要明确收窄验证范围，不可隐瞒未覆盖内容。
- 用户要求测试后，执行项目自身的真实命令／操作，先保存原始证据，再写 evaluation.testing.run={fingerprint,results}；results 每项 metricId/status/value/evidenceRefs，status 只能 NOT_RUN/RUNNING/PASS/WARN/FAIL。未运行不填 PASS；缺证据不填通过；修复后使用新指纹重跑，旧运行报告保留在各自文件内。
- 只有受测版本明确、当前版本必测项 PASS、有实际结果与可读证据、固定产物齐全且无关键阻塞，才可写 review-ready，并完成四个固定工作项；conclusion 指候选测试结论，不是 FDE 人工决定。使用 project_evaluation_get 重读缺口。不得更改生命周期或伪造 FDE 批准。

所有路径只允许当前项目内相对路径；模型按需读取，不把整仓库或整张图谱加入上下文。启动、预览、停止沿工作台已有运行操作；未明确授权不启动服务、不发起付费调用、不操作生产系统。`

const PILOT_STAGE_SHARED = {
  stage: 'pilot', index: 5, statePath: '.fde/stages/pilot.json',
  artifacts: [
    'fde-deliverables/06-pilot/pilot-scope.md',
    'fde-deliverables/06-pilot/pilot-runbook.md',
    'fde-deliverables/06-pilot/pilot-report.md',
  ],
  workItems: ['integration', 'reliability', 'readiness', 'pilot'],
} as const

const PRODUCTION_STAGE_SHARED = {
  stage: 'production', index: 6, statePath: '.fde/stages/production.json',
  artifacts: [
    'fde-deliverables/07-production-handover/production-review.md',
    'fde-deliverables/07-production-handover/customer-acceptance.md',
    'fde-deliverables/07-production-handover/handover-record.md',
  ],
  workItems: ['readiness', 'release', 'adoption', 'handover'],
} as const

const IMPROVEMENT_STAGE_SHARED = {
  stage: 'improvement', index: 7, statePath: '.fde/stages/improvement.json',
  artifacts: [
    'fde-deliverables/08-improvement/field-learning-register.md',
    'fde-deliverables/08-improvement/improvement-record.md',
    'fde-deliverables/08-improvement/controlled-release-record.md',
  ],
  workItems: ['evidence', 'prioritize', 'validate', 'productize'],
} as const

const V2_STAGE_SKILL_DEFINITIONS: readonly V2GroupedStageSkillDefinition[] = [
  ...methodsForStage(INVESTIGATION_STAGE_SHARED, [
    {
      name: 'access-and-onboarding', label: '把账号、审批和等待事项列清楚', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '记录需要进入哪些系统、谁能批准、当前缺什么，以及等待会怎样影响计划。',
      whenToUse: '开始调查客户现场，或系统访问、账号、环境和审批条件尚未齐备时使用。',
      instructions: '逐项记录系统、环境、账号、申请人、批准人、权限范围、等待时间和替代路径。区分已经开通、已经申请、尚未申请和明确拒绝；不得把能够登录写成已经获准使用数据或执行动作。',
    },
    {
      name: 'data-readiness-assessment', label: '确认数据能不能用于本项目', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '核对数据来源、质量、规模、时效、敏感性和取得方式，判断是否足以支撑目标。',
      whenToUse: '项目结果依赖客户数据，需要确认数据是否存在、能否取得、是否可用和是否合法使用时使用。',
      instructions: '按业务结果核对数据来源、负责人、时间范围、字段口径、规模、质量、敏感级别、取得方式和已知缺口。只把实际查看或验证过的数据写成可用；样例、口头描述和生产数据必须分开记录。',
    },
    {
      name: 'trace-the-flow', label: '跟着一次真实业务走完整链路', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '从真实触发开始，追踪人员、系统、接口、数据和结果经过的每一步。',
      whenToUse: '需要确认客户描述的流程在系统中怎样真实发生，以及问题具体出现在哪里时使用。',
      instructions: '选择一笔真实或经授权的代表案例，从触发、录入、处理、判断、交接到结果逐步追踪，记录每一步的人员、系统、数据、等待、失败和证据。无法观察的环节标记待核对，不用推测补齐链路。',
    },
    {
      name: 'data-archaeology', label: '还原数据口径和历史关系', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '从现有表、字段、查询和历史变更中还原实际数据含义与关系。',
      whenToUse: '客户说法、文档和系统字段不一致，或关键指标口径无法直接确认时使用。',
      instructions: '在授权范围内检查 schema、字段说明、查询、迁移和样例，记录真实数据关系、历史兼容、空值、重复和口径差异。每项结论注明证据位置；没有证据时保留未知，不自行统一业务口径。',
    },
    {
      name: 'secure-ai-action-boundary', label: '划清系统能读什么、能做什么', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '明确模型、工具和人员各自可访问的数据、可执行动作、审批和人工接管路径。',
      whenToUse: '方案可能读取客户数据、调用工具、写入系统或触发真实业务动作时使用。',
      instructions: '逐项记录身份、权限、数据范围、允许动作、禁止动作、审批人、执行前校验、执行后核对和人工接管。默认最小权限；没有明确授权的读取、写入、通知和部署保持禁止。',
    },
    {
      name: 'git-archaeology', label: '查明关键系统为什么这样设计', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '用代码和提交历史解释关键限制、兼容逻辑和真实维护责任。',
      whenToUse: '现有代码行为与文档或人员说法冲突，且该差异会影响项目范围或风险时使用。',
      instructions: '围绕一个明确问题检查相关代码、提交、评审和迁移记录，说明当前行为、形成原因、仍在使用的依赖和真实负责人。历史只能解释事实，不能代替当前业务或安全批准。',
    },
    {
      name: 'governance-boundary-review', label: '分别核对安全、隐私和法务要求', group: 'conditional', source: 'bundled-v2',
      description: '把安全、隐私、法务和客户内部治理要求分别交给有权人员核对并留下状态。',
      whenToUse: '项目涉及敏感数据、受监管业务、外部模型、跨境、保留期限或客户内部审批时使用。',
      instructions: '把安全、隐私、法务和内部治理拆成独立检查项，记录要求、适用范围、负责人、审批状态、限制和升级路径。一类审查不能替代另一类；没有有权结论时保持待确认。',
    },
  ]),
  ...methodsForStage(DESIGN_STAGE_SHARED, [
    {
      name: 'select-ai-mechanism', label: '比较实现方式，不默认使用 Agent', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '比较人工优化、规则、传统软件、机器学习、检索、模型和 Agent 的适用性。',
      whenToUse: '现场条件已经查清，需要选择成本和风险最合适的实现方式时使用。',
      instructions: '以业务结果、数据、系统、权限、可靠性和成本为依据比较不构建、人工改进、规则、传统软件、ML、RAG、LLM 与 Agent。记录为什么选、为什么不选以及退出条件，不因项目名称默认采用 AI。',
    },
    {
      name: 'design-production-ai-system', label: '把方案设计成可长期运行的系统', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '把模型、数据、工具、人工审核、监控、失败处理和责任安排成完整运行链路。',
      whenToUse: '已经选定实现机制，需要形成面向真实环境的整体方案时使用。',
      instructions: '设计输入、数据处理、模型或规则、工具调用、人工复核、输出、监控、异常、降级、恢复和责任流。每个外部动作都写明权限和核验，不把演示链路当成生产方案。',
    },
    {
      name: 'solution-design', label: '记录方案取舍和关键决定', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '形成可比较的候选方案、决定依据、风险、非目标和回退方式。',
      whenToUse: '存在多个可行方案，或关键取舍需要让项目成员和负责人共同复核时使用。',
      instructions: '列出少量真实候选，比较业务效果、交付成本、依赖、风险、可逆性和长期维护，记录选定方案、未选原因、假设、非目标与触发重审的条件。未经 FDE 确认只保持候选状态。',
    },
    {
      name: 'contract-design', label: '把接口、事件和数据约定定清楚', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '明确系统间输入输出、兼容方式、失败响应、版本和迁移责任。',
      whenToUse: '方案需要对接接口、事件、文件、数据库或客户系统时使用。',
      instructions: '逐项定义调用方、提供方、字段、语义、版本、鉴权、幂等、超时、错误、兼容、迁移和负责人。把已验证合同与候选合同分开；不得根据文档存在就写成接口已经可用。',
    },
    {
      name: 'nfr-baseline', label: '定下性能、安全和可用性底线', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '把性能、可靠性、安全、审计、成本和降级要求写成可测量底线。',
      whenToUse: '功能范围基本明确，需要确定系统在真实使用中必须达到的运行标准时使用。',
      instructions: '为性能、容量、可用性、恢复、安全、隐私、审计、成本和人工接管写明场景、指标、阈值、测量方法、责任人和未达处理。缺少客户标准时记录候选值与确认人，不虚构承诺。',
    },
    {
      name: 'safe-change', label: '把改动拆成可审查、可回退的小步', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '为陌生或高风险系统安排最小改动、验证点和恢复路径。',
      whenToUse: '方案需要修改现有生产系统、遗留代码或高风险共享组件时使用。',
      instructions: '把变更拆成边界清楚的小步，每步写明前置条件、影响范围、验证证据、开关、回滚和负责人。未验证的假设先做探针，不把大范围重构包装成必要实现。',
    },
    {
      name: 'integration-adapter', label: '为外部系统设计稳定适配层', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '隔离外部接口的不稳定、限流、错误和数据差异，保护核心流程。',
      whenToUse: '方案依赖无法控制、文档可能不准或版本会变化的外部系统时使用。',
      instructions: '记录外部系统真实行为、认证、限流、重试、超时、错误、字段映射、幂等、降级和观测方式，用最小适配层隔离变化。没有真实调用证据时保持未验证。',
    },
  ]),
  ...methodsForStage(EVALUATION_STAGE_SHARED, [
    {
      name: 'build-ai-evaluation', label: '建立覆盖真实业务的评估体系', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '从真实工作案例建立正常、边界、失败和对抗案例，并定义评分与验收阈值。',
      whenToUse: '候选方案已有可运行切片，需要验证关键假设和业务效果时使用。',
      instructions: '从已确认成功标准选取有代表性的正常、边界、失败和对抗案例，记录来源、输入、期望、评分方法、阈值和复核人。案例覆盖关键风险，不能只挑容易通过的样例。',
    },
    {
      name: 'verification-plan', label: '把每条验收要求对应到验证证据', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '让每条业务和运行要求都有明确检查、执行者、环境与证据路径。',
      whenToUse: '验收要求已经形成，需要规划怎样证明通过或发现失败时使用。',
      instructions: '逐条映射要求、候选版本、环境、前置条件、操作、预期结果、证据文件和责任人。无法验证的要求标记阻塞，不允许用“已实现”或 Agent 自评替代证据。',
    },
    {
      name: 'test-data-strategy', label: '准备合规且能暴露问题的测试数据', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '设计合成、脱敏、子集和边界数据，兼顾真实性、隐私和可复现性。',
      whenToUse: '评估需要客户数据或特殊边界案例，但生产数据不能直接使用或覆盖不足时使用。',
      instructions: '说明数据来源、授权、脱敏、代表性、边界、版本、隔离和清理方式。测试数据必须能够回溯并复现，不得把合成数据结果写成生产数据结论。',
    },
    {
      name: 'nfr-validation', label: '实测性能、可靠性和安全底线', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '在明确环境中测量性能、容量、故障恢复、安全和审计表现。',
      whenToUse: '方案的功能链路可运行，需要验证非功能底线是否真实达到时使用。',
      instructions: '按既定场景和阈值执行性能、容量、失败、恢复、安全、审计和成本验证，记录环境、版本、命令、原始结果和异常。没有实际执行不得记录通过。',
    },
    {
      name: 'characterization-tests', label: '先固定旧系统当前行为', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '在改动遗留系统前，用测试记录当前实际行为和关键例外。',
      whenToUse: '验证涉及缺少测试的遗留代码，且现有行为可能在改动中被误伤时使用。',
      instructions: '围绕真实调用和关键边界补充能够复现当前行为的测试，先记录事实再判断是否正确。测试必须可重复执行，不能把历史缺陷自动认定为目标行为。',
    },
    {
      name: 'security-compliance-check', label: '核对敏感数据、密钥、日志和审计', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '检查方案和实现是否遵守已经确认的安全、隐私与审计要求。',
      whenToUse: '评估涉及敏感数据、凭据、外部模型、日志、权限或受监管流程时使用。',
      instructions: '根据已确认要求检查敏感数据流、身份权限、密钥、传输与存储加密、日志、保留、审计和删除。只记录实际检查结果，发现缺口要保留严重级别和责任人。',
    },
    {
      name: 'ci-forensics', label: '判断自动化检查为什么失败', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '区分真实缺陷、偶发失败、环境漂移和资源问题，保留可重现证据。',
      whenToUse: '构建、测试或评估流水线失败，且原因不清或重复运行结果不一致时使用。',
      instructions: '固定版本和环境，收集失败日志、首次异常、历史结果与最小复现，分类真实故障、偶发、环境或资源问题。不得靠反复重跑把失败写成通过。',
    },
  ]),
  ...methodsForStage(PILOT_STAGE_SHARED, [
    {
      name: 'review-ai-production-readiness', label: '检查试点前还缺哪些生产条件', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '从数据、权限、可靠性、支持、成本和停止条件判断是否具备有限试点条件。',
      whenToUse: 'PoC 与 Eval 已有结论，需要决定能否进入客户环境开展受控试点时使用。',
      instructions: '逐项核对候选版本、数据、身份权限、监控、容量、成本、支持、停止与恢复条件，给出 Green、Amber 或 Red 及证据。建议不能代替 FDE 的试点授权。',
    },
    {
      name: 'pilot-scope-and-authority', label: '定清试点对象、范围和授权', group: 'required', source: 'bundled-v2',
      description: '明确谁参与、在哪运行、能处理什么、观察多久，以及谁有权开始或停止。',
      whenToUse: '准备真实试点，需要把有限范围和外部动作授权写清楚时使用。',
      instructions: '记录试点人员、业务场景、环境、数据、流量、时间、允许动作、禁止动作、成功与停止条件、批准人和授权证据。没有本轮明确授权时只形成计划，不执行外部动作。',
    },
    {
      name: 'enterprise-integration-readiness', label: '核对企业系统接入是否齐备', group: 'required', source: 'bundled-v2',
      description: '检查身份、网络、接口、数据、审计和支持责任是否满足试点运行。',
      whenToUse: '试点依赖客户网络、账号、接口、数据源或内部平台时使用。',
      instructions: '按真实接入链路核对网络、认证、授权、接口版本、数据映射、限流、审计、告警和责任人，记录已验证、待开通和被拒绝项。技术可连接不等于已获业务授权。',
    },
    {
      name: 'reliability-and-recovery', label: '补齐监控、接管和恢复能力', group: 'required', source: 'bundled-v2',
      description: '明确系统失效时如何发现、降级、人工接管、恢复和回滚。',
      whenToUse: '候选版本准备进入真实用户或真实数据环境，需要降低试点风险时使用。',
      instructions: '记录健康信号、告警阈值、值守人、降级、人工接管、重试、恢复、备份和回滚步骤，并验证关键路径。没有演练证据的能力标记未验证。',
    },
    {
      name: 'pilot-evidence-review', label: '整理试点过程和业务结果', group: 'required', source: 'bundled-v2',
      description: '把试点中的使用量、业务结果、人工介入、异常、成本和反馈整理成可复核结论。',
      whenToUse: '受控试点已经实际运行，需要决定扩大、延长、收窄、回滚或停止时使用。',
      instructions: '按授权范围和观察期整理实际运行记录、业务结果、采用、人工介入、错误、事故、成本和用户反馈，并与基线和成功标准比较。模拟和缺失数据不得计入真实试点结果。',
    },
    {
      name: 'change-control-navigation', label: '走完客户的变更审批流程', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '记录发布窗口、审批材料、冻结期、风险接受和最终批准。',
      whenToUse: '客户要求 CAB、变更单、发布窗口或其他正式审批后才能试点时使用。',
      instructions: '列出变更内容、影响、验证、回滚、窗口、审批人和状态，按客户流程提交并保存证据。未批准不得把排期或变更写成已确认。',
    },
    {
      name: 'deploy-runbook', label: '写出别人也能执行的部署与回滚步骤', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '把部署、校验、停止、恢复和回滚写成可由授权人员复现的操作说明。',
      whenToUse: '试点需要部署到客户环境，或执行人员不是当前开发者时使用。',
      instructions: '按前置检查、部署、健康验证、业务验证、监控、停止、恢复和回滚编写步骤，注明命令、预期结果、责任人和失败分支。未经授权只准备手册，不执行部署。',
    },
  ]),
  ...methodsForStage(PRODUCTION_STAGE_SHARED, [
    {
      name: 'release-readiness', label: '确认生产发布证据是否齐全', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '汇总版本、测试、风险、审批、回滚和支持证据，形成可复核的发布建议。',
      whenToUse: '试点结果已经形成，需要决定是否进入生产发布时使用。',
      instructions: '核对准确版本、制品、测试、已知问题、数据迁移、监控、回滚、支持和批准，给出 Green、Amber 或 Red 及未决事项。建议不等于 FDE 或客户批准。',
    },
    {
      name: 'transfer-ai-service', label: '证明客户团队能够接管服务', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '验证客户能够独立运行、监控、处理异常、变更和升级服务。',
      whenToUse: '准备从 FDE 主导转为客户团队日常负责时使用。',
      instructions: '让接收人员实际完成启动、停止、监控、常见故障、恢复、变更和升级，记录人员、时间、结果、缺口与后续责任。培训完成不等于已经能够独立接管。',
    },
    {
      name: 'post-deploy-watch', label: '安排上线后的重点观察', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '定义上线观察期、业务和技术信号、值守责任及回滚触发条件。',
      whenToUse: '生产发布获批，需要在上线后及时发现业务或技术异常时使用。',
      instructions: '记录观察期、基线、关键指标、告警、人工抽查、负责人、升级和回滚触发条件，按真实结果更新状态。服务在线不能代替业务结果和用户采用证据。',
    },
    {
      name: 'operate-ai-service', label: '建立日常运营和服务复盘', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '明确 SLO、成本、质量、人工介入、事故、变更和周期复盘的日常责任。',
      whenToUse: '系统进入生产，需要持续管理服务质量、业务结果和运行成本时使用。',
      instructions: '定义业务与技术 SLO、质量抽查、成本、人工介入、事故、变更、容量、模型或规则更新及复盘频率，明确数据来源和责任人。没有实际生产证据时不填充正常运行结论。',
    },
    {
      name: 'handover-pack', label: '整理可取得的交付包和已知事项', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '汇总准确制品、源代码、配置、文档、运行手册、决定和未完成事项。',
      whenToUse: '客户验收或责任移交前，需要确认实际交付内容和取得方式时使用。',
      instructions: '逐项记录交付内容、版本、位置、校验值、访问人、文档、已知问题、风险和未完成事项。文件名存在不等于客户已取得，不得把缺失或不可访问内容标记为已交付。',
    },
    {
      name: 'enablement-handoff', label: '让接收团队完成实操验收', group: 'required', source: FRAME_ENGINEERING_SOURCE,
      description: '通过培训、结对和实际操作确认接收团队能够承担约定责任。',
      whenToUse: '交付包基本齐备，需要完成培训、操作验证和责任签收时使用。',
      instructions: '安排面向真实角色的培训和实操，让接收人独立完成关键任务并记录结果、问题、补课和签收。仅发送文档或参加会议不能作为能力移交完成的证据。',
    },
    {
      name: 'cutover-plan', label: '规划新旧系统切换和不可逆点', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '明确双跑、数据同步、对账、切换步骤、停止条件和不可逆时点。',
      whenToUse: '生产发布需要从旧流程或旧系统切换到新系统时使用。',
      instructions: '记录新旧系统、数据同步、双跑、对账、切换窗口、决策人、回滚和不可逆点，并给每一步配置验证证据。未经批准不执行真实切换。',
    },
    {
      name: 'decommission-plan', label: '确认没有使用者后再下线旧系统', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '核对剩余使用者、数据保留、依赖、访问和恢复要求后安全退役旧能力。',
      whenToUse: '新系统稳定后准备关闭旧服务、旧接口、旧数据管道或临时试点资源时使用。',
      instructions: '盘点所有调用方、人员、数据、合规保留、备份、恢复和批准，确认没有剩余使用后再形成下线步骤。发现未知消费者时保持阻塞。',
    },
  ]),
  ...methodsForStage(IMPROVEMENT_STAGE_SHARED, [
    {
      name: 'production-evidence-review', label: '复盘业务结果、采用和运行问题', group: 'required', source: 'bundled-v2',
      description: '从生产指标、用户采用、人工修正、事故、成本和反馈中确认真实变化。',
      whenToUse: '系统已进入稳定运行，需要决定下一轮改进或继续投入方向时使用。',
      instructions: '对照基线整理业务结果、采用、质量、人工介入、事故、成本和客户反馈，区分稳定趋势、偶发事件和缺失证据。没有生产数据时不生成改进结论。',
    },
    {
      name: 'improvement-prioritization', label: '按影响、风险和成本排改进顺序', group: 'required', source: 'bundled-v2',
      description: '把生产问题和机会按业务影响、频率、风险、投入与可逆性排成候选队列。',
      whenToUse: '生产证据形成多个改进方向，需要确定本轮先处理什么和暂不处理什么时使用。',
      instructions: '为每个候选记录来源、受影响人群、频率、业务影响、风险、成本、依赖、可逆性和预期证据，给出少量优先项及不做项。排序建议仍由 FDE 和有权负责人确认。',
    },
    {
      name: 'improvement-validation', label: '证明改进解决原问题且没有带来回归', group: 'required', source: 'bundled-v2',
      description: '复用原验收证据并增加回归、生产相似和失败场景，验证改进效果。',
      whenToUse: '改进已经实现，准备决定是否发布或扩大使用时使用。',
      instructions: '回指原问题、基线和验收案例，执行目标案例、回归、边界和失败验证，记录版本、环境、结果和证据。只在实际执行后标记通过，未解决或新回归必须保留。',
    },
    {
      name: 'productize-field-learning', label: '判断现场经验能否沉淀为复用能力', group: 'required', source: VALUE_METHOD_SOURCE,
      description: '区分客户特有做法与可跨项目复用的规则、组件、案例和工作方法。',
      whenToUse: '一个现场问题已经被验证解决，需要判断哪些经验值得产品化或标准化时使用。',
      instructions: '记录问题、解决方式、证据、适用条件、依赖、隐私处理、维护成本、不适用边界和独立复现结果。未经去标识和跨场景验证，只能登记为客户内候选。',
    },
    {
      name: 'incident-triage', label: '从生产症状定位并先恢复业务', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '区分止血与根因修复，用最短证据链定位生产异常影响和责任。',
      whenToUse: '生产出现业务中断、质量异常、错误上升或成本失控，需要立即处理时使用。',
      instructions: '先确认影响、时间、范围和安全边界，再选择最小止血措施，保存日志、指标、变更和复现证据。恢复业务后另行记录根因、修复和防复发，不在未知影响下扩大变更。',
    },
    {
      name: 'observability-gap', label: '补齐看不见、找不到的问题信号', group: 'conditional', source: FRAME_ENGINEERING_SOURCE,
      description: '识别发现太晚、定位太慢或无法判断业务影响的日志、指标和追踪缺口。',
      whenToUse: '问题发生后无法及时发现、关联到业务结果或确定原因时使用。',
      instructions: '从一次真实问题倒推缺失的业务指标、技术指标、日志、追踪、关联 ID、告警和责任人，优先补最小可行动信号。避免记录敏感数据或制造无法处理的告警。',
    },
    {
      name: 'improvement-release-control', label: '让改进版本小范围发布并可随时回退', group: 'conditional', source: 'bundled-v2',
      description: '为改进版本定义批准、Canary、观察、扩大、停止和回滚条件。',
      whenToUse: '经验证的改进准备进入生产，且需要控制影响范围时使用。',
      instructions: '记录准确版本、批准人、初始范围、Canary 指标、观察期、扩大条件、停止条件和回滚责任，按实际发布结果更新。未经测试或授权不得改变生产系统。',
    },
  ]),
] as const

function contentFor(definition: V2StageSkillDefinition): string {
  const artifactList = definition.artifacts.map((path, index) => `${String(index + 1)}. \`${path}\``).join('\n')
  const workItemList = definition.workItems.map(id => `\`${id}\``).join('、')
  const stateExample = JSON.stringify({
    schemaVersion: 1,
    stage: definition.stage,
    status: 'working',
    workItems: definition.workItems.map((id, index) => ({ id, status: index === 0 ? 'current' : 'waiting' })),
    blockers: [],
    recommendation: 'pending',
    ...(definition.stage !== 'investigation' ? {} : {
      investigation: {
        systems: [],
        connections: [],
        actionBoundaries: [],
        dataFindings: [],
        governanceReviews: [],
      },
    }),
    ...(definition.stage !== 'design' ? {} : {
      design: {
        execution: { status: 'undecided' },
        semantics: { mode: 'undecided', conclusion: 'pending' },
        ontology: { status: 'not_applicable' },
        graphBuild: { status: 'not_applicable' },
      },
    }),
  }, null, 2)
  // oxlint-disable @stylistic/quotes -- Multiline stage contracts require template literals.
  const investigationRules = definition.stage !== 'investigation' ? '' : `\n\n## 环境调查驾驶舱\n\n为了让工作台展示真实环境，而不是写死示例，调查后同步维护 \`investigation\`。五组数组中每个元素必须严格使用以下字段，不能用近义字段替代：\n\n- \`systems[]\`：\`{ id, label, kind, status, owner?, note? }\`；\`kind\` 只能是 \`data\`、\`system\`、\`external\` 或 \`actor\`，\`status\` 只能是 \`confirmed\`、\`conditional\`、\`pending\` 或 \`blocked\`。\n- \`connections[]\`：\`{ from, to, label? }\`；\`from\` 和 \`to\` 只能引用 \`systems\` 中已有的稳定 \`id\`。\n- \`actionBoundaries[]\`：\`{ target, read, suggest, draft, execute }\`；对象字段必须叫 \`target\`，四种动作状态只能是 \`allowed\`、\`conditional\`、\`pending\`、\`denied\` 或 \`not-applicable\`。\n- \`dataFindings[]\`：\`{ label, value, status }\`；不要写成 \`id/note/source\`，\`status\` 只能是 \`confirmed\`、\`warning\`、\`pending\` 或 \`blocked\`。来源证据保留在固定产物中。\n- \`governanceReviews[]\`：\`{ area, status, owner?, note? }\`；\`area\` 只能是 \`security\`、\`privacy\`、\`legal\`、\`procurement\`、\`finance\` 或 \`business\`，\`status\` 只能是 \`confirmed\`、\`conditional\`、\`pending\` 或 \`blocked\`。不要使用 \`partial\`、\`unconfirmed\` 或 \`confirmed-in-simulation\` 等自定义状态，应归一为允许值并在 \`note\` 保留原始限定。\n\n没有证据时使用空数组或 pending，不得填入演示数据。写完后必须重新读取状态文件，逐项核对字段名和枚举；任一结构无效时不得把阶段写成 review-ready。\n\n第三阶段只调查真实环境与动作边界，不构建本体、不设计架构、不选择模型，也不开始开发。`
  const designRules = definition.stage !== 'design' ? '' : `\n\n## 第四阶段双轴路线与图谱快照\n\n先分别记录“采用什么执行机制”和“是否需要本体”，不能因已集成 Semantica 就默认选择知识图谱：\n\n- \`design.execution\`：\`status\` 只能是 \`undecided\`、\`candidate\` 或 \`selected\`；形成候选后必须填写 \`mechanism\`，其值只能是 \`manual\`、\`rules\`、\`software\`、\`retrieval\`、\`model\`、\`agent\` 或 \`hybrid\`，并可用 \`label/rationale\` 记录业务名称与证据理由。\n- \`design.semantics\`：\`mode\` 只能是 \`undecided\`、\`schema\` 或 \`ontology\`；\`conclusion\` 只能是 \`pending\`、\`not_required\`、\`validated\`、\`validation_failed\` 或 \`insufficient_evidence\`。\`schema\` 路线只能记录 \`pending/not_required\`。\n- \`design.ontology\`：非本体路线固定为 \`{ status: "not_applicable" }\`；本体路线的 \`status\` 只能是 \`not_started\`、\`draft\`、\`review\`、\`published\` 或 \`stale\`，可记录 \`schemaVersion/classCount/relationshipTypeCount\`。\n- \`design.graphBuild\`：非本体路线固定为 \`{ status: "not_applicable" }\`；本体路线只能记录 \`waiting\`、\`running\`、\`succeeded\`、\`failed\`、\`cancelled\` 或 \`stale\`，可用 \`message\` 说明真实运行状态。\n\n只有本体路线才能由项目隔离的 Semantica Provider 在 \`.fde/design/knowledge-graph.json\` 写入真实快照。普通 Schema 路线不得生成图谱占位文件；不得用演示节点、示例关系或 Semantica 的全局 Demo 图填充项目工作台。快照根对象固定为 \`{ schemaVersion: 1, provider, graphId, revision, ontologyVersion, updatedAt, nodes, edges, communities }\`：\n\n- \`provider\`：\`{ id, version? }\`，记录实际构建 Provider。\n- \`nodes[]\`：\`{ id, label, type, summary?, communityId?, confidence?, validFrom?, validUntil?, sourceRefs }\`。\n- \`edges[]\`：\`{ id, source, target, type, label?, weight, confidence?, validFrom?, validUntil?, sourceRefs }\`；起止节点必须已经登记。\n- \`communities[]\`：\`{ id, label, level, nodeIds }\`；只能引用快照中的真实节点。\n\n每个实体和关系的来源、时间与置信度都来自本轮构建证据；工作台只负责渲染该快照。图谱构建成功不等于 Schema 验证、能力问题或纵向切片已经通过，最终结论和阶段推进仍由 FDE 人工确认。`
  // oxlint-enable @stylistic/quotes
  return `# ${definition.label}\n\n${definition.instructions}\n\n## 固定产物\n\n${artifactList}\n\n状态文件：\`${definition.statePath}\`；其中根对象 \`stage\` 必须固定写为 \`${definition.stage}\`，不能写成产物目录名或中文阶段名。固定工作项 ID：${workItemList}。\n\n## 状态文件结构\n\n下面只示范固定 JSON 结构；各项状态、阻塞和建议必须依据本轮事实填写：\n\n\`\`\`json\n${stateExample}\n\`\`\`${investigationRules}${designRules}\n\n${COMMON_V2_STAGE_RULES}${definition.stage === 'evaluation' ? EVALUATION_WORKBENCH_RULES : ''}`
}

function registeredSkill(definition: V2StageSkillDefinition) {
  return {
    name: definition.name,
    description: definition.description,
    whenToUse: definition.whenToUse,
    source: definition.source,
    content: contentFor(definition),
  }
}

/** Six stage-two Skills unique to result, scope, feasibility, estimation, planning, and renegotiation. */
export const DEFINITION_STAGE_SKILLS = DEFINITION_STAGE_SKILL_DEFINITIONS.map(registeredSkill)

/** Stage-two methods supplied by this module; cross-stage methods are composed in index.ts. */
export const DEFINITION_STAGE_SKILL_CATALOG_METHODS = DEFINITION_STAGE_SKILL_DEFINITIONS.map((
  definition,
  index,
): StageSkillCatalogMethod => ({
  id: definition.name,
  label: definition.label,
  description: definition.description,
  whenToUse: definition.whenToUse,
  source: definition.source,
  content: contentFor(definition),
  group: index < 5 ? 'required' : 'conditional',
}))

/** Skills registered by V2 stages two through eight. */
export const V2_STAGE_SKILLS = [
  ...DEFINITION_STAGE_SKILLS,
  ...V2_STAGE_SKILL_DEFINITIONS.map(registeredSkill),
]

const V2_POST_DEFINITION_STAGES = [
  { id: 'investigation', index: 2, label: '调查数据、系统、接口、安全与组织' },
  { id: 'design', index: 3, label: '设计方案并完成端到端纵向切片' },
  { id: 'evaluation', index: 4, label: '运行 PoC 与 Eval' },
  { id: 'pilot', index: 5, label: '完成企业集成、可靠性改造与受控试点' },
  { id: 'production', index: 6, label: '进入生产、推动采用并验收交接' },
  { id: 'improvement', index: 7, label: '持续改进并沉淀可复用能力' },
] as const

/** Read-only business catalog for all post-discovery V2 stages. */
export const V2_STAGE_SKILL_CATALOG = V2_POST_DEFINITION_STAGES.map(stage => ({
  id: stage.id,
  index: stage.index,
  methods: V2_STAGE_SKILL_DEFINITIONS.filter(definition => definition.stage === stage.id).map(definition => ({
    id: definition.name,
    label: definition.label,
    description: definition.description,
    whenToUse: definition.whenToUse,
    source: definition.source,
    content: contentFor(definition),
    group: definition.group,
  })),
})) satisfies StageSkillCatalogValue['stages']

/** Return short model guidance for the current authoritative V2 stage. */
export function v2StagePrompt(stage: FdeV2StageId): string {
  if (stage === 'evaluation') return '当前 FDE 项目处于“运行 PoC 与 Eval”。依据第四阶段已确认方案，在 DSH 当前项目与已有 Agent 对话中完成用户授权的开发和联调；不要一进入阶段就跳过开发去生成报告。工作台只展示有效信息，不要求开发任务清单。准备或执行验证时按需加载 `verification-plan` 等既有方法；模型或 Agent 验证按需使用 `build-ai-evaluation`，CI 故障按需使用 `ci-forensics`，不得为了显得完整一次加载全部，同步 .fde/stages/evaluation.json 中 evaluation.candidate 与 evaluation.testing，根对象 `stage` 必须固定写为 `evaluation`，保留 plan/cases/run/conclusion 固定工作项；通过 project_evaluation_get 获取当前版本指纹，真实执行后才记录结果。复用已有架构、启动、预览、终端与停止能力；项目开发与运行均需用户明确请求。测试按目标系统选用，Agent Trial 不能替代整个系统验证；不自动推进阶段。'
  if (stage === 'definition') {
    return '当前 FDE 项目处于“定义结果、范围与责任”。用户开展本阶段工作时，先按任务加载必要方法：通常从 `engineer-ai-value` 开始，再根据当前缺口使用 `requirements-to-spec`、`feasibility-probe`、`estimation` 或 `delivery-plan`；信息不足、现场事实变化、需要负责人决定或范围周期资源冲突时，才分别使用 `qualify-ai-workflow`、`reframe-ai-engagement`、`stakeholder-brief` 或 `escalation-and-renegotiation`。不得为了显得完整一次加载全部。严格维护固定产物与状态文件；`.fde/stages/definition.json` 根对象的 `stage` 必须固定写为 `definition`，不能写成 `outcome-scope`；`workItems` 必须是逐项包含 `id` 与 `status` 的数组，不能写成对象映射。只记录真实来源和执行证据；你不能代替 FDE 确认客户结论、执行未授权外部动作或推进项目阶段。'
  }
  const stageDefinition = V2_POST_DEFINITION_STAGES.find(item => item.id === stage)
  const definitions = V2_STAGE_SKILL_DEFINITIONS.filter(item => item.stage === stage)
  const [firstDefinition] = definitions
  if (stageDefinition === undefined || firstDefinition === undefined) return ''
  const required = definitions.filter(item => item.group === 'required').map(item => `\`${item.name}\``).join('、')
  const conditional = definitions.filter(item => item.group === 'conditional').map(item => `\`${item.name}\``).join('、')
  const statePath = firstDefinition.statePath
  const stageBoundary = stage === 'investigation'
    ? '同步维护 investigation 的真实系统节点、连接、动作边界、数据发现和独立治理审查；字段必须严格使用 systems 的 id/label/kind/status、connections 的 from/to/label、actionBoundaries 的 target/read/suggest/draft/execute、dataFindings 的 label/value/status，以及 governanceReviews 的 area/status/owner/note，不能用 object、id/note/source 或自定义状态替代；没有证据时保持空数组或 pending。第三阶段不得设计架构、选择模型或开始开发。'
    : stage === 'design'
      ? '同步维护 design 的执行机制与语义基础双轴判断；不能因已接入 Semantica 就默认采用本体。只有 ontology 路线才能由项目隔离的 Provider 写入 `.fde/design/knowledge-graph.json` 真实快照；schema 路线不得生成图谱占位，任何路线都不得填入演示节点。图谱构建成功不等于纵向切片或阶段评审通过。'
      : ''
  return `当前 FDE 项目处于“${stageDefinition.label}”。本阶段必做方法：${required}；只有出现对应业务条件时才使用：${conditional}。先判断当前任务和缺口，再加载最少必要的 Skill；不得为了显得完整一次加载全部。严格维护固定产物与状态文件；\`${statePath}\` 根对象的 \`stage\` 必须固定写为 \`${stage}\`；\`workItems\` 必须是逐项包含 \`id\` 与 \`status\` 的数组，不能写成对象映射。${stageBoundary}只记录真实来源和执行证据；你不能代替 FDE 确认客户结论、执行未授权外部动作或推进项目阶段。`
}

/** FDE project-stage Host plugin. @module @deepseek-ai/dsh-fde-stage */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import {
  loadAcceptanceHandoverStage,
  loadDeploymentTrialStage,
  loadDevelopmentDocs,
  loadRequirementArtifacts,
  loadSolutionArtifacts,
  loadValidationStage,
  readProjectArchitecture,
} from '@deepseek-ai/dsh-fde-project'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import {
  createCompleteDevelopmentRoute,
  createCompleteHandoffRoute,
  createCompletePilotRoute,
  createCompleteRequirementsRoute,
  createCompleteSolutionRoute,
  createCompleteValidationRoute,
  createReturnStageRoute,
  createStageRoute,
} from './http.ts'
import { fdeStageDomainSpec, type FdeProjectState } from './spec.ts'
import { FdeStageState } from './state.ts'

export { FdeStageRequestError, createCompleteDevelopmentRoute, createCompleteHandoffRoute, createCompletePilotRoute, createCompleteRequirementsRoute, createCompleteSolutionRoute, createCompleteValidationRoute, createReturnStageRoute, createStageRoute } from './http.ts'
export { FDE_PROJECT_STATE_IDS, FDE_STAGE_IDS, fdeProjectState, fdeStageDomainSpec, fdeStageId, projectStageRecord, stageReturnRecord } from './spec.ts'
export type { FdeProjectState, FdeStageId, ProjectStageRecord } from './spec.ts'
export { FdeStageConflictError, FdeStageReturnError, FdeStageState, FdeStageTransitionError } from './state.ts'

/** Stable Host route used by the FDE Stage browser plugin. */
export const FDE_STAGE_OPEN_PATH = '/api/fde-stage/open'
/** Fixed manual gate from requirement research to solution design. */
export const FDE_STAGE_COMPLETE_REQUIREMENTS_PATH = '/api/fde-stage/requirements/complete'
/** Fixed manual gate from solution design to project development. */
export const FDE_STAGE_COMPLETE_SOLUTION_PATH = '/api/fde-stage/solution/complete'
/** Fixed manual gate from project development to validation. */
export const FDE_STAGE_COMPLETE_DEVELOPMENT_PATH = '/api/fde-stage/development/complete'
/** Fixed manual gate from validation to pilot deployment. */
export const FDE_STAGE_COMPLETE_VALIDATION_PATH = '/api/fde-stage/validation/complete'
/** Fixed manual gate from deployment trial to acceptance handover. */
export const FDE_STAGE_COMPLETE_PILOT_PATH = '/api/fde-stage/pilot/complete'
/** Fixed manual gate from acceptance handover to project completion. */
export const FDE_STAGE_COMPLETE_HANDOFF_PATH = '/api/fde-stage/handoff/complete'
/** FDE-only one-step return route, including terminal project reopening. */
export const FDE_STAGE_RETURN_PATH = '/api/fde-stage/return'
/** Cordis plugin name. */
export const name = 'fde-stage'
/** Required durable Workspace, model guidance, and same-origin Web services. */
export const inject = ['skills', 'storageDomain', 'systemPrompt', 'workspaceRegistry', 'webServer']

/** Runtime Skill loaded on demand while an FDE is consolidating requirements. */
export const REQUIREMENT_RESEARCH_SKILL = {
  name: 'fde-requirement-research',
  description: '整理 FDE 项目需求调研资料，并在固定目录生成或更新需求调研报告、需求确认清单和候选需求基线。',
  whenToUse: '当前项目处于需求调研，用户要求梳理、收敛或更新阶段材料时使用。',
  source: 'bundled',
  content: `# FDE 需求调研产物

只在当前项目的需求调研工作中使用本 Skill。先读取用户本次明确授权的项目资料、当前对话，以及固定路径中已经存在的产物；不要把未读取的资料说成已经核对。

## 固定产物

1. \`fde-deliverables/01-requirement-research/requirement-research-report.md\`
   - 业务背景与目标、角色与使用场景、现状流程、目标流程、系统与数据、范围、约束、风险、验收方向、未知项。
2. \`fde-deliverables/01-requirement-research/confirmation-checklist.md\`
   - 每项写清待确认问题、来源依据、影响、当前答复和状态；没有客户或 FDE 明确答复时不得标为已确认。
3. \`fde-deliverables/01-requirement-research/requirement-baseline.md\`
   - 汇总候选范围、明确不做、关键业务规则、数据边界、验收方向、依赖与仍保留的未决项。

## 工作规则

- 把内容区分为“来源事实”“合理推断”“未知/待确认”，并尽可能标注对应文件或对话依据。
- 有新资料或新结论时更新同一文件，不创建 final、v2、new 等平行最终稿。
- 资料冲突时保留冲突双方及其来源，不自行选择客户结论。
- 三份文件都是候选阶段产物。不得声称客户已经确认，不得改变项目阶段；是否进入方案设计只能由 FDE 在项目进度页决定。
- 若信息不足，先在需求确认清单记录缺口，并在回复中明确建议 FDE 下一步向客户确认什么。`,
} as const

/** Runtime Skill loaded on demand while an FDE is consolidating the solution. */
export const SOLUTION_DESIGN_SKILL = {
  name: 'fde-solution-design',
  description: '把已确认需求收敛为项目 PRD、方案设计、研发计划、验收方案、候选方案基线和项目级系统架构。',
  whenToUse: '当前项目处于方案设计，用户要求设计、收敛或更新项目方案时使用。',
  source: 'bundled',
  content: `# FDE 方案设计产物

只在当前项目的方案设计工作中使用本 Skill。先读取已确认的需求基线、用户本次明确授权的项目资料和当前对话，再读取固定路径中已有的方案产物。不要把候选方案或推断写成客户已经确认的需求。

## 固定文档

1. \`fde-deliverables/02-solution-design/project-prd.md\`
   - 定义“要做什么”：用户与角色、业务目标、用户/业务流程、功能需求、业务规则、输入输出与数据、AI 行为与失败回退、约束、需求到验收的映射，以及仍待确认的产品问题。
2. \`fde-deliverables/02-solution-design/solution-design.md\`
   - 定义“怎么做”：系统边界、技术组件、集成关系、数据与 AI 实现策略、关键技术决策、非目标，以及项目 PRD 条目与实现方案的对应关系；不要重复项目 PRD 中的产品范围和角色定义。
3. \`fde-deliverables/02-solution-design/development-plan.md\`
   - 工作包、里程碑、实施顺序、数据与环境准备、外部依赖、风险和候选时间安排。
4. \`fde-deliverables/02-solution-design/acceptance-plan.md\`
   - 可检查的业务、功能、AI、性能、安全、部署和试运行验收条件，以及验证证据要求。
5. \`fde-deliverables/02-solution-design/solution-baseline.md\`
   - 候选方案版本、需求基线引用、关键决策、未决项、已接受风险，以及原型、API 契约、数据映射和 POC 是否适用及其证据位置。

## 系统架构

### 先取证，再建模

1. 先调用 \`architecture_get\`，保留它返回的完整候选、revision 和仍代表相同概念的 ID。
2. 读取已确认的需求基线和本阶段五份固定文档，再只读检查真实源码：依赖清单与应用入口、API/事件/消息入口、核心服务和领域边界、存储、模型或 Agent 集成、外部系统、部署配置及交付输出。
3. 文档与源码不一致时，源码用于描述当前实现，文档用于描述待实施候选；在 summary 或相关节点 note 中标明差异和未知项，不虚构已经存在或部署的组件。项目尚无实现源码时，只能根据已确认文档建立候选架构。

### 建模规则

- 按入口到交付输出的主链路排列 2–7 个职责分组；极小项目可以少于 2 个，不为凑数拆层。每组通常保留 1–8 个主要节点。
- 节点只表示重要运行组件、业务能力、数据存储、外部边界或独立交付输出，不把目录、文件、类、函数、任务步骤、运行轨迹或隐藏推理画成节点。
- \`entry\` 表示人员或系统入口；\`core\` 表示编排、应用、领域或 AI 核心能力；\`store\` 表示持久数据、证据或产物；\`external\` 表示第三方、私有模型、客户系统等外部边界；\`output\` 表示可独立交付的报告、API 或结果；只有都不适用时才使用 \`default\`。
- ID 使用稳定的 kebab-case。保留仍代表同一概念的现有 ID；label 简短明确，note 说明真实职责、依据、限制或未知项，不写空泛宣传语。
- 只提交关键运行时、数据流、控制流或依赖关系。边从实际发起方指向接收方，label 使用简短动作；不提交可由已有边推导的传递关系、重复关系或类级调用。\`dashed\` 只用于可选、异步或尚待落实的候选关系，并在 label 或 note 中说明含义。
- \`groups\` 的数组顺序对应入口到输出的顺序；同组节点按主要路径优先排列。优先保留主链路和重要分支，不枚举所有调用。

### 提交候选

- 提交前检查分组和节点 ID 唯一、节点引用的分组存在、边的两端存在、没有自环或重复边；除真实孤立边界外，每个主要节点都应接入一条有意义的关系。
- 用 \`architecture_set\` 一次提交完整候选，并携带 \`architecture_get\` 返回的精确 expected revision。不要直接写 \`.fde/architecture.json\`。
- 新候选保持待审阅状态，由 FDE 在“系统架构”中确认；你不能自行确认或推进阶段。

## 工作规则

- 明确区分“已确认需求”“方案选择”“合理推断”“未知/待确认”，并尽可能引用需求基线、文件或对话依据。
- 有新事实或新决定时更新同一文件，不创建 final、v2、new 等平行最终稿。
- 原型、API 契约、数据映射和 POC 按项目实际情况决定，不机械补造；在方案基线记录适用性、证据或不适用理由。
- 五份文档和系统架构都是候选阶段产物。不得声称客户或 FDE 已经确认，不得改变项目阶段；是否进入项目开发只能由 FDE 在项目进度页决定。`,
} as const

/** Runtime Skill loaded on demand while an FDE is planning and executing development. */
export const PROJECT_DEVELOPMENT_SKILL = {
  name: 'fde-project-development',
  description: '按统一 docs 规范拆分、实施和追踪 FDE 项目研发，同步结构性架构变化，并在开发完成时形成固定收口产物。',
  whenToUse: '当前项目处于项目开发，用户要求规划、拆分、实施、检查研发进度或收口开发，或者要求生成或更新系统架构时使用。',
  source: 'bundled',
  content: `# FDE 项目开发规范

只在当前项目的项目开发阶段使用本 Skill。先读取已确认的项目 PRD、方案、架构、现有源码和已有 docs，再决定本次需要补文档还是实施功能。不要用模板内容覆盖真实项目事实。

## 标准 docs

1. \`docs/PRD.md\`：产品目标、范围、需求和验收。
2. \`docs/specs/product-spec.md\`：跨 Feature 的对象、状态、不变量和共享行为。
3. \`docs/specs/feature-map.md\`：Feature、依赖、优先级和真实状态。
4. \`docs/specs/FNNN-slug/spec.md\`：一个 Feature 的可观察行为、边界和验收。
5. \`docs/specs/FNNN-slug/plan.md\`：影响范围、实施顺序、风险、回退和验证。
6. \`docs/specs/FNNN-slug/tasks.md\`：可执行任务、依赖和完成证据。

Feature 文档 frontmatter 使用 \`document\`、\`feature\`、\`status\`、\`title\`、\`planned_start\`、\`planned_end\`、\`milestone\`、\`updated\`；日期没有事实依据时写“待确认”。同一 Feature 持续更新同一路径，不创建 final、v2、new 等平行最终稿。

## 开发规则

- 先收敛 PRD 与总规格，再冻结 Feature Map；只为本次明确实施的 Feature 创建或更新 spec/plan/tasks。
- 实施前读对应 spec、plan 和 tasks；变更必须能回到需求、验收和任务。
- \`- [x]\` 只在源码、测试、构建或运行证据真实存在后使用，并在任务下记录最窄证据；文档存在本身不等于完成。
- 新事实影响上游时，先更新受影响的 PRD/总规格/Feature，再继续开发；不要另建任务数据库或让页面状态反写 docs。
- 观测从项目开发阶段可用；评估只在 FDE 进入验证评估后使用。观测或评估结果都不能自动勾选任务、更新基线或推进阶段。

## 系统架构同步

- 新增、移除或替换主要服务、入口、存储、外部集成、模型或 Agent 边界、部署边界、关键数据路径，属于需要同步架构的结构性变更。普通重构、内部类或函数调整不更新项目架构。
- 当用户明确要求生成或更新系统架构，或本次实现包含结构性变更时，先调用 \`architecture_get\`，再重新读取受影响的已确认文档和真实源码，最后调用 \`architecture_set\` 提交完整候选。
- 保留仍代表同一概念的现有 ID，只调整受影响的分组、节点和关键关系；提交内容仍须包含完整架构，并遵循方案设计 Skill 中的取证、分组、节点类型和关系密度规则。
- \`architecture_set\` 产生的新版本仍是待审阅候选，需要 FDE 重新确认；不能自行确认、回退或推进项目阶段。

## 开发收口

开发完成时更新以下固定候选产物：

1. \`fde-deliverables/03-project-development/implementation-report.md\`
2. \`fde-deliverables/03-project-development/runbook.md\`
3. \`fde-deliverables/03-project-development/development-baseline.md\`

三份文件分别记录实现范围与剩余项、安装运行和故障恢复、候选版本与测试/评估证据及已知风险。它们仍是候选阶段产物；你不能声称 FDE 已确认，不得改变项目阶段。是否进入验证评估只能由 FDE 在项目进度页决定。`,
} as const

/** Runtime Skill loaded on demand while an FDE validates one release candidate. */
export const VALIDATION_SKILL = {
  name: 'fde-validation',
  description: '为当前候选版本建立验证合同，记录真实指标证据和问题，并形成验证计划、验证报告与验证基线。',
  whenToUse: '当前项目处于验证评估，用户要求设计验证、执行检查、登记结果、分析问题或收口验证时使用。',
  source: 'bundled',
  content: `# FDE 验证评估规范

只在当前项目的验证评估阶段使用本 Skill。先读取需求基线、项目 PRD、验收方案、方案基线、项目开发基线、当前候选版本和已有验证文件，再判断当前是“评估方案准备”还是“开始验证”。不得把开发期测试摘要冒充本轮验证结果。

## 两种工作模式

- 评估方案准备：生成或完善结构化合同和 \`validation-plan.md\`；所有未真实执行的指标保持 NOT_RUN，不生成验证报告或验证基线。
- 开始验证：只有当前合同已有 FDE 确认记录时才执行；按已确认的方法与阈值保存真实证据，随后更新合同结果、验证报告与验证基线。
- \`.fde/evaluations/validation-plan-approval.json\` 由平台写入。Agent 不得创建、修改或删除该文件，也不能代替 FDE 确认方案。

## 验证合同

在 \`.fde/evaluations/validation.json\` 维护唯一结构化合同，\`schemaVersion\` 固定为 2，包含候选版本、验证环境、可选数据集、指标和问题：

- 每个指标都写清名称、类别、方法、阈值和是否必需；类别只使用 business、functional、data、model、performance、security、recovery、agent。
- 每个指标必须包含非空 \`metrics[].sources\`。每项来源写项目相对 \`path\` 和文档内 \`references\` 编号，例如验收条件、需求 ID 或方案决策 ID；来源文件必须真实存在于当前项目。不要从 Agent 自己新写的验证计划反向证明指标来源。
- 指标结果只使用 PASS、WARN、FAIL、NOT_RUN。PASS/WARN 必须引用当前项目中的真实证据文件；WARN 还必须写明接受理由。
- \`result.evidence\` 必须是一个非空的项目相对路径字符串，不能是数组。需要引用多份底层记录时，先生成一份当前指标的主证据 Markdown，由它索引其他记录，再把主证据路径写入 \`evidence\`。
- 结果字段只使用以下 camelCase 名称，不能使用 \`accept_reason\`、\`waiver_reason\` 或自创字段：
  - NOT_RUN：\`{ "status": "NOT_RUN", "note": "尚未执行的真实原因" }\`
  - PASS/FAIL：\`{ "status": "PASS", "value": "实际结果", "evidence": ".fde/evaluations/reports/<run-id>/<metric>.md", "note": "结果说明" }\`
  - WARN：\`{ "status": "WARN", "value": "实际结果", "evidence": ".fde/evaluations/reports/<run-id>/<metric>.md", "waiverReason": "接受者、理由和适用范围" }\`
- 修改候选版本、验证环境、数据/用例、指标来源、方法或阈值时，先把受影响指标重置为 NOT_RUN；平台会让旧的 FDE 确认失效。停止执行并请 FDE 重新确认后才能继续。
- 数据集只在项目确实需要时登记版本、来源或哈希，不为凑格式虚构数据集。
- critical/high 问题在 open 状态时阻止进入部署试运行。Agent 只记录或更新 open/resolved 问题，不得代替 FDE 写入 waived、waiverReason 或 waivedAt；人工接受必须由 FDE 在项目进度页填写理由并确认。
- 不得编造指标值、阈值、执行时间、数据集版本或验证证据。信息不足时保留 NOT_RUN，并明确下一步需要执行什么。

## 固定产物

1. \`fde-deliverables/04-validation/validation-plan.md\`：候选版本、范围、指标来源、环境、数据/用例、指标阈值、执行顺序、证据位置和职责。
2. \`fde-deliverables/04-validation/validation-report.md\`：逐项结果、实际值、证据、问题、偏差、风险和是否建议进入部署试运行。
3. \`fde-deliverables/04-validation/validation-baseline.md\`：通过验证的候选版本、环境与数据版本、已确认指标结果、接受风险和可追溯证据。

## 工作规则

- 验证输入来自已确认的验收方案、研发基线、候选版本、验证环境、数据/用例和客户最新约束；不要复制一套独立需求。
- 同一轮持续更新固定路径，不创建 final、v2、new 等平行最终稿。
- 评估页面按“生成评估方案 → FDE 确认方案 → 开始验证”推进；固定 YAML 用例只是可选验证方法，不等于完整验证流程。
- 文件与指标就绪只表示可以提交，不等于 FDE 已确认；不得绕过或伪造确认记录。
- 你不能修改项目阶段。是否进入部署试运行只能由 FDE 在项目进度页核对全部阻塞项后决定。`,
} as const

/** Runtime Skill loaded on demand while an FDE deploys and observes one candidate. */
export const DEPLOYMENT_TRIAL_SKILL = {
  name: 'fde-deployment-trial',
  description: '把已验证候选版本部署到明确目标环境，记录授权、运行与回滚证据、试运行问题和四份固定部署产物。',
  whenToUse: '当前项目处于部署试运行，用户要求部署、试运行、记录反馈、关闭问题或收口部署阶段时使用。',
  source: 'bundled',
  content: `# FDE 部署试运行规范

只在当前项目的部署试运行阶段使用本 Skill。先读取已确认的验证基线、候选版本、目标环境说明、项目 AGENTS.md 和已有部署文件。任何真实部署、停止、回滚或外部写入都必须得到 FDE 对当前目标和动作的明确授权；不得读取、复制或写入明文凭据。

## 结构化状态

在 \`.fde/deployment-trial.json\` 维护唯一状态，\`schemaVersion\` 固定为 1：

- \`candidateVersion\`：与验证基线一致的候选版本。
- \`environment\`：\`name\`、\`summary\`、\`authorized\`；Agent 保持 false，只有 FDE 在项目进度确认当前目标环境与试运行结论后，Host 才写 true。
- \`status\`：Agent 只维护 preparing、deploying、running 或 blocked；ready 由同一个 FDE 项目进度确认动作写入。
- \`evidence\`：validationBaseline、deployment、health、rollback、trial，均为当前项目相对文件路径。
- \`issues\`：id、title、severity、status、evidence，以及按状态需要的 resolution、decisionReason、owner。Agent 只能写 open、resolved 或 deferred；不得代替 FDE 把问题标为 accepted。

## 固定产物

1. \`fde-deliverables/05-deployment-trial/deployment-runbook.md\`
2. \`fde-deliverables/05-deployment-trial/deployment-baseline.md\`
3. \`fde-deliverables/05-deployment-trial/trial-operation-report.md\`
4. \`fde-deliverables/05-deployment-trial/issue-closure-list.md\`

文档必须绑定候选版本、目标环境和真实证据。一次启动、端口可访问或 HTTP 200 只能作为单项证据，不能冒充试运行完成。所有产物仍是候选；是否进入验收移交只能由 FDE 在项目进度页决定。`,
} as const

/** Runtime Skill loaded on demand while an FDE completes acceptance and handover. */
export const ACCEPTANCE_HANDOVER_SKILL = {
  name: 'fde-acceptance-handover',
  description: '统一最终交付物、企业验收结论、条件项、培训与权限/运维责任移交，并形成四份固定移交产物。',
  whenToUse: '当前项目处于验收移交，用户要求整理交付清单、记录验收、处理条件项、准备运维培训或收口项目时使用。',
  source: 'bundled',
  content: `# FDE 验收移交规范

只在当前项目的验收移交阶段使用本 Skill。先读取 \`.fde/deployment-trial.json\`、全部前阶段基线、最终版本、企业反馈和已有移交文件。部署试运行的授权与状态以该 JSON 为唯一事实源；若固定 Markdown 与它冲突，先按 JSON 的当前事实刷新相关文档，不得用旧文档覆盖结构化状态。不得虚构客户签字、电子签章、培训完成或制品可取得状态。

## 结构化状态

在 \`.fde/acceptance-handover.json\` 维护唯一状态，\`schemaVersion\` 固定为 1：

- \`finalVersion\` 和项目相对路径 \`deploymentTrialBaseline\`。
- \`acceptance\`：status 只使用 pending、accepted、conditionally-accepted、returned、terminated，并记录 summary 与最多 40 项项目相对 evidence 数组。
- \`deliverables\`：id、name、location、version、checksum、available。外部制品只引用受控位置，平台不会替你上传或探测。
- \`conditions\`：id、title、status；人工接受项写清 reason、owner、followUp。
- \`handover\`：trainingCompleted、accessResponsibilityTransferred、operationsResponsibilityTransferred，以及项目相对 evidence 数组。

首次生成结构化状态时，Agent 必须把企业验收保持为 pending、交付物 available 保持 false、条件项保持 open、三个移交完成字段保持 false。已有状态存在时，Agent 必须保留项目进度页已经写入的这些人工决定字段，不得重置或代替 FDE 修改。FDE 只能在项目进度页通过带当前合同摘要的“记录验收与移交事实”动作，关联项目内证据后更新这些字段；该动作不会代替签字、上传制品、完成培训、变更权限或移交运维责任。

## 固定产物

1. \`fde-deliverables/06-acceptance-handover/delivery-inventory.md\`
2. \`fde-deliverables/06-acceptance-handover/acceptance-report.md\`
3. \`fde-deliverables/06-acceptance-handover/operations-and-maintenance-guide.md\`
4. \`fde-deliverables/06-acceptance-handover/handover-record.md\`

验收退回或终止时如实保留状态，不能完成项目。文件齐备或人工事实记录齐备都只表示可以提交；“记录验收与移交事实”和“完成项目”是两个独立动作，是否完成项目只能由 FDE 在项目进度页二次确认。`,
} as const

/** Short stage-aware prompt; the complete Skill body remains on-demand. */
export function requirementResearchPrompt(stage: FdeProjectState): string {
  if (stage !== 'requirements') return ''
  return '当前 FDE 项目处于“需求调研”。当用户要求梳理、收敛或更新需求材料时，先加载 Skill `fde-requirement-research`，并把产物更新到 `fde-deliverables/01-requirement-research/` 的三个固定文件。产物均为候选；你不能确认客户结论，也不能推进项目阶段。'
}

/** Short solution-aware prompt; the complete Skill body remains on-demand. */
export function solutionDesignPrompt(stage: FdeProjectState): string {
  if (stage !== 'solution') return ''
  return '当前 FDE 项目处于“方案设计”。当用户要求设计、收敛或更新项目方案时，先加载 Skill `fde-solution-design`，更新 `fde-deliverables/02-solution-design/` 的五个固定文件（包含项目 PRD），并先取证、后建模，通过 architecture_get/architecture_set 维护有序、可追溯的项目级候选架构。所有产物均为候选；你不能确认架构、客户结论或推进项目阶段。'
}

/** Short development-aware prompt; the complete Skill body remains on-demand. */
export function projectDevelopmentPrompt(stage: FdeProjectState): string {
  if (stage !== 'development') return ''
  return '当前 FDE 项目处于“项目开发”。当用户要求规划、拆分、实施、检查研发进度，或要求生成或更新系统架构时，先加载 Skill `fde-project-development`，按项目 `docs/` 的 PRD、产品总规格、Feature Map 和逐 Feature spec/plan/tasks 原位维护，并用真实工程证据更新任务。出现主要服务、入口、存储、外部集成或关键数据路径等结构性变更时，同步更新系统架构候选。开发收口产物固定在 `fde-deliverables/03-project-development/`。你不能虚构日期或证据，也不能推进项目阶段。'
}

/** Short validation-aware prompt; the complete Skill body remains on-demand. */
export function validationPrompt(stage: FdeProjectState): string {
  if (stage !== 'validation') return ''
  return '当前 FDE 项目处于“验证评估”。当用户要求准备方案或执行验证时，先加载 Skill `fde-validation`，严格区分“评估方案准备”和“开始验证”。指标必须追溯到此前已确认文档；只有 FDE 确认当前方案后才能执行。只记录真实结果和项目内证据；你不能确认方案或推进项目阶段。'
}

/** Short deployment-trial-aware prompt; the complete Skill body remains on-demand. */
export function deploymentTrialPrompt(stage: FdeProjectState): string {
  if (stage !== 'pilot') return ''
  return '当前 FDE 项目处于“部署试运行”。当用户要求部署、试运行、记录反馈或收口时，先加载 Skill `fde-deployment-trial`。真实外部动作必须得到 FDE 明确授权；状态记录在 `.fde/deployment-trial.json`，四份固定产物位于 `fde-deliverables/05-deployment-trial/`。你不能接受严重问题或推进项目阶段。'
}

/** Short acceptance-handover-aware prompt; the complete Skill body remains on-demand. */
export function acceptanceHandoverPrompt(stage: FdeProjectState): string {
  if (stage !== 'handoff') return ''
  return '当前 FDE 项目处于“验收移交”。当用户要求整理交付清单、记录企业验收、处理条件项或准备移交时，先加载 Skill `fde-acceptance-handover`。先以 `.fde/deployment-trial.json` 为已确认部署试运行事实源；验收状态记录在 `.fde/acceptance-handover.json`，其中 acceptance.evidence 是项目相对路径数组，四份固定产物位于 `fde-deliverables/06-acceptance-handover/`。企业验收、交付物可取得、条件决定和责任移交只能由 FDE 在项目进度页记录；你不得重置这些人工字段，也不能完成项目。'
}

/**
 * Open the project-stage domain and register the read/initialize route.
 * @param ctx - Host context carrying storage, Workspace registry, and WebServer.
 */
export async function apply(ctx: Context): Promise<void> {
  const domain = await ctx.storageDomain.open(fdeStageDomainSpec)
  const state = new FdeStageState(domain.table('projects'))
  ctx.effect(() => async () => { await domain.close() }, 'fde-stage: domain')
  ctx.skills.register(REQUIREMENT_RESEARCH_SKILL)
  ctx.skills.register(SOLUTION_DESIGN_SKILL)
  ctx.skills.register(PROJECT_DEVELOPMENT_SKILL)
  ctx.skills.register(VALIDATION_SKILL)
  ctx.skills.register(DEPLOYMENT_TRIAL_SKILL)
  ctx.skills.register(ACCEPTANCE_HANDOVER_SKILL)
  ctx.systemPrompt.section({
    name: 'fde:requirement-research',
    order: 90,
    text: (context) => {
      const cwd = context.agent?.session.header.cwd
      if (cwd === undefined) return ''
      const workspace = ctx.workspaceRegistry.list().find(item => item.path === cwd)
      if (workspace === undefined) return ''
      const stage = state.current(workspace.id)?.currentStage ?? 'requirements'
      return requirementResearchPrompt(stage)
        || solutionDesignPrompt(stage)
        || projectDevelopmentPrompt(stage)
        || validationPrompt(stage)
        || deploymentTrialPrompt(stage)
        || acceptanceHandoverPrompt(stage)
    },
  })
  const handler = createStageRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    open: workspaceId => state.open(workspaceId),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_OPEN_PATH,
    handler,
  }), `fde-stage: ${FDE_STAGE_OPEN_PATH}`)
  const completeRequirements = createCompleteRequirementsRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    requirements: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      return await loadRequirementArtifacts(workspace.path)
    },
    complete: async (workspaceId, expectedRevision) => await state.completeRequirements(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_REQUIREMENTS_PATH,
    handler: completeRequirements,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_REQUIREMENTS_PATH}`)
  const completeSolution = createCompleteSolutionRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    solution: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const [artifacts, architecture] = await Promise.all([
        loadSolutionArtifacts(workspace.path),
        readProjectArchitecture(workspace.path),
      ])
      return { artifacts: artifacts.artifacts, architecture }
    },
    complete: async (workspaceId, expectedRevision) => await state.completeSolution(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_SOLUTION_PATH,
    handler: completeSolution,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_SOLUTION_PATH}`)
  const completeDevelopment = createCompleteDevelopmentRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    development: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const snapshot = await loadDevelopmentDocs(workspace.path)
      return { artifacts: snapshot.closure.artifacts }
    },
    complete: async (workspaceId, expectedRevision) => await state.completeDevelopment(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_DEVELOPMENT_PATH,
    handler: completeDevelopment,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_DEVELOPMENT_PATH}`)
  const completeValidation = createCompleteValidationRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    validation: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const snapshot = await loadValidationStage(workspace.path)
      return { gateReady: snapshot.gateReady, blockers: snapshot.blockers }
    },
    complete: async (workspaceId, expectedRevision) => await state.completeValidation(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_VALIDATION_PATH,
    handler: completeValidation,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_VALIDATION_PATH}`)
  const completePilot = createCompletePilotRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    deploymentTrial: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const snapshot = await loadDeploymentTrialStage(workspace.path)
      return { gateReady: snapshot.gateReady, blockers: snapshot.blockers }
    },
    complete: async (workspaceId, expectedRevision) => await state.completePilot(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_PILOT_PATH,
    handler: completePilot,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_PILOT_PATH}`)
  const completeHandoff = createCompleteHandoffRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    acceptanceHandover: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const snapshot = await loadAcceptanceHandoverStage(workspace.path)
      return { gateReady: snapshot.gateReady, blockers: snapshot.blockers }
    },
    complete: async (workspaceId, expectedRevision) => await state.completeHandoff(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_HANDOFF_PATH,
    handler: completeHandoff,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_HANDOFF_PATH}`)
  const returnStage = createReturnStageRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    returnToPrevious: async (workspaceId, expectedRevision, reason) => await state.returnToPrevious(workspaceId, expectedRevision, reason),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_RETURN_PATH,
    handler: returnStage,
  }), `fde-stage: ${FDE_STAGE_RETURN_PATH}`)
}

/** Model-facing content is limited to one short stage section and an on-demand Skill. */
export const modelExperience = 'stage prompt and skill'

---
document: fde-skill-routing
status: confirmed
updated: "2026-09-01"
primary_method_source: davidahmann/fde-guide@060ef0f3b67743b2e1fc3705763d423eae980236
engineering_source: rpraharaj/forward-deployed-engineer@ee045a66db5242617ccea9e5e33139a2980ab55e
---

# FF - FDE 交付工作台 V2 Skill 与 Artifact 路由

## 1. 文档职责

本文确定八阶段在 DeepSeek Harness 中如何组合业务方法 Skill、工程执行 Skill、平台工具和 Artifact。它是产品与研发的路由合同，不是向用户展示的 Skill 菜单，也不代表外部源码已经安装。

两个外部来源承担不同责任：

- [`davidahmann/fde-guide`](https://github.com/davidahmann/fde-guide) 提供 11 个 AI-FDE 方法 Skills、Artifact 模板、JSON Schema、Control 和完整决策案例，负责“为什么做、要形成什么证据、下一项决定是什么”。当前评审快照为 `v1.29.0 / 060ef0f3`，Apache-2.0。
- [`rpraharaj/forward-deployed-engineer`](https://github.com/rpraharaj/forward-deployed-engineer) 提供 43 个现场工程 Skills，负责“如何调查代码与数据、设计、实现、验证、发布、运维和交接”。当前评审快照为 `ee045a66db5242617ccea9e5e33139a2980ab55e`，MIT。

本产品的 PRD、Product Spec、项目隔离、用户授权和 FDE 人工决定始终高于外部方法。外部内容是可适配参考，不是客户政策、生产授权或事实证据。

## 2. 四层产品架构

| 层级 | 责任 | DeepSeek Harness 载体 | 用户默认看到 |
|---|---|---|---|
| 八阶段产品流程 | 明确当前业务问题、输入、产物、缺口和 FDE 决定 | `fde/project`、`fde/stage`、`ui-fde-project`、`ui-fde-stage` | 当前阶段和推荐工作 |
| AI-FDE 方法层 | 确定业务工作、Artifact、证据要求和决策门 | `skill`、`skill-filesystem`、`tool-skill` | 业务化工作名称、原因和预计结果 |
| 工程执行层 | 完成代码、数据、测试、发布和运维动作 | 同一 Skill 基础设施，按任务加载 | 业务进度；Skill 名称在详情中可见 |
| 工具执行层 | 真实读写、运行、调用系统、观察和验证 | DeepSeek Harness 原生 Tool、Session、Workflow Run | 动作和结果；命令、日志按需展开 |

路由顺序固定为：

```text
用户目标
→ 当前项目与阶段
→ 已有 Artifact、缺口、权限和工具
→ 方法 Skill
→ 必要的工程 Skill
→ 获准的 Harness 工具
→ 真实观察与验证
→ Artifact 新版本
→ FDE 人工决定
```

方法 Skill 不必每次组合工程 Skill；只需要访谈整理、价值判断或人工决策时可以直接形成 Artifact。工程 Skill 也不能越过方法层已确认的范围自行扩大交付目标。

## 3. 接入与运行规则

1. 不修改 DeepSeek Harness Agent Loop；通过现有 Skill registry、filesystem provider、catalog loader、skill tool、Session 和 UI slot 接入。
2. 用户只需描述现场问题或选择推荐工作，不需要知道仓库阶段、Skill 名称、Schema 名称或命令。
3. 每次请求只加载当前方法 Skill、必要工程 Skill 及其直接参考，不加载两个仓库的全部正文。
4. 路由必须记录业务工作名称、选用原因、前置输入、加载范围、预计 Artifact、所需工具和不能证明的事项。
5. Skill 只提供工作规范，不授予凭据、工具权限、客户批准、生产授权或证据；真实工具仍受当前用户、项目、会话和系统权限约束。
6. 外部 Skill、Schema、模板和脚本接入前逐项审查许可证、来源版本、内容、链接、工具假设、Artifact 路径、禁止行为和中文产品语言。
7. 外部内容必须固定到已审查 commit；上游升级作为独立变更评审，不能跟随网络最新版本自动变化。
8. Skill 可以给出方法内 disposition 或 Go／Revise／Narrow／Stop 建议，但只有 FDE 能改变项目阶段。
9. 示例、测试和 Schema 通过只证明声明范围内的结构或本地行为，不是客户价值、生产就绪或移交证据。

## 4. Artifact Catalog 合同

### 4.1 最小索引字段

每个被阶段、Skill 或责任视图消费的 Artifact，至少记录：

| 字段 | 含义 |
|---|---|
| `artifactId` | 当前项目内稳定身份 |
| `artifactType` | Workflow Charter、Evaluation Report 等类型 |
| `projectId` / `stageId` | 所属项目与形成阶段 |
| `version` | 不可变版本；更新生成新版本 |
| `sourceAdapter` | 平台原生或外部来源及 commit |
| `contentRef` | 实际文件或结构化记录的位置 |
| `structureState` | `missing`、`invalid`、`starter_valid`、`complete_valid` 或 `not_applicable` |
| `evidenceState` | `confirmed`、`inferred` 或 `unverified` |
| `evidenceRefs` | 文件、观察、命令、工具结果、人工决定或外部系统证据 |
| `inputRefs` | 本次结果使用的前序 Artifact 固定版本 |
| `decisionRefs` | 相关人工决定、责任人、时间和适用范围 |
| `supersedes` | 被当前版本替代但仍保留的历史版本 |

### 4.2 结构状态与证据状态分离

- `starter_valid` 表示当前决策所需的最小结构存在，不表示 Artifact 完整。
- `complete_valid` 表示通过该类型完整结构与语义校验，不表示字段内容真实、客户接受或生产就绪。
- `confirmed` 只能来自有权责任人或可验证权威系统；Agent 不能把自己的输出标为已确认。
- starter 与 complete 必须是同一 Artifact 的渐进版本，不创建并行的简版和完整版对象。
- 当前 `fde-guide` 官方渐进校验只覆盖 Workflow Charter、Engagement Reframe、Data Context Manifest。其他 JSON Schema、Markdown 模板和 Control 按其真实能力呈现，不统一伪装为 starter 校验。

### 4.3 采用边界

首轮不复制 `fde-guide` 的 131 项 catalog，也不要求每个项目填写所有模板。每个阶段只建立支持下一项重要决定所必需的 Artifact。适配时优先复用上游 Schema 与模板语义，通过本项目 Adapter 绑定项目身份、阶段、版本和证据；不得复制成脱离上游来源的第二套相似合同。

## 5. 方法 Skill 目录

| 方法 Skill | 主要业务职责 | 常见核心 Artifact | 主要适用阶段 |
|---|---|---|---|
| `reframe-ai-engagement` | 现场事实推翻原简报时保留历史、界定冲突并取得有权处置 | Field Observation Log、Engagement Reframe | 1；所有阶段条件触发 |
| `qualify-ai-workflow` | 判断一个真实工作流是否值得进入 AI 项目 | Discovery Summary、Workflow Charter、Data Readiness Assessment | 1～2 |
| `engineer-ai-value` | 建立业务结果、基线、完整成本、停止条件和 Pilot 价值门 | Value Case、Value Scorecard、Workflow Charter | 2；7～8复评 |
| `select-ai-mechanism` | 比较规则、软件、优化、ML、检索、模型、Agent 和人工 | Intelligence Selection Record、ADR | 4 |
| `design-production-ai-system` | 把已确认工作流设计成最小完整生产系统 | Ontology、System Design、Behavior Bundle、Threat Model | 4 |
| `secure-ai-action-boundary` | 设计工具、身份、权限、审批、效果和独立读回 | Tool Contract、Capability Manifest、Threat Model | 3～6；高风险变化时重跑 |
| `build-ai-evaluation` | 构造真实、异常、对抗案例和可复现评估 | Evaluation Case、Evaluation Output、Evaluation Report | 5 |
| `review-ai-production-readiness` | 对准确候选版本作发布与生产就绪评审 | Production Service Readiness、Solution Release | 5～7 |
| `operate-ai-service` | 管理业务结果、采用、SLO、事故、成本、变更和退役 | Production Service Review、SLO、Incident/Change Records | 7～8 |
| `transfer-ai-service` | 用实际演练证明客户团队能运行、变更、恢复和退役 | Delivery and Adoption Plan、Customer Handoff | 6～7 |
| `productize-field-learning` | 把重复现场证据转成有边界的产品或平台能力 | Field Learning Register、Change Impact Assessment | 8 |

这些 Skills 的 disposition 属于各自方法：例如 `discover/defer/do_not_build`、`accept/inconclusive/reject`、`hold/reject/shadow/canary`、`continue/constrain/improve/retire`。平台必须把它们保存为候选方法结论，再由 FDE 记录项目级决定。

## 6. 工程 Skill 目录

| 工程能力组 | Skills | 被方法层调用的典型场景 |
|---|---|---|
| LAND | `fde-orient`、`access-and-onboarding`、`context-strategy`、`env-bootstrap`、`repo-recon`、`ownership-map`、`knowledge-interview` | 建立项目、现场认知、访问与环境 |
| FRAME | `requirements-to-spec`、`feasibility-probe`、`estimation`、`delivery-plan` | 把范围变成可验证实施边界 |
| UNDERSTAND | `trace-the-flow`、`blast-radius`、`git-archaeology`、`data-archaeology` | 还原真实系统、数据与影响范围 |
| DESIGN | `solution-design`、`contract-design`、`nfr-baseline` | 方案、接口、Schema 与非功能目标 |
| BUILD | `safe-change`、`characterization-tests`、`refactor-seams`、`integration-adapter`、`dependency-upgrade`、`db-change-management`、`data-pipeline-work`、`cots-configuration` | 在陌生或既有系统中安全实施 |
| VERIFY | `verification-plan`、`test-data-strategy`、`nfr-validation`、`security-compliance-check`、`ci-forensics` | 把验收条件变成真实测试和证据 |
| SHIP | `release-readiness`、`deploy-runbook`、`cutover-plan`、`change-control-navigation`、`post-deploy-watch`、`decommission-plan` | 发布、切换、观察与退役 |
| SUSTAIN | `incident-triage`、`observability-gap`、`handover-pack`、`enablement-handoff` | 事故、可观测性、交接与运营能力 |
| 跨阶段 | `stakeholder-brief`、`escalation-and-renegotiation` | 管理者决策、依赖升级和范围重谈 |

工程 Skill 不是固定阶段门。只有方法层确认当前业务工作需要、项目条件满足且工具获准时才加载。

## 7. 八阶段路由

### 阶段 1 · 发现高价值问题

- 用户要回答：现场真正发生了什么，哪个问题值得继续？
- 方法 Skill：核心 `qualify-ai-workflow`；当 sold、stated、observed、system-enforced、policy-authorized 事实冲突并影响边界时触发 `reframe-ai-engagement`。
- 工程 Skill：`fde-orient`、`knowledge-interview`、`ownership-map`；问题明确落到既有代码时条件加载 `repo-recon`；评审时可加载 `stakeholder-brief`。
- 最小输入：继承简报、客户资料、一名真实流程知情者、一个近期代表案例和已知限制。
- 核心 Artifact：Field Observation Log、Workflow Charter `starter`；存在重大冲突时增加 Engagement Reframe `starter`。
- 阶段证据：来源原文、代表案例、正常与异常路径、角色与权限依据、未测基线和安全回退。
- 人工决定：Go 到结果定义，Revise 继续调查，Narrow 收窄流程，或 Stop／do-not-build。

### 阶段 2 · 定义结果、范围与责任

- 用户要回答：做到哪里算成功，谁验证、谁负责、何时停止？
- 方法 Skill：核心 `engineer-ai-value`；边界仍不完整时回到 `qualify-ai-workflow`；现场事实再度冲突时触发 `reframe-ai-engagement`。
- 工程 Skill：`requirements-to-spec`、`feasibility-probe`、`estimation`、`delivery-plan`；存在范围、日期或依赖冲突时触发 `escalation-and-renegotiation`。
- 最小输入：阶段 1 Artifact、当前基线或明确未测状态、合格工作范围、独立验证者、价值与风险责任人。
- 核心 Artifact：Workflow Charter `complete`、Value Case、AI Value Engineering Scorecard、可验证需求、估算与风险排序计划。
- 阶段证据：指标所有者、测量窗口、归因方法、完整成本、最大可接受效果、Pilot 时限与停止条件。
- 人工决定：Pilot、Defer 或 Do Not Build 方法结论之上的 Go／Revise／Narrow／Stop。

### 阶段 3 · 调查数据、系统、接口、安全与组织

- 用户要回答：真实环境允许什么，哪些事实、权限和治理条件仍然缺失？
- 方法 Skill：对真实读写和外部动作使用 `secure-ai-action-boundary`；数据就绪按 Workflow Charter → Data Readiness Assessment → Data Context Manifest 路径推进。
- 工程 Skill：`access-and-onboarding`、`context-strategy`、`env-bootstrap`、`repo-recon`、`ownership-map`、`trace-the-flow`、`blast-radius`、`data-archaeology`；历史原因不明时用 `git-archaeology`，敏感场景使用 `security-compliance-check`。
- 最小输入：确认的工作流与结果边界、客户资料、系统和数据访问、接口、政策、审批人与目标环境。
- 核心 Artifact：Data Readiness Assessment、Data Context Manifest `starter → complete`、System Map、访问与所有权矩阵、候选 Tool Contract、治理审查记录。
- 阶段证据：数据四平面、来源权威、质量与失败行为、调用链、身份、租户、权限、政策修订和人工升级路径。
- 人工决定：环境足以设计，或 Revise／Narrow／Stop；安全、隐私、法务批准仍分别记录。

运行时工作方法目录拆为 7 项：账号与审批、数据可用性、真实业务链路、数据口径、系统动作边界为必做；系统历史原因和安全／隐私／法务专项核对按事实缺口加载。不得再用一个 `fde-investigate-environment` 覆盖整个阶段。

### 阶段 4 · 设计方案并完成端到端纵向切片

- 用户要回答：最小而完整的真实业务链应该采用什么机制并怎样安全运行？
- 方法 Skill：核心 `select-ai-mechanism`、`design-production-ai-system`；存在模型可见读取或真实效果时组合 `secure-ai-action-boundary`。
- 工程 Skill：`solution-design`、`contract-design`、`nfr-baseline`、`verification-plan`、`characterization-tests`、`safe-change`、`integration-adapter`、`test-data-strategy`；重构、依赖、数据库、数据管线或商业软件由明确条件触发对应 Skill。
- 最小输入：阶段 2 价值和范围合同、阶段 3 数据与系统事实、治理约束和真实工程环境。
- 核心 Artifact：Intelligence Selection Record、ADR、Operational Ontology、系统设计、接口／Tool Contract、Threat Model、NFR、验证计划和纵向切片。
- 条件 Artifact：只有选择模型或 Agent 时才建立 Agent System、Behavior Bundle、Capability Manifest；确定性或传统 ML 系统不创建占位 Agent Artifact。
- 人工决定：纵向切片是否能进入最高风险假设验证，或返回机制、数据、范围和实施。

运行时工作方法目录拆为 7 项：实现方式选择、生产级方案、方案决策、接口合同、非功能指标为必做；陌生系统安全改动和外部系统适配按实际实现条件加载。不得再用一个 `fde-design-vertical-slice` 覆盖整个阶段。

### 阶段 5 · 运行 PoC 与 Eval

- 用户要回答：最高风险假设是否被代表性案例、用户和独立证据支持？
- 方法 Skill：核心 `build-ai-evaluation`；形成明确候选版本后可条件运行 `review-ai-production-readiness` 发现进入 Pilot 前缺口。
- 工程 Skill：`verification-plan`、`test-data-strategy`、`nfr-validation`、`security-compliance-check`、`ci-forensics`；遗留行为无基线时使用 `characterization-tests`。
- 最小输入：固定候选版本、Workflow Charter、Data Context Manifest、机制选择、Threat Model、NFR、真实或经治理测试数据。
- 核心 Artifact：Evaluation Case、执行清单、Evaluation Output、Evaluation Report 或等价目标软件验证记录、UAT 记录、限制与失败分类。
- 阶段证据：正常、异常、拒绝、恢复、漂移和对抗案例；组件版本、环境、成本、延迟、污染控制、独立验证与失败证据。
- 人工决定：Accept／Inconclusive／Reject 方法结论之上的 Go／Revise／Narrow／Stop。

运行时工作方法目录拆为 7 项：评估体系、验证计划、测试数据、非功能验证为必做；遗留行为固化、安全合规专项检查和 CI 失败分析按项目条件加载。不得再用一个 `fde-run-poc-eval` 覆盖整个阶段。

### 阶段 6 · 企业集成、可靠性改造与受控 Pilot

- 用户要回答：准确候选版本能否在有限用户、数据、周期和动作权限内由企业负责运行？
- 方法 Skill：核心 `review-ai-production-readiness`；真实动作继续使用 `secure-ai-action-boundary`；从 Pilot 开始运行 `transfer-ai-service` 的所有权与能力准备。
- 工程 Skill：`safe-change`、`integration-adapter`、`release-readiness`、`deploy-runbook`、`post-deploy-watch`、`nfr-validation`、`security-compliance-check`、`change-control-navigation`；按实际变更条件加载 BUILD 与 SHIP 其他 Skills。
- 最小输入：阶段 5 证据、准确 release、企业系统、目标类环境、Pilot 人群、授权、支持与回滚责任。
- 核心 Artifact：Production Service Readiness、Delivery and Adoption Plan、Solution Release 或等价发布记录、Pilot 日志、Trace/Event Receipt、回滚与接管演练记录。
- 阶段证据：实际发布范围、观察流量、权限、独立读回、监控、人工接管、停止触发、业务采用与支持容量。
- 人工决定：Hold／Reject／Shadow／Canary／Bounded Segment 方法结论之上的扩大、修订、收窄或停止。

运行时工作方法目录拆为 7 项：生产就绪预审、试点范围与授权、企业接入、可靠性与恢复、试点执行证据为必做；变更审批和部署回滚手册按客户环境要求加载。不得再用一个 `fde-integration-pilot` 覆盖整个阶段。

### 阶段 7 · 进入生产、推动采用并验收交接

- 用户要回答：系统是否持续产生被接受的业务结果，客户团队是否能独立负责？
- 方法 Skill：`review-ai-production-readiness` 审查范围扩展，`operate-ai-service` 运行服务评审，`transfer-ai-service` 证明运营、变更、恢复和退役能力。
- 工程 Skill：`release-readiness`、`deploy-runbook`、`change-control-navigation`、`post-deploy-watch`、`handover-pack`、`enablement-handoff`、`incident-triage`、`observability-gap`；切换和旧系统退役时加载 `cutover-plan`、`decommission-plan`。
- 最小输入：Pilot 证据、生产授权、准确制品、客户验收条件、业务指标、采用漏斗、培训和运维责任。
- 核心 Artifact：Production Service Review、Customer Handoff、更新后的 Delivery and Adoption Plan、验收记录、交付清单、SLO、运维与支持证据。
- 阶段证据：合格工作 → 曝光 → 完成 → 独立接受 → 业务效果 → 持续净价值，以及客户主导的运行、变更、回滚、事故和退役演练。
- 人工决定：Continue／Constrain／Improve／Expand／Retire 方法结论，以及验收、责任移交和 FDE 退出决定。

运行时工作方法目录拆为 8 项：发布准备、客户接管、上线观察、服务运营、交付包和接收团队实操为必做；新旧系统切换和旧系统下线按实际范围加载。不得再用一个 `fde-production-handover` 覆盖整个阶段。

### 阶段 8 · 持续改进并沉淀可复用能力

- 用户要回答：生产证据应该推动什么改进，哪些经验可以安全复用，哪些必须保留客户特有？
- 方法 Skill：核心 `operate-ai-service`、`productize-field-learning`；结果与经济性变化时重跑 `engineer-ai-value`；现场边界变化时触发 `reframe-ai-engagement`。
- 工程 Skill：`incident-triage`、`observability-gap`、`post-deploy-watch`、`stakeholder-brief`、`escalation-and-renegotiation`；改进实施时按影响返回 `safe-change`、`verification-plan`、`release-readiness`、`deploy-runbook` 等纪律。
- 最小输入：生产指标、采用、事故、人工修正、成本、客户反馈、变更历史和前序 Artifact。
- 核心 Artifact：Production Service Review、Field Learning Register、Change Impact Assessment、回归案例、改进候选、受控发布和复用边界。
- 阶段证据：独立场景复现、客户与共享边界、再测试、审批、Canary、回滚、维护成本和预期交付收益。
- 人工决定：Investigate／Configure／Fix／Productize／Standardize／Defer／Reject／Retire，并返回受影响阶段重新承担证据责任。

运行时工作方法目录拆为 7 项：生产证据复盘、改进排序、改进验证和现场经验沉淀为必做；事故分析、观测缺口和改进版本受控发布按触发条件加载。不得再用一个 `fde-continuous-improvement` 覆盖整个阶段。

### 运行时工作方法目录合同

- 左侧“本阶段工作方法”只显示后端已经注册、当前会话确实可以加载的 Skill，不展示计划中的能力或前端假数据。
- 名称使用真实业务动作，技术 Skill 名称与固定来源只在详情的“技术信息”中显示。
- 每个阶段必须区分“必做工作”和“按需处理”；系统提示根据当前任务选择最少必要 Skill，不得因为目录中存在就一次加载全部。
- 每个 Skill 继续维护该阶段统一的固定产物、状态文件和工作项；拆分方法不能拆出互相冲突的平行最终稿。

## 8. 第一轮接入顺序

1. F001～F004：先完成项目身份、阶段工作台、受控执行、分层路由和 Artifact Catalog。
2. F005：只接入 `qualify-ai-workflow` 和条件触发的 `reframe-ai-engagement`；工程层只接入 `fde-orient`、`knowledge-interview`、`ownership-map`，必要时 `repo-recon`。
3. F005 只适配 Field Observation Log、Workflow Charter、Engagement Reframe；先验证 starter、证据状态、后续引用和人工决定闭环。
4. 首个阶段真实测试通过后，再按 F006～F012 顺序逐阶段审查和接入，不预装其余 Skills 或 Artifact。
5. 每个 Feature 的最低完成证据包括：业务语言路由、选用理由、按需加载记录、可见执行过程、真实工具证据、持久化 Artifact、结构与证据状态、后续引用和 FDE 决定。

## 9. 阶段 1 运行时合同

- 运行时分别注册 `qualify-ai-workflow`、`reframe-ai-engagement`、`fde-orient`、`knowledge-interview`、`ownership-map`、`repo-recon` 和 `stakeholder-brief`；不得再注册一个覆盖所有第一阶段工作的 `fde-requirement-research`。
- 系统提示只说明路由顺序和触发条件。普通发现默认加载 `qualify-ai-workflow`；只有边界冲突才追加 `reframe-ai-engagement`；工程 Skill 按任务缺口选择，不得一次加载全部。
- `.fde/discovery/workflows.json` schemaVersion 2 保存逐条证据引用，计数由 Host 聚合。
- `.fde/discovery/artifacts.json` schemaVersion 1 保存 Artifact 来源版本、内容版本、结构成熟度、证据状态和上下游引用。工作台与阶段门必须读取同一校验结果。

## 10. 变更记录

| 日期 | 变化 | 确认依据 |
|---|---|---|
| 2026-08-31 | 建立八阶段与 43 个工程 Skills 的初版路由 | 用户要求先行确定各阶段接入能力 |
| 2026-08-31 | 调整为 AI-FDE 方法、工程执行、Harness 工具三层；引入 11 个方法 Skills、Artifact Catalog 和渐进结构状态 | 用户确认结合 `davidahmann/fde-guide` 重新调整 Spec |
| 2026-09-01 | 固定 43 Skills 工程来源 commit，并把阶段 1 运行时收紧为独立分层 Skills、逐条证据和结构成熟度合同 | 用户要求在真实测试前补齐三项缺口 |
| 2026-09-02 | 把阶段 3～8 的单一复合 Skill 拆成真实注册的必做与按需工作方法目录 | 用户指出后续阶段只有一个 Skill 无法指导真实工作 |

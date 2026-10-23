---
document: feature-map
status: confirmed
prd: docs/PRD.md
product_spec: docs/specs/product-spec.md
updated: "2026-09-16"
---

# FF - FDE 交付工作台 V2 Feature Map

## 拆分原则

- 四个共享 Feature 先形成全部阶段复用的项目、工作台、执行和证据能力。
- 八个阶段 Feature 分别交付一项可独立观察、评审和回退的 FDE 工作结果。
- `davidahmann/fde-guide` 的 11 个 Skills 负责业务方法、Artifact 和决策门；43 个工程 Skills 负责具体代码、数据、测试、发布和运维动作；DeepSeek Harness 工具负责真实执行与审计。
- Artifact 按同一对象渐进完善，结构校验和事实证据分别表达，不能以 Schema 通过替代客户事实、人工批准或生产证据。
- Feature 不按页面、前端、后端或模型拆分；每项结果可以跨 DeepSeek Harness Host、Client、Session、Skill、Tool 和 Workspace。
- 本表确认后是 Feature 边界、需求／PSC 归属和依赖的唯一事实源。
- 文档确认不等于批量开发授权；后续仍按用户指令逐个 Feature 开发、调试和更新证据。
- 项目通用预览归属 F002 的共享工作台能力，F009 等阶段仅复用入口；遵守 PSC-007、PSC-019 的运行记录与隔离要求，不给各阶段或业务项目分别维护端口补丁。

## Feature Map

| Feature ID | 目录 | Feature | 用户可观察结果 | 来源合同 | 依赖 | 优先级 | 状态 |
|---|---|---|---|---|---|:---:|---|
| F001 | F001-project-lifecycle | 项目身份与 V2 生命周期 | 当前项目拥有隔离身份、八阶段、四类人工决定、合法返回和 V1 保护 | REQ-001, REQ-003, REQ-004, REQ-005, REQ-009, NFR-001, NFR-002, NFR-003, NFR-005, NFR-006, PSC-001, PSC-003, PSC-004, PSC-008, PSC-009, PSC-010, PSC-024 | 无 | P0 | planned |
| F002 | F002-stage-workbench | 透明的当前阶段工作台 | 用户始终知道当前阶段为什么做、正在做什么、得到了什么和下一步需要做什么 | REQ-002, REQ-003, REQ-006, REQ-008, REQ-010, REQ-025, REQ-027, NFR-002, NFR-004, NFR-013, PSC-002, PSC-004, PSC-005, PSC-007, PSC-009, PSC-021, PSC-024 | F001 | P0 | in-progress |
| F003 | F003-controlled-agent-execution | 受控 Agent 执行 | 用户用自然语言在最小上下文和工具权限内驱动可停止、可验证、可审计的闭环工作 | REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, NFR-007, NFR-008, NFR-009, NFR-010, PSC-011, PSC-012, PSC-013, PSC-014 | F001, F002 | P0 | planned |
| F004 | F004-skill-artifact-evidence | Skill 路由、Artifact 与证据 | 用户无需记 Skill 名称即可获得按需能力，重要结果持久化并成为后续工作的可信输入 | REQ-007, REQ-018, REQ-019, REQ-026, REQ-028, REQ-029, NFR-011, NFR-012, NFR-014, PSC-006, PSC-015, PSC-022, PSC-023 | F001, F002, F003 | P0 | planned |
| F005 | F005-discover-value | 阶段 1：发现高价值问题 | FDE 从客户叙述和现场证据中选出值得继续的问题并形成机会判断 | REQ-003, REQ-006, REQ-007, REQ-018, REQ-019, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-015, PSC-021, PSC-022, PSC-023, PSC-024 | F001, F002, F003, F004 | P0 | in-progress |
| F006 | F006-define-outcome-scope | 阶段 2：定义结果、范围与责任 | FDE 获得可验证的结果、范围、责任、初始工作流和停止条件 | REQ-003, REQ-006, REQ-007, REQ-018, REQ-019, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-015, PSC-021, PSC-022, PSC-023, PSC-024 | F005 | P0 | in-progress |
| F007 | F007-investigate-environment | 阶段 3：调查现场环境 | FDE 看见数据、系统、接口、权限、组织和治理的真实边界与缺口 | REQ-003, REQ-006, REQ-007, REQ-020, REQ-021, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-012, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-016, PSC-017, PSC-021, PSC-022, PSC-023, PSC-024 | F006 | P0 | in-progress |
| F008 | F008-design-vertical-slice | 阶段 4：方案与纵向切片 | FDE 获得有真实系统依据的方案、合同、NFR 和最窄可运行业务链 | REQ-003, REQ-006, REQ-007, REQ-014, REQ-015, REQ-020, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-009, NFR-011, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-013, PSC-016, PSC-021, PSC-022, PSC-023, PSC-024 | F007 | P0 | in-progress |
| F009 | F009-poc-eval | 阶段 5：PoC 与 Eval | FDE 在 DSH 开发目标项目，工作台展示运行情况、候选版本、测试指标与证据，测试后人工决定是否进入下一阶段 | REQ-003, REQ-006, REQ-007, REQ-022, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-018, PSC-021, PSC-022, PSC-023, PSC-024 | F008 | P0 | in-progress |
| F010 | F010-integration-pilot | 阶段 6：企业集成与受控 Pilot | FDE 在限定用户、数据、周期和动作权限内运行并观察真实 Pilot | REQ-003, REQ-006, REQ-007, REQ-023, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-012, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-019, PSC-021, PSC-022, PSC-023, PSC-024, PSC-025 | F009 | P0 | in-progress |
| F011 | F011-production-adoption-handover | 阶段 7：生产、采用与验收交接 | FDE 看见生产结果、采用、验收、交付物和责任移交是否真实成立 | REQ-003, REQ-006, REQ-007, REQ-023, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-012, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-019, PSC-021, PSC-022, PSC-023, PSC-024, PSC-025 | F010 | P0 | in-progress |
| F012 | F012-continuous-improvement | 阶段 8：持续改进与能力沉淀 | FDE 把生产证据转成经复测、审批、可回滚的改进和有边界的复用资产 | REQ-003, REQ-006, REQ-007, REQ-024, REQ-025, REQ-026, REQ-028, NFR-002, NFR-004, NFR-011, NFR-012, NFR-013, NFR-014, PSC-003, PSC-005, PSC-006, PSC-020, PSC-021, PSC-022, PSC-023, PSC-024, PSC-025 | F011 | P1 | in-progress |

| F024 | F024-business-discovery-lab | 独立业务挖掘实验室 | 无需创建项目即可完成五案例访谈、取证、计算和报告训练，返回后项目与八阶段不变 | REQ-030, REQ-031, REQ-032, PSC-026 | 无 | P0 | in-progress |
| F025 | F025-platform-navigation | 统一工作台导航与总览 | 默认总览、三模块切换、继续项目且保留训练现场 | REQ-033, PSC-027 | F002, F024 | P0 | in-progress |
| F026 | F026-stage-one-skills-center | 平台与课程技能阅读下载 | 七个中文平台 Skill 统一文件加载、正文阅读与完整下载，课程原版独立保留 | REQ-034, PSC-028 | F025, F005 | P0 | in-progress |
| F027 | F027-harness-021-compatibility | 新基座下继续既有交付 | 在新版基座继续使用项目、阶段、会话、实验室与 Skills，保留权限、历史和回退条件 | REQ-001, REQ-009, REQ-010, REQ-030, REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, NFR-001, NFR-003, NFR-005, NFR-006, NFR-007, PSC-001, PSC-008, PSC-009, PSC-010, PSC-026, PSC-027, PSC-028, PSC-029, PSC-030 | 无 | P0 | in-progress |

## 首个验证切片

2026-10-23 用户明确授权兼容官方最新版，并要求先完成 docs 再开发。本轮仅实施 F027：以已存在的 FDE 功能和本地未提交源码为保留基线，不扩展产品范围、不升级项目生命周期、不批量开发其他 Feature。PRD 与 Product Spec 的既有行为合同保持不变；技术目标、会话格式迁移和回退进入 F027 Plan 与 Architecture。人工体验仍是最终验收关卡。

F025 的统一导航由用户于 2026-09-16 确认。2026-09-17 用户确认 F026 第一阶段七个 Skill 的卡片、查看、文件阅读与下载，并授权按定稿图实施；F026 替代技能占位，保留 F025 的侧栏、项目中心及实验室流程。

2026-09-17 后续授权在 F026 同页新增课程原版分类、课次标记与完整原包阅读下载；保持稳定 Feature ID 和已有内置方法，不把课程资料接入 Agent 调用链。

2026-09-18 用户纠正 F026：七个平台内置条目也必须完整收录原版 Skill 及其配套资料，不再展示或下载精简适配包；条目、导航、课程和 Agent 运行适配层保持不变。

2026-09-18 用户进一步授权 F026 统一当前七个 Skill 的中文标准文件、原生加载、阅读与下载，并简化名称/正文界面；F005 的阶段产物和人工决定规则作为保留约束，不扩展其他阶段或课程运行能力。

F001～F004 建立共享能力，F005 用“发现高价值问题”完成第一条端到端产品验证。首个阶段只接入 `qualify-ai-workflow`、条件触发的 `reframe-ai-engagement`，以及 Workflow Charter、Engagement Reframe、Field Observation Log 三类必要 Artifact；不安装完整外部能力库。实施可以在同一切片内增量进行，但只有当前用户明确授权的 Feature 才进入 in-progress。

## 范围外与延期项

- V1 六阶段项目到 V2 的自动或批量迁移不在当前 Feature Map；既有项目由 F001 继续保护。
- 阶段 6–8 已确认专用页签、版本化证据和未来只读预览；实际部署、外部观测和生产语义查询执行器仍需后续授权接入。
- 外部 Skill 源码接入、翻译和许可审查在对应阶段实施前逐项完成，不因路由目录确认而批量安装。
- F024 只集成独立训练模块，不增加报告回流、项目联动、学员账号或自动阶段决定。F013～F023 历史编号不重复分配。
- F024 实现、目标构建与无密钥检查已完成；真实模型质量与界面体验待用户手动确认，保留 `in-progress`，不以自动检查替代人工验收。

## 变更记录

| 日期 | 变化 | 影响 | 确认依据 |
|---|---|---|---|
| 2026-08-31 | 建立四个共享 Feature 和八个阶段 Feature，确定首个阶段验证切片 | F001～F012 | 用户要求落盘每阶段 Feature 并先行设计 DeepSeek Harness Skill 接入 |
| 2026-08-31 | 将 Skill 来源拆为 AI-FDE 方法层与工程执行层，并收窄首个切片 | F004～F012 | 用户确认结合 `davidahmann/fde-guide` 重新调整 Spec |
| 2026-09-01 | 建立权威八阶段状态、统一基础工作台、产物扫描、人工评审和手动测试包 | F001, F002, F005～F012 | 用户授权按第一阶段的产品逻辑继续完成后七阶段基础闭环 |
| 2026-09-03 | 退役不在现行 Feature Map 中的遗留 F017 需求知识图谱目录与实现；F001～F012 边界和编号不变 | 无 | 用户明确要求全部移除 llm-wiki 集成逻辑 |
| 2026-09-04 | F008 复用现有上下文合同，增加按机制必要性启用的本体／知识图谱路线及受控 Agent 查询 | F008；复用 PSC-013，不改变 F003 主责 | 用户确认第四阶段双路线与 Semantica 后续上下文方向 |

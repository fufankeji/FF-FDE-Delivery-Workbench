# Agent Note: 基于 Workspace 与 Session 事实的项目交付页面

Status: implemented

[English](2026-08-26-project-delivery-pages.md) | 中文

## Problem

FDE 工作台把一个 Harness Workspace 作为一个交付项目，并允许该项目包含多个普通 Session。对话与右侧开发 Dock 适合执行真实工作，但都不适合如实比较全部项目、交付阶段、周期和活动。API 文档、系统架构、用量分析和评估优化也属于项目产物或项目级证据；绑定到单个 Session 会把同一 Workspace 的共享事实拆散。

可复用的社区插件各自具有更窄的归属。`dsh-openapi` 加载一份进程级静态 API 目录，`dsh-planchart` 保存 Session 计划并增加 steps overlay，`dsh-observe` 向已配置后端导出运行记录，`dsh-eval-harness` 提供由 Agent 驱动的回归评估工具。原样安装全部界面会跨越项目边界、重复开发 Dock，或要求本地工作台先部署外部基础设施才能解释自身项目。

## Decision

`@deepseek-ai/dsh-client-ui-fde-project` 在 `sidebar.footer.action` 注册“项目进度”，并通过 `shell.overlay` 渲染页面，页面左侧偏移跟随实时侧边栏宽度。页面读取 Workspace 与 Session 对象层、浏览器本地的新建项目元数据和按 Workspace 保存的阶段路由。它展示阶段分段和已确认日期，不虚构完成百分比。进入项目时，页面优先选择该 Workspace 最新的可见普通 Session；只有没有可恢复会话时才建立或复用首个空白 Session，打开后关闭全局页面。进入项目详情会强制刷新一次项目产物快照，避免 Agent 已写入文件或架构已确认却仍被 Controller 首次加载缓存遮蔽。当前阶段可以在 FDE 打开警示面板、填写原因并再次确认后返回一级；页面保留全部产物、展示最近一次审计，把受影响范围标为“待重新确认”，并把终态操作命名为“重新打开项目”。

同一个客户端包在 `conversation.view` 注册四个项目 View：API 文档、系统架构、用量分析和评估优化。每个 View 都通过当前 Session membership 推导 Workspace 归属。`@deepseek-ai/dsh-fde-project` 提供一个可信快照路由，读取 `.fde/api-docs.json`、`.fde/architecture.json` 或 `.fde/evaluations/` 前，先解析显式且已注册的 WorkspaceId；调用方提供的目录不能选择项目。

OpenAPI 工具复用 MIT 许可 `dsh-openapi` 提交 `fb854355b89e495ded090b9e2eb94c33430d2366` 的解析、目录、校验、重定向、私网限制、凭据 Header、超时和有界响应实现。系统不直接挂载上游插件的静态目录。`openapi_list`、`openapi_describe` 和 `openapi_call` 在每次执行时通过 `workspaceRegistry` 解析调用 Agent 的 cwd，并且只加载该 Workspace 的显式配置。工具 Schema 在项目之间保持稳定，执行路径负责项目隔离，默认只允许 `GET` 和 `HEAD`。

系统架构复用 MIT 许可 `dsh-planchart` 提交 `e63a6359ed43e6ae35cac505f10a8d128f53eba7` 的分组、节点与边思路，但不使用它的 Session 计划或右侧 steps UI。`architecture_get` 返回项目精确 revision；`architecture_set` 只在 `expectedRevision` 匹配时接受一份完整候选，校验有界的分组、节点和边后，通过带锁的原子替换提交。方案设计 Skill 与浏览器刷新动作要求 Agent 先检查已确认文档，以及真实源码的入口、服务、存储、集成、部署配置和交付输出，再进行建模。候选保留稳定 ID，沿主路径排列二至七个职责分组，区分当前实现与待实施组件，并且只保留主要节点以及关键运行时、数据、控制或依赖关系。项目开发期间，只有用户明确要求，或主要服务、入口、存储、集成、部署边界和数据路径发生结构性变化时，才按相同规则提交完整候选；内部重构不触发架构更新。

浏览器根据这些有序分组、节点与边生成响应式信号流布局，并提供动态连线、节点聚焦、相关路径强调、明暗主题适配、缩放、SVG/PNG 导出和精确 revision 确认路由。项目进度中的候选架构行只负责导航，不负责确认：它打开目标项目最新的可见普通 Session，并通过按 Session 寻址的 Conversation 服务选择“系统架构”页。确认动作仍在完整架构页中；下一次刷新快照后，已确认行变为不可点击。生成或修改候选必须由用户明确向当前 Agent 提交提示；确认不会推进交付阶段。

来自提交 `64791ff93ac01bac5bb6e6a14f48d072b479464b` 的 `dsh-observe@0.2.0` 以 `enabled: false`、无 OTLP/Langfuse 后端、关闭 Prompt/Completion 采集的配置安装。因此本地“用量分析”页面直接汇总既有 Session 的 `sessionStats` 与 `tokenUsage` 投影，不采集、不外发。后续部署可以配置外部后端，而不需要替换项目页面。

`dsh-eval-harness` 提交 `2f59376e2a2f22c151f75de446d5cde764dd5aff` 提供 `eval_run`、`eval_gate` 和 judge 校准工具。其过期的 DSH 精确依赖版本被重定向到当前锁定 Harness checkout；源码在获准的 Git dependency prepare 阶段构建。Host 执行前守卫把用例、运行输出和 gate 报告限制在调用 Agent 的 Workspace，拒绝符号链接穿越和模型指定可执行文件或 Profile，并在 V1 拒绝 Judge 校准。“评估优化”页面只在用户点击后排队一条 `eval_run` 指令，从当前项目的有界目录读取报告，并允许用户把一个已索引报告原子批准为 Baseline。页面加载和自动检查不会启动模型评估。

验证决定与真实测量结果保持分离。项目进度只允许 FDE 通过精确合同的同源操作，为一个尚未满足的必需指标补充带理由的接受决定。Host 在验证合同文件锁内重新核对当前方案摘要和指标是否仍符合操作条件，写入 `result.manualAcceptance.reason` 与 `acceptedAt`，并保留 NOT_RUN／FAIL、证据缺口、数值和说明。完整接受只解除该指标自身的阻塞；过期摘要、可选指标、已经正常满足的指标、重复决定和空理由都会被拒绝。

项目进度还拥有部署试运行与验收移交详情页。Host 有界投影 schema v1 项目文件、项目内证据、固定产物、阻塞项和项目完成终态。部署页把 FDE 的问题接受动作绑定到页面当前展示的精确合同摘要；该动作必须填写理由，并且只改变这一条问题。目标环境授权与试运行就绪结论归属另一项独立的精确合同 FDE 操作，只有其余证据、问题决定和固定产物齐备后才可使用；该操作原子写入两个决定字段，但不执行部署、停止或回滚。验收移交页支持企业验收证据的有界数组，并增加一份带文件锁、绑定精确摘要的四步 FDE 表单，用于记录验收状态、交付物可取得状态、条件决定，以及有证据的培训和权限/运维责任移交。Host 保留交付物身份，并拒绝过期摘要或已变化的条目集合。该操作只记录事实，与最终的两步阶段确认相互独立；`completed` 终态仍保留最终移交证据。

## Alternatives considered

**把项目概览放入 Conversation Tab。** Session Tab 会被限制在已经打开的项目中，不能提供自然的多项目入口，也会把项目管理和实际开发页面混在一起。

**在项目进度中直接确认架构。** 紧凑的产物行无法展示完整架构、依赖关系和 revision 上下文。因此项目进度只引导 FDE 进入完整“系统架构”页，不持有确认写操作。

**原样安装所有社区插件。** 静态 OpenAPI 目录可能让一个项目的 Agent 看到另一项目的 API，planchart 的 steps overlay 则在 Session 归属下重复项目阶段。实现保留其可复用机制，并把归属收敛到 Workspace。

**显示观测前强制部署 Langfuse。** 这会让本地交付诊断依赖 Docker、凭据、外网和第二个应用。既有持久 Session 投影能够立即提供项目汇总，而导出器保持为显式可选层。

**构建通用项目管理和评估平台。** 客户管理、资产复用、任意甘特编辑、定时评估和完整 APM 超出单条交付链版本。当前页面只展示项目事实和显式动作，不创建这些相邻产品。

## Consequences

左侧栏保持项目管理与交付工作之间的稳定入口，中间保持官方 Conversation，右侧 Dock 保持 Files、Editor 和 Git。API、架构、用量分析和评估优化状态跨 Session 持续可见，因为项目文件与 Host 记录持有事实，而不是组件内存。跨插件深链使用按 Session 寻址的 Conversation View 动作，不使用 DOM 点击或直接改写持久化状态。缺失文件、关闭的导出器、无效报告和不可用 API 页面保持明确，不会被替换为演示数据。

五个项目工具向 Agent 请求增加稳定 Schema：三个 OpenAPI 工具和两个系统架构工具。只有调用后的结果会进入上下文。架构质量取决于 Agent 能读取的证据，因此缺失源码或尚未解决的文档差异会保留为带标记的候选事实，不会被伪装成确定结论。稳定 ID 使跨 revision 的聚焦与变更审阅保持连贯；限制分组和关系数量则以不生成穷举调用图为代价，换取可读的项目级系统模型。外部观测导出在部署配置明确启用前保持不存在，评估只在直接点击后才可能产生费用。企业与周期元数据仍属于当前浏览器的 Workspace 视图存储；iframe 拒绝嵌入时提供外部打开，而不绕过跨域策略；评估页面把长时间进程控制交给当前 Agent 及其现有取消路径。

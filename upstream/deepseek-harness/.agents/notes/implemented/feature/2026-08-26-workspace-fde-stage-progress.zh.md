# Agent Note: Workspace 级 FDE 阶段进度

Status: implemented

[English](2026-08-26-workspace-fde-stage-progress.md) | 中文

## Problem

一个 FDE 项目会包含多条普通 Session，而 DSH 的规划、目标、Todo 和 Workflow Run 都属于单个 Agent 或 Session。把当前交付阶段放进某条对话会让项目内其他对话产生不同结论；放在浏览器状态中则无法在刷新或其他页面中保持权威。文件出现在 Workspace 中也不代表客户或 FDE 已接受其中内容。因此，阶段进度既需要一个项目级权威来源，也需要明确的完成门，以区分 Agent 候选产物与 FDE 决策。

## Decision

`@deepseek-ai/dsh-fde-stage` 打开一个 `fde_stage` storage domain，其中 `projects` 表以 WorkspaceId 为键。仅限可信同源访问的 POST 路由只接受已注册 WorkspaceId：记录存在时读取，不存在时先提交初始 `requirements` 记录再返回。两个独立的固定完成路由只实现 `requirements` 到 `solution` 和 `solution` 到 `development`，都不接受浏览器提交的目标阶段。两者都要求精确匹配当前 revision，并按 Workspace 串行执行阶段变更。

需求门读取 `fde-deliverables/01-requirement-research/` 下三份固定 Markdown 产物。方案门读取 `fde-deliverables/02-solution-design/` 下四份固定 Markdown 产物，并读取 `.fde/architecture.json` 中的当前项目架构；四份文件必须存在，当前架构 revision 的状态必须为 `confirmed`。文件存在只会让操作可执行。每个路由真正提交下一阶段前，FDE 仍须在项目进度中再次确认，Host 会在提交时重新检查全部条件。

Host 注册按需加载的 `fde-requirement-research`、`fde-solution-design` Skills 和一个简短的阶段感知系统提示段。Skills 将 Agent 产物限制在固定项目路径，要求区分候选、事实与未知项，并禁止 Agent 确认客户事实、确认架构或推进阶段。架构更新只能使用 `architecture_get` 与 `architecture_set`，不能直接写入 `.fde/architecture.json`。

`@deepseek-ai/dsh-client-ui-fde-stage` 拥有一个以 WorkspaceId 为键、生命周期属于 apply 的 observable controller。它只从 Workspace 投影的 `sessionIds` 解析 Session 归属，合并重复读取，保留明确错误，并且只重试指定项目。两个上下文 registration 共享该 controller：`conversation.input.dock` 在空白输入框上方显示初始阶段，`conversation.session.header.utilities` 在 Session 开始后显示当前阶段。空白提示使用 Conversation Root 的 `--dsh-composer-card-max-width` 并减去两侧 `--dsh-composer-side-clearance`，因此即使 Slot 位于更宽的 Composer Stack 中，其外边界仍与输入卡一致。独立的多项目页面和两个手工完成门属于 [`ui-fde-project`](2026-08-26-project-delivery-pages.zh.md)，因此项目管理不会变成另一个 Session View。

产品顺序为 `requirements` → `solution` → `development` → `validation` → `pilot` → `handoff`。中文名称与高层目标属于 Client locale 字典。Better Sidebar 继续只作为代码开发 Dock，不拥有项目生命周期状态。

## Alternatives considered

**使用 Plan Mode、Goal、Todo 或 Workflow phases。** 这些值描述单个 Agent、Session、Turn 或 Workflow Run，无法作为多条普通 Session 共享的 Workspace 项目权威状态；Workflow phase 标签也不定义执行结构。

**把进度持久化在浏览器 store。** 浏览器本地值虽然能快速渲染，却会在多标签页之间分裂，并在本地存储丢失后失去权威。Host storage domain 已经是与 Workspace 配套的项目级持久机制。

**把阶段面板放入 Better Sidebar。** 右侧 Dock 负责 Files、Editor、Git 和 Agent 文件审查。项目生命周期在可选 Dock 收起后仍需可见，因此阶段界面使用现有 Conversation 扩展点。

**在所有固定文件存在时自动推进。** Agent 可以写出形式完整的文件，但其中仍可能有客户待确认问题、已否决决策或未确认架构。自动推进会把文件系统状态错误地当成业务决策。

**让 Agent 调用阶段变更工具。** Agent 负责生成和更新候选材料，FDE 则拥有客户关系和接受交付风险的决定权。任何模型工具都不能确认或推进项目阶段。

**提供一个通用的“下一阶段”或目标阶段接口。** 通用变更会允许浏览器绕过每个阶段独立的证据规则。每个已交付的完成门都有固定来源阶段、目标阶段、证据检查、文案与稳定错误码；后续阶段在自身合同定义前不提供推进能力。

## Consequences

每个项目都从需求调研开始可见，其所有 Session 读取同一个值，另一个 Workspace 不能通过 cwd 或最近项目继承该值。空白与已开始对话使用不同的现有 Slot，不修改 Conversation 壳。项目进度展示当前阶段的固定输入与输出，通过经过验证的同源路由预览已存在产物，并拥有明确的 FDE 确认动作。Revision 检查会把旧标签页转成冲突，而不是造成重复或乱序阶段变更。

前两个阶段现在拥有真实的证据合同，项目开发及后续阶段仍不提供完成动作。固定文件存在的证明力有意低于人工批准；原型、API、数据映射和 POC 等条件性证据仍由 FDE 人工审阅；阶段记录仍没有变更历史或浏览器推送通道。Agent 只接收当前阶段指导，无法改变生命周期状态。

# Agent Note: Workspace 级 FDE 阶段进度

Status: implemented

[English](2026-08-26-workspace-fde-stage-progress.md) | 中文

## Problem

一个 FDE 项目会包含多条普通 Session，而 DSH 的规划、目标、Todo 和 Workflow Run 都属于单个 Agent 或 Session。把当前交付阶段放进某条对话会让项目内其他对话产生不同结论；放在浏览器状态中则无法在刷新或其他页面中保持权威。第一个产品切片也尚未确认任何阶段完成条件，因此提供推进动作会把未经验证的点击变成项目进度。

## Decision

`@deepseek-ai/dsh-fde-stage` 打开一个 `fde_stage` storage domain，其中 `projects` 表以 WorkspaceId 为键。仅限可信同源访问的 POST 路由只接受已注册 WorkspaceId：记录存在时读取，不存在时先提交初始 `requirements` 记录再返回。请求没有目标阶段字段，该包也不注册模型工具或阶段变更服务。

`@deepseek-ai/dsh-client-ui-fde-stage` 拥有一个以 WorkspaceId 为键、生命周期属于 apply 的 observable controller。它只从 Workspace 投影的 `sessionIds` 解析 Session 归属，合并重复读取，保留明确错误，并且只重试指定项目。两个上下文 registration 共享该 controller：`conversation.input.dock` 在空白输入框上方显示初始阶段，`conversation.session.header.utilities` 在 Session 开始后显示当前阶段。空白提示使用 Conversation Root 的 `--dsh-composer-card-max-width` 并减去两侧 `--dsh-composer-side-clearance`，因此即使 Slot 位于更宽的 Composer Stack 中，其外边界仍与输入卡一致。独立的多项目页面属于 [`ui-fde-project`](2026-08-26-project-delivery-pages.zh.md)，因此项目管理不会变成另一个 Session View。

产品顺序为 `requirements` → `solution` → `development` → `validation` → `pilot` → `handoff`。中文名称与高层目标属于 Client locale 字典。Better Sidebar 继续只作为代码开发 Dock，不拥有项目生命周期状态。

## Alternatives considered

**使用 Plan Mode、Goal、Todo 或 Workflow phases。** 这些值描述单个 Agent、Session、Turn 或 Workflow Run，无法作为多条普通 Session 共享的 Workspace 项目权威状态；Workflow phase 标签也不定义执行结构。

**把进度持久化在浏览器 store。** 浏览器本地值虽然能快速渲染，却会在多标签页之间分裂，并在本地存储丢失后失去权威。Host storage domain 已经是与 Workspace 配套的项目级持久机制。

**把阶段面板放入 Better Sidebar。** 右侧 Dock 负责 Files、Editor、Git 和 Agent 文件审查。项目生命周期在可选 Dock 收起后仍需可见，因此阶段界面使用现有 Conversation 扩展点。

**在首个切片提供手动下一阶段按钮。** 当前没有任何阶段获得已确认输入、产物或完成规则。省略全部阶段变更操作，可以在 F005 能够检查真实交付门以前保持进度真实。

## Consequences

每个项目都从需求调研开始可见，其所有 Session 读取同一个值，另一个 Workspace 不能通过 cwd 或最近项目继承该值。空白与已开始对话使用不同的现有 Slot，不修改 Conversation 壳。全局项目页面自行按 Workspace 读取同一个 Host 路由，不导入另一个客户端插件的值。当前记录没有阶段变更历史、受影响状态或浏览器推送通道；只有对应交付门规则确认后，F005 才会增加这些能力。在后续 `fde-context` Consumer 把可重建项目快照记录到对应 Session 前，该阶段不会进入模型上下文。

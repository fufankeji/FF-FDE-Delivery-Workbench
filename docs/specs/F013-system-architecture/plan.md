---
document: feature-plan
feature: F013
status: ready
updated: "2026-08-26"
---

# F013 · 系统架构实施计划

## 现有上下文与复用

- 官方 `conversation.view` 已用于 Chat/Trajectory 等项目会话视图，适合承载当前项目“系统架构”；项目事实必须通过 Workspace membership 解析，不能把 Session 当作架构身份。
- 复用公开 `dsh-planchart@e63a6359ed43e6ae35cac505f10a8d128f53eba7`（v0.1.0，MIT）的结构化图 schema、确定性自动布局、明暗主题、缩放、Agent set/get 和 SVG/PNG 导出。
- 原插件把图按 Session 保存，并通过 `shell.overlay` 增加右侧步骤面板；FDE 版本必须改为 WorkspaceId 项目级状态，移除步骤面板，避免与项目进度和右侧开发 Dock 冲突。
- `dsh-diagram`/Excalidraw 支持完整手工编辑和自动保存，但依赖更重、严格面向 DSH `0.1.0-rc.6`，且第一版用户未要求拖拽编辑，因此只保留为后续备选，不安装。
- 本地 LangChain Agent Lab 的“架构”实际使用 Langfuse `graphUrl` 展示一次运行图；F013 不复用该语义，只把运行图留在“轨迹/观测”。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/fde/project/` | 项目交付产物 Host | 增加 Workspace 级架构 schema、revision、候选/确认、原子文件持久化和 Agent set/get | AC-F013-001～004 |
| `packages/client/ui-fde-project/` | 项目交付页面 Client | 增加“系统架构”Conversation View、确定性 SVG 图、状态/版本、缩放与导出 UI | AC-F013-001～004 |
| `dsh-planchart` 图形核心 | 公开 Session 级插件 | 固定提交并复用 schema/layout/export；移除 steps overlay，替换 Session identity 和产品文案 | AC-F013-001～004 |
| F005/F018 消费 | 方案设计 Skill 维护候选架构，阶段门读取确认状态 | 保留架构候选/确认归属；F005 只读取精确 `confirmed` revision，不在 F013 内推进阶段 | AC-F013-002, AC-F013-004 |
| Bundle、TypeScript 聚合、第三方声明 | FDE Web 组合 | 注册 Host/Client 包并保留 MIT 许可与来源 | 全部 |
| Architecture、Agent Note、验证记录 | 技术决策与证据 | 记录公开代码复用、项目持久化、导出安全和真实验证 | 全部 |

## 实现方案

以 `dsh-planchart` 的 `framework` 图为起点，不直接安装其完整 Bundle。若复制或修改实质代码，保留 MIT 许可和第三方声明。将图形 schema 收敛为 FDE 项目架构：标题、摘要、分组、节点、边；节点类型保留核心、入口/输出、存储、外部和普通组件等克制视觉语义。

Host 在 Workspace 项目根的 `.fde/architecture.json` 保存当前明确版本。Agent 工具 `architecture_set` 提交整张候选图，`architecture_get` 读取当前版本；Host 在持久提交前校验数量、引用、文本和结构，并以 expectedRevision 和带锁原子替换防止旧会话覆盖新版本。确认通过可信同源路由引用精确 revision，Agent 不能自行确认。

Client 在 `conversation.view` 注册“系统架构”，通过当前 Session 的 Workspace membership 读取项目状态。只保留架构图页面，不注册 `shell.overlay` 步骤面板。缩放与导出复用公开插件机制，但颜色改为 Harness 主题语义并保持导出文件独立可读。

PNG 导出在浏览器本地从安全 SVG 生成；SVG 必须使用受控元素和属性，不接受任意 HTML、脚本、事件处理器或外部资源。导出失败不更新 Host 状态。

## 实施顺序

1. 固定并审查 `dsh-planchart` 提交、许可、schema、布局和导出代码，完成当前 Harness 兼容 spike。
2. 建立 Workspace 级架构 schema、版本和持久化，完成 set/get、并发修订和项目隔离测试。
3. 实现“系统架构”Conversation View、状态/版本、确定性布局、缩放和主题。
4. 实现自然语言修改闭环：Agent get 当前版本后 set 完整新候选；失败不覆盖。
5. 接入候选/待确认/已确认/受影响语义和安全 SVG/PNG 导出；不推进阶段。
6. 组合 Bundle，运行聚焦 Host/Client/导出测试和官方构建，重启 3080 后交由用户人工检查；不运行浏览器截图或完整 E2E。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 原插件按 Session 保存 | 同项目会话可能分叉 | 全部状态改为 WorkspaceId；Session 仅作为打开页面和生成主体证据 | Host/Client 跨会话测试 |
| 原插件带右侧步骤 Overlay | 与右侧开发 Dock 和项目进度职责冲突 | 不组合该入口，不复制 steps 状态和 UI | Slot 注册测试 |
| 公开插件并未声明当前 rc.2 运行证据 | Client Slot/Projection 合同可能变化 | 固定提交，先做类型和最小运行 spike；按当前官方公开 Slot 重写薄适配 | 开发开始时 |
| 图过大导致交叉或不可读 | 页面不能帮助方案评审 | 保留节点/边/分组上限和确定性布局；超限显式拒绝或要求拆图，不静默裁剪 | 图形合同测试 |
| Agent 全量替换可能覆盖新版本 | 并发会话更新冲突 | revision/expectedRevision 乐观并发；冲突要求重新读取 | Host 并发测试 |
| SVG/PNG 导出可能包含不安全内容 | 本地打开存在脚本或外链风险 | 仅渲染受控图元与文本；禁止脚本、事件和外部资源 | 导出安全测试 |
| F005 阶段门读取架构状态 | 确认架构被误当作自动完成阶段 | 确认只改变架构状态；交付门另行复核项目 PRD 等五份文档、阶段和 revision，FDE 二次确认后才推进 | 联调阶段 |

## 回退策略

F013 通过独立 Host/Client rows 组合。移除 Client row 后项目对话、轨迹和右侧开发 Dock 保持可用；移除 Host row 不删除 Workspace、Session 或项目文件。架构 sidecar 独立保留以便修复后恢复。若公开布局代码无法适配当前 Harness，回退为显示同一结构化架构的安全文本/JSON摘要并报告阻塞，不用 Mermaid 消息或 Langfuse 运行图冒充完成。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F013-001 | Workspace 项目级架构与跨会话共享 | Host 持久化＋Client membership 测试 | 同项目一致、跨项目隔离、重启恢复 |
| AC-F013-002 | revision 安全的 Agent 生成/修改 | Host schema/并发/工具测试 | 完整候选发布，失败或旧 revision 不覆盖 |
| AC-F013-003 | 系统架构 View 与 Trajectory 分离 | Slot 注册与组件测试 | 独立“系统架构”，无 steps overlay 或运行 Trace 混入 |
| AC-F013-004 | 人工确认边界与安全 SVG/PNG 导出 | 状态/导出聚焦测试＋人工检查 | 明确版本、导出可开、无脚本外链、不推进阶段 |

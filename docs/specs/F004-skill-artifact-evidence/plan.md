---
document: feature-plan
feature: F004
status: ready
updated: "2026-08-31"
---

# F004 · Skill 路由、Artifact 与证据实施计划

## 现有上下文与复用

- 当前实现与入口：`skill`、`skill-filesystem`、`tool-skill` 已支持 Skill 注册、文件加载与调用；FDE stage/project 已读取固定产物和责任状态。
- 直接复用点：Skill catalog、filesystem provider、Workspace 项目目录、FDE Artifact 读取器、项目进度与文档预览；`fde-guide` 只作为待适配的方法、Schema 与模板来源。
- 必须保持的现有行为：现有内置 Skills、普通对话、项目文件树和 V1 固定产物继续工作。
- 必须保持的 Product Spec 合同：PSC-006, PSC-015, PSC-022, PSC-023。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/skill/skill` | Skill 注册与目录 | 增加方法／工程层级、阶段适用性与业务化路由元数据 | AC-F004-001 |
| `packages/skill/skill-filesystem` | 从项目文件加载 Skill | 按 route 只加载必要正文与参考 | AC-F004-001 |
| `packages/skill/tool-skill` | Agent Skill 调用 | 记录选用原因、输入与预计 Artifact | AC-F004-001 |
| `packages/fde/stage`、`packages/fde/project` | 产物和责任状态 | 增加 Artifact Catalog、结构状态、证据状态、来源版本和依赖 | AC-F004-002 |
| `ui-fde-stage`、`ui-fde-project` | 阶段与项目投影 | 展示业务化工作、Artifact 和责任证据 | AC-F004-001, AC-F004-002 |

## 实现方案

在现有 Skill 基础设施之上增加分层 `SkillRoute`，不改变 Agent Loop：`fde-guide` 方法 Skill 确定业务工作、Artifact 和决策条件，43 个工程 Skill 承担具体实现，Harness 工具执行真实动作。路由只向 Session 注入本次选中内容。Artifact Catalog 使用项目内索引指向真实文件或结构化状态，保存来源版本、结构成熟度、证据状态和依赖边。Schema 通过只更新结构状态；生产责任仍由证据和有权批准聚合。

## 实施顺序

1. 定义方法、工程和工具三层路由元数据与业务化工作名称。
2. 实现按项目、阶段、任务、Artifact 和权限的按需选择。
3. 定义 Artifact Catalog、来源版本、结构状态、证据状态和依赖关系。
4. 接入可扩展的 Schema Adapter；首批只承认 Workflow Charter、Engagement Reframe、Data Context Manifest 的 starter／complete 渐进能力。
5. 将 Skill 结果写入 Artifact 并供后续请求引用。
6. 建立六项责任投影与错误恢复。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 一次加载过多 Skill | 上下文污染和成本上升 | route 只返回必要正文，目录摘要不等于加载 | 路由测试 |
| 外部 Skill 或 Schema 假设与 Harness 不一致 | 工具误用或错误校验 | 固定来源版本，逐项审查并用 adapter 适配 | 每阶段接入前 |
| 文件存在被误判为客户确认 | 责任状态失真 | 可信状态和批准记录分离 | Artifact 聚合测试 |
| starter 通过被解释为 Artifact 完成 | 过早进入门禁 | 结构状态和证据状态双轴展示 | Schema Adapter 测试 |

## 回退策略

新路由和 Artifact 索引为附加能力；若路由失败，保留普通对话和现有 Skill 手动加载路径并显示能力缺口。旧固定文件继续可读，不被批量迁移。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F004-001 | Skill 被正确按需选择且不自动推进 | 运行路由矩阵和上下文载荷测试 | 只加载命中能力，理由与缺口可见 |
| AC-F004-002 | Artifact 可组合且责任状态真实 | 运行 Artifact 版本、渐进校验与批准聚合测试 | 版本依赖可追溯，结构与证据状态独立，缺批准保持未确认 |

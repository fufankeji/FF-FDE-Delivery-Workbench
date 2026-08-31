---
document: feature-plan
feature: F005
status: ready
updated: "2026-08-31"
---

# F005 · 阶段 1：发现高价值问题实施计划

## 现有上下文与复用

- 当前实现与入口：现有项目资源上传、对话、文档预览、阶段快照和人工确认可作为入口。
- 直接复用点：F001 项目身份、F002 阶段工作台、F003 operation、F004 分层路由与 Artifact Catalog。
- 必须保持的现有行为：V1 需求调研、普通对话、文件树和资源预览继续可用。
- 必须保持的 Product Spec 合同：PSC-003, PSC-005, PSC-006, PSC-015, PSC-021, PSC-022, PSC-023。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/fde/stage` | 阶段定义与快照 | 增加 V2 阶段 1 输入、工作、Artifact 和决定投影 | AC-F005-001, AC-F005-002 |
| `packages/fde/project` | 项目 Artifact | 适配观察日志、Workflow Charter、Engagement Reframe | AC-F005-002 |
| `packages/skill/*` | Skill 注册与调用 | 接入两项方法 Skill 与最小工程 Skill 路由 | AC-F005-001 |
| `packages/client/ui-fde-stage` | 当前阶段工作台 | 呈现现场发现、冲突、证据和决定 | AC-F005-001, AC-F005-002 |
| `packages/client/ui-fde-sources` | 项目资料 | 标记归档与当前发现工作的引用关系 | AC-F005-001 |

## 实现方案

使用 Adapter 将 `fde-guide` 固定版本中的方法 Skill、Workflow Charter Schema、Engagement Reframe Schema 和 Field Observation Log 模板接入现有 Skill 与 Artifact 基础设施。方法输出先进入候选 Artifact；结构校验与证据可信度分开。阶段工作台沿用统一骨架，中心区域专门投影原始诉求与现场事实对照、观察时间线、人员／信任关系和访谈缺口；Skill 与 Schema 细节只在执行详情中展开。

## 实施顺序

1. 固定并审查阶段 1 使用的外部文件、许可证和链接依赖。
2. 实现三个 Artifact 类型和两个渐进 Schema Adapter。
3. 接入方法 Skill 与最小工程 Skill 路由。
4. 实现发现工作台、冲突分支和 Artifact 预览。
5. 接入 FDE 决定、返回影响和真实错误状态。
6. 使用合成现场资料完成端到端验证。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 上游方法内容快速变化 | 结果不可复现 | 固定 commit，升级单独评审 | Skill 接入测试 |
| 用户把 Schema 通过理解为事实确认 | 过早推进 | 分开显示结构与证据状态 | Artifact UI 测试 |
| 访谈内容含客户敏感信息 | 不当进入上下文 | 受项目权限约束并支持引用范围 | Source 隔离测试 |

## 回退策略

阶段 1 通过 V2 生命周期启用；若 Adapter 或路由失败，保留资料、普通对话和执行轨迹，工作台显示能力缺口，不回退到 V1 文件推断或跨项目上下文。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F005-001 | 自然语言路由到正确发现方法且过程可理解 | 运行阶段 1 路由和工作台定向测试 | 正常、冲突、缺输入三类场景选择正确且只加载必要能力 |
| AC-F005-002 | Artifact 可校验、引用并由 FDE 决定去留 | 运行 Artifact 与阶段决定测试 | 结构和证据状态独立，非人工事件不推进阶段 |

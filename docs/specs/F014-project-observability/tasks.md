---
document: feature-tasks
feature: F014
status: in-progress
updated: "2026-08-27"
---

# F014 · 用量分析任务

## 任务规则

- 当前集成默认不得外发任何 Session 内容；没有用户/部署配置时保持 `dsh-observe` disabled。
- 每项结果有真实证据后才勾选；后端未配置不是假成功，也不阻塞本地用量分析页面。
- 不实现通用 APM 或完整 `dsh-maze`。

## 任务清单

- [x] T001 冻结用量分析产品与插件合同
  - 来源：REQ-019, NFR-001, NFR-002, NFR-003, NFR-005, NFR-007, NFR-008, AC-F014-001～004
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F014 三件套
  - 完成证据：项目/Session 边界、默认关闭、脱敏、失败隔离、本地/远端状态和插件固定提交已落盘
  - 验证：PRD、Product Spec 与 F014 定向规格校验

- [x] T002 固定安装并验证 `dsh-observe`
  - 来源：REQ-019, NFR-002, NFR-003, AC-F014-002, AC-F014-003
  - 依赖：T001
  - 修改：第三方依赖、Bundle、默认配置、许可与兼容证据
  - 完成证据：当前 rc.2 加载成功，默认 disabled，无后端/凭据时不外发，状态 Remote 可用或真实降级
  - 验证：插件既有测试＋当前组合最小加载/状态检查

- [x] T003 建立 Workspace 级本地运行摘要
  - 来源：REQ-019, NFR-001, NFR-005, NFR-007, NFR-008, AC-F014-001
  - 依赖：T001
  - 修改：FDE Observability Client 聚合、Workspace membership 与 Session/Stats 读取
  - 完成证据：项目内运行列表和可得指标真实，跨项目隔离，单 Session 失败不阻塞全部
  - 验证：Host 聚合与跨项目聚焦测试

- [x] T004 实现“用量分析”页面和导出状态
  - 来源：REQ-019, NFR-005, NFR-007, AC-F014-001, AC-F014-004
  - 依赖：T002, T003
  - 修改：FDE Observability Client、Conversation View、运行表、指标与后端状态
  - 完成证据：用量分析从项目开发阶段开始可见，本地汇总、会话运行表和 disabled 状态可见，项目切换不串数据；未启用外部后端时不伪造 healthy/degraded/缓冲数据
  - 验证：Client Slot、状态和 membership 聚焦测试

- [x] T005 验证脱敏、缓冲和失败隔离
  - 来源：REQ-019, NFR-001, NFR-002, NFR-003, NFR-004, AC-F014-002, AC-F014-003
  - 依赖：T002, T003
  - 修改：组合测试、失败注入和验证记录
  - 完成证据：敏感值不进入输出；后端失败/缓冲上限不影响 Agent 和 Session；状态不伪造
  - 验证：聚焦安全与失败注入测试

- [x] T006 组合、构建、重启并记录证据
  - 来源：REQ-019, NFR-005, NFR-007, NFR-008, AC-F014-001～004
  - 依赖：T004, T005
  - 修改：Web Bundle、聚合配置、README、Architecture、验证记录与运行服务
  - 完成证据：聚焦测试和官方构建通过，3080 可见用量分析 View，外部未配置状态真实
  - 验证：聚焦测试＋完整构建＋HTTP/Boot 清单

## Task 数量复核

- 任务总数：6
- 原因：按合同、外部插件、本地聚合、页面、隐私/失败、组合交付六个独立结果拆分。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-26 | in-progress | 用户认可检索方案并授权连续开发；T001 文档合同完成 | T002～T006 连续实施，不等待中途人工确认 |
| 2026-08-26 | implementation-ready-for-manual-review | `dsh-observe@0.2.0` 已按 disabled、无后端、关闭内容采集的配置启动；119 项插件测试覆盖配置、脱敏、队列、缓冲、重试和失败隔离；项目页面按 Workspace membership 汇总真实 Session/Stats/Token；完整构建与 3080 启动通过 | 当前部署没有外部后端，因此页面只显示真实 disabled 状态；启用 Langfuse/OTLP 后的远端状态映射仍需在实际配置阶段联调 |
| 2026-08-27 | in-progress | 根据用户真实页面验收，将观测入口的最小阶段纠正为项目开发；定向 View/Apply 5 项测试、Client 类型检查、Bundle 与 3080 HTTP 通过 | 等待用户刷新 3080 后人工确认；外部观测后端仍未配置 |
| 2026-08-27 | product-language-aligned | 用户入口和页面标题统一为“用量分析”与“项目用量分析”，页面说明明确 Token、模型、会话和运行情况；底层插件、存储和导出合同不改名 | 项目 View 聚焦测试、Client TypeScript 和官方完整 Build 通过；外部观测后端仍未配置 |

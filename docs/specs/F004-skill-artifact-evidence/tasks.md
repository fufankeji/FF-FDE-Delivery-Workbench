---
document: feature-tasks
feature: F004
status: planned
updated: "2026-08-31"
---

# F004 · Skill 路由、Artifact 与证据任务

## 任务规则

- 接入能力必须分层、按需加载，不批量注入全部 Skill。
- Artifact 结构状态、证据状态与人工批准分别保存。
- 只有完成证据存在后才勾选。

## 任务清单

- [ ] T001 定义分层 SkillRoute 与业务化工作元数据
  - 来源：REQ-026, REQ-029, NFR-014, AC-F004-001
  - 依赖：无
  - 修改：`packages/skill/skill` 路由合同和测试
  - 完成证据：能力可声明方法／工程层级、阶段、条件、输入、结果和业务名称
  - 验证：运行 skill 元数据测试

- [ ] T002 实现按项目和任务的 Skill 选择
  - 来源：REQ-007, REQ-026, NFR-014, AC-F004-001
  - 依赖：T001
  - 修改：`skill-filesystem`、`tool-skill` 路由与加载
  - 完成证据：只加载命中能力并记录理由，无命中时返回缺口
  - 验证：运行 Skill 路由矩阵测试

- [ ] T003 建立 Artifact Catalog 与双轴状态
  - 来源：REQ-028, NFR-011, NFR-012, AC-F004-002
  - 依赖：T001
  - 修改：`packages/fde/project` Artifact 模型、存储和测试
  - 完成证据：Artifact 保存项目、类型、版本、来源版本、结构状态和确认／推断／待验证状态
  - 验证：运行 Artifact Catalog 持久化测试

- [ ] T004 接入渐进 Schema Adapter 与版本依赖
  - 来源：REQ-028, NFR-011, AC-F004-002
  - 依赖：T003
  - 修改：`packages/fde/project` Schema Adapter、依赖边、Session 引用和预览入口
  - 完成证据：三类首批 Artifact 能在同一对象上从 starter 演进到 complete；后续工作固定引用输入版本
  - 验证：运行渐进校验、Artifact 组合与过期测试

- [ ] T005 聚合六项生产责任而不推断就绪
  - 来源：REQ-018, REQ-019, NFR-011, NFR-012, AC-F004-002
  - 依赖：T003, T004
  - 修改：`packages/fde/stage` 责任投影和测试
  - 完成证据：责任回指证据与批准，文档摄取只更新上下文可用性
  - 验证：运行责任状态负向与正向测试

- [ ] T006 在阶段工作台呈现推荐工作与 Artifact
  - 来源：REQ-007, REQ-018, REQ-019, REQ-026, REQ-028, REQ-029, NFR-011, NFR-012, NFR-014, AC-F004-001, AC-F004-002
  - 依赖：T002, T003, T004, T005
  - 修改：`ui-fde-stage`、`ui-fde-project` 和文档预览
  - 完成证据：用户看到业务化能力、选用原因、产物状态和责任证据
  - 验证：运行路由与 Artifact 组件测试

## Task 数量复核

- 任务总数：6
- 原因：覆盖分层路由、选择、Artifact Catalog、渐进校验与组合、责任投影和用户呈现。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-31 | planned | 规格与计划已确认 | 尚未开始代码开发 |

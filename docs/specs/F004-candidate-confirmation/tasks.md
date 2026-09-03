---
document: feature-tasks
feature: F004
status: in-progress
updated: "2026-08-27"
---

# F004 · 候选产物与人工确认任务

## 任务规则

- 一个 Task 交付一个可独立验证的结果，可以跨 Host、Client、文档和测试。
- 只有完成证据和验证结果真实存在后才勾选。

## 任务清单

- [x] T001 冻结需求调研三份标准产物与候选语义
  - 来源：REQ-003, REQ-009, REQ-010, REQ-011, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F004-001, AC-F004-002, AC-F004-003
  - 依赖：无
  - 修改：F004 Feature Spec、Product Spec、Feature Map 与 Architecture
  - 完成证据：固定路径、输入/输出边界和人工确认边界已写入 Spec
  - 验证：Feature Spec 校验器

- [x] T002 注册需求调研 Skill 与阶段提示
  - 来源：REQ-003, REQ-009, REQ-011, NFR-003, NFR-004, NFR-005, AC-F004-001, AC-F004-003
  - 依赖：T001
  - 修改：`packages/fde/stage` Skill、System Prompt 与聚焦测试
  - 完成证据：需求调研 Agent 可发现并按需加载 Skill，且没有推进阶段能力
  - 验证：`fde-stage` 聚焦测试

- [x] T003 读取并展示真实阶段产物
  - 来源：REQ-010, REQ-011, NFR-001, NFR-004, NFR-005, NFR-007, NFR-008, AC-F004-002, AC-F004-003
  - 依赖：T001
  - 修改：`packages/fde/project` 产物快照与 `packages/client/ui-fde-project` 项目详情
  - 完成证据：Host 返回三份固定文件的真实状态，项目详情按输入/输出分区展示
  - 验证：`fde-project` 与 `ui-fde-project` 聚焦测试

- [x] T004 完成当前切片窄范围验证
  - 来源：REQ-003, REQ-009, REQ-010, REQ-011, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F004-001, AC-F004-002, AC-F004-003
  - 依赖：T002, T003
  - 修改：相关 Host/Client 测试、类型检查与任务执行记录
  - 完成证据：聚焦测试和相关包 TypeScript 检查通过
  - 验证：一次聚焦测试命令＋一次相关包类型检查

## Task 数量复核

- 任务总数：4
- 仅覆盖需求调研，不展开后续阶段产物。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | in-progress | T001 已冻结三份固定产物、路径与候选语义 | T002～T004 待实现和验证 |
| 2026-08-27 | current-slice-complete | T002～T004 完成：需求调研 Skill 与阶段提示已注册；Host 返回三份固定产物的真实文件状态；项目详情已按阶段输入/阶段产出分区；相关 19 项聚焦测试和 3 个相关包 TypeScript 检查通过 | 等待用户用真实项目人工验收；全仓 Client 构建另被并行 F017 测试数据缺少 `value` 阻断，本切片 Web 构建和 3080 服务不受影响 |

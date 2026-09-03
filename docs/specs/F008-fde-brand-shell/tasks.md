---
document: feature-tasks
feature: F008
status: in-progress
updated: "2026-08-26"
---

# F008 · FDE 品牌壳任务

## 任务规则

- 一个 Task 交付一个可独立验证的结果，可以跨文档、组件、资产和测试。
- 只有完成证据和验证结果真实存在后才勾选。

## 任务清单

- [x] T001 冻结并校验 FDE 品牌产品合同
  - 来源：NFR-009, AC-F008-001, AC-F008-002, AC-F008-003
  - 依赖：无
  - 修改：`docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md`、`docs/specs/F008-fde-brand-shell/`、`docs/architecture/architecture.md`
  - 完成证据：F008 Spec/Plan/Tasks 与 NFR-009、AC-011、PSC-013 已落盘
  - 验证：PRD/Product Spec/Feature Spec 校验器通过

- [x] T002 替换全局 FF Logo 与 Sidebar 产品名
  - 来源：NFR-009, AC-F008-001
  - 依赖：T001
  - 修改：官方 Web 静态资源、`ui-brand-official` 注册/组件及相关测试
  - 完成证据：左上显示小圆角 FF Logo＋`FF-FDE工作台`，官方名称与提交短 SHA 不可见
  - 验证：聚焦品牌组件测试；可见效果由用户人工确认

- [x] T003 替换中央 Hero 品牌文案并移除 Preview
  - 来源：NFR-009, AC-F008-002
  - 依赖：T001
  - 修改：`ui-conversation` locale、Hero 条件渲染及相关测试
  - 完成证据：中央显示小圆角 FF Logo＋`见所未见，成所未成`，不增加副标题，旧标题和 Preview 不可见
  - 验证：聚焦 Hero 组件测试；可见效果由用户人工确认

- [x] T004 构建、重启并验证品牌壳与原有空白页行为
  - 来源：NFR-009, AC-F008-001, AC-F008-002, AC-F008-003
  - 依赖：T002, T003
  - 修改：官方构建产物、隔离运行服务、`docs/verification/`
  - 完成证据：Web 构建成功、3080 返回 200、验证记录落盘并等待用户人工验收
  - 验证：官方 build＋HTTP 可用性检查

## Task 数量复核

- 任务总数：4
- 原因：本 Feature 只有两个独立品牌表面和一次共同构建验收；继续拆分会把同一可见结果机械分成资产、组件和测试车道。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-26 | in-progress | T001 文档合同完成 | T002～T004 待执行 |
| 2026-08-26 | implementation-complete | T002～T004 已完成；聚焦测试 21/21 通过，官方构建成功，页面与 Logo 均返回 HTTP 200 | 按人工优先协作约束，不运行浏览器回放或截图；最终视觉效果待用户手动确认 |

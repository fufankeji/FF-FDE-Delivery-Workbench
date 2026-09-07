---
document: feature-tasks
feature: F001
status: in_progress
updated: "2026-09-07"
---
# F001 · 报修到本地草稿任务

## 任务规则

以真实可运行结果验证，完成后才勾选。

## 任务清单

- [x] T001 实现有来源的案例读取与分析
  - 来源：REQ-001, REQ-002, REQ-004, NFR-001, AC-F001-001
  - 依赖：无
  - 修改：backend/catalog.mjs、backend/workflow.mjs
  - 完成证据：案例字段白名单、P0与重复规则、真实图谱查询
  - 验证：定向Node测试
- [x] T002 实现人工确认后的持久化草稿
  - 来源：REQ-003, NFR-002, AC-F001-002
  - 依赖：T001
  - 修改：backend/server.mjs
  - 完成证据：API新增与读回、幂等、原件不变
  - 验证：定向HTTP集成测试
- [ ] T003 交付可操作的维修工作台
  - 来源：REQ-001, REQ-002, REQ-003, REQ-004, NFR-002, AC-F001-001, AC-F001-002
  - 依赖：T001, T002
  - 修改：frontend/index.html、frontend/app.js、frontend/style.css
  - 完成证据：页面接真实API，包含案例、关系、证据和草稿
  - 验证：模块语法检查与用户页面验收
- [x] T004 启动并整理后续测试交接
  - 来源：NFR-001, NFR-002, AC-F001-001, AC-F001-002
  - 依赖：T003
  - 修改：docs/verification/、docs/TESTING.md、README.md
  - 完成证据：启动地址、测试命令、原件哈希核对和能力边界
  - 验证：本地HTTP探针与原件哈希比较

## Task 数量复核

- 任务总数：4
- 原因：单一最小业务流程，四项分别交付分析、草稿、操作页面与交接；不扩大优化范围。

## 执行记录

2026-09-07：前后端实现已完成。T001、T002 的 6 项定向测试通过；T004 已启动 4177 并记录实际 HTTP 响应与 144 份原件保持不变的证据。T003 模块语法检查通过，视觉效果与页面操作仍待用户手动确认，因此保留未勾选。详见 `docs/verification/2026-09-07-local-repair.md`。

---
document: feature-tasks
feature: F015
status: in-progress
updated: "2026-08-27"
---

# F015 · 评估优化任务

## 任务规则

- 本轮开发与自动验证不得调用付费模型；只验证插件加载、无模型 fixtures、报告和页面状态。
- 评估只能由用户在页面明确确认后运行，不能因打开页面、项目切换或阶段变化自动触发。
- 每项结果有真实证据后才勾选；无真实 Trial 时明确保留“未运行模型评估”。

## 任务清单

- [x] T001 冻结评估优化产品与插件合同
  - 来源：REQ-020, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F015-001～004
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F015 三件套
  - 完成证据：项目/候选/用例/Trial/报告/Baseline、费用和阶段证据边界已落盘
  - 验证：PRD、Product Spec 与 F015 定向规格校验

- [x] T002 固定安装并验证 `dsh-eval-harness`
  - 来源：REQ-020, NFR-001, NFR-002, AC-F015-001, AC-F015-002
  - 依赖：T001
  - 修改：第三方依赖、Profile/Bundle、许可与当前 Harness 兼容 spike
  - 完成证据：固定提交可构建/加载，runner/gate/trace parser 可用，许可边界记录
  - 验证：插件既有测试＋当前环境无模型最小检查

- [x] T003 建立项目评估目录、路径守卫和报告索引
  - 来源：REQ-020, NFR-001, NFR-002, NFR-007, NFR-008, AC-F015-001, AC-F015-002
  - 依赖：T002
  - 修改：FDE Evaluation Host、`.fde/evaluations/` 合同、Workspace realpath 守卫
  - 完成证据：执行前守卫把 cases、runtime output、gate report 限制到当前项目，拒绝符号链接、模型指定 dsh_bin/Profile 和 Judge 校准；报告不可覆盖，临时 Session/工作副本不入 Git
  - 验证：Host 路径、持久化和跨项目聚焦测试

- [x] T004 包装显式运行、状态、比较和重启恢复
  - 来源：REQ-020, NFR-003, NFR-004, NFR-008, AC-F015-001, AC-F015-003, AC-F015-004
  - 依赖：T003
  - 修改：当前 Agent 显式运行确认、Session 运行状态、报告/Baseline schema、批准 API 和前端比较
  - 完成证据：二次确认后才向当前 Agent 提交 `eval_run`；页面不提供外部插件无法保证的假取消；报告重启后恢复；Baseline 只由用户从已索引报告批准并只读比较
  - 验证：无模型确认组件、报告解析、Baseline 路径与比较聚焦测试

- [x] T005 实现“评估优化”页面
  - 来源：REQ-020, NFR-005, NFR-007, NFR-008, AC-F015-001～004
  - 依赖：T003, T004
  - 修改：FDE Evaluation Client、Conversation View、用例/运行/报告/Baseline UI
  - 完成证据：评估优化仅从验证评估阶段开始可见；空、planned/running、PASS/WARN/FAIL、失败样本、指标和不可比较状态清晰；运行需确认
  - 验证：Client Slot、状态与组件聚焦测试

- [x] T006 组合、构建、重启并记录证据
  - 来源：REQ-020, NFR-001, NFR-005, NFR-007, NFR-008, AC-F015-001～004
  - 依赖：T004, T005
  - 修改：Web Bundle、聚合配置、README、Architecture、验证记录与运行服务
  - 完成证据：聚焦测试和官方构建通过，3080 可见评估优化 View，明确无模型评估未运行
  - 验证：聚焦测试＋完整构建＋HTTP/Boot 清单

## Task 数量复核

- 任务总数：6
- 原因：按合同、外部插件、项目持久化、运行编排、页面和组合交付六个独立结果拆分。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-26 | in-progress | 用户认可检索方案并授权连续开发；T001 文档合同完成 | T002～T006 连续实施；自动验证不调用付费模型 |
| 2026-08-26 | implementation-ready-for-manual-review | 固定 Git 提交完成 prepare 构建并通过 231 项无模型插件测试；当前项目 cases/report/baseline 索引、执行前路径/符号链接/可执行文件/Profile/Judge 守卫、二次费用确认、Agent `eval_run` 提交、运行提示、报告表、人工 Baseline 和同名用例比较已完成；完整构建与 3080 启动通过 | 未运行任何真实付费 Trial；候选源码版本与阶段证据关联仍由后续 F005 项目交付门消费，页面本身不推进阶段 |
| 2026-08-27 | in-progress | 根据用户真实页面验收，将评估入口的最小阶段纠正为验证评估；定向 View/Apply 5 项测试、Client 类型检查、Bundle 与 3080 HTTP 通过 | 等待用户刷新 3080 后人工确认；仍未运行任何真实付费 Trial |
| 2026-08-27 | product-language-aligned | 用户入口和页面标题统一为“评估优化”与“项目评估优化”；固定用例、报告、Baseline 和验证阶段合同保持不变 | 项目 View 聚焦测试、Client TypeScript 和官方完整 Build 通过；仍未运行任何真实付费 Trial |

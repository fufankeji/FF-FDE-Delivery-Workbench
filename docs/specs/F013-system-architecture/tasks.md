---
document: feature-tasks
feature: F013
status: in-progress
updated: "2026-08-27"
---

# F013 · 系统架构任务

## 任务规则

- 当前实现复用 `dsh-planchart` 的分组、节点和关系思路，不安装其 Session 计划与右侧 steps UI。
- 第一版只做 Agent 驱动、项目级、可确认和可导出的系统架构，不实现完整手动画布。
- 系统架构不能使用运行轨迹、Trace 或隐藏推理代替。

## 任务清单

- [x] T001 固定并审查 `dsh-planchart` 可复用图形能力
  - 来源：REQ-018, NFR-001, NFR-005, AC-F013-002, AC-F013-003, AC-F013-004
  - 依赖：无
  - 修改：第三方源码固定、schema/layout/export spike、许可与兼容记录
  - 完成证据：可复用代码、必须移除的 Session/steps 行为和当前 Harness 适配边界明确
  - 验证：公开插件测试＋当前 Harness 最小类型/渲染检查

- [x] T002 建立 Workspace 级架构版本和持久化
  - 来源：REQ-018, NFR-003, NFR-007, NFR-008, AC-F013-001, AC-F013-002
  - 依赖：T001
  - 修改：FDE Architecture Host schema、storage domain、版本和 revision
  - 完成证据：架构按 WorkspaceId 保存，同项目跨会话共享，跨项目隔离，旧 revision 不能覆盖新版本
  - 验证：Host 持久化、重放和并发聚焦测试

- [x] T003 实现 Agent 架构读取与候选发布
  - 来源：REQ-018, NFR-001, NFR-003, NFR-008, AC-F013-002
  - 依赖：T002
  - 修改：`architecture_get`、`architecture_set`、schema 校验和候选状态
  - 完成证据：Agent 能读取明确版本并原子发布完整候选；无效或超限图不覆盖旧版本
  - 验证：工具注册与 schema/失败聚焦测试

- [x] T004 实现项目交付内的“系统架构”页面
  - 来源：REQ-018, NFR-005, NFR-007, AC-F013-001, AC-F013-003
  - 依赖：T002
  - 修改：FDE Architecture Client、Conversation View、自动布局、缩放、主题和状态
  - 完成证据：同项目各会话显示同一图；页面不包含右侧 steps overlay、Trace 或 Agent 隐藏推理
  - 验证：Client Slot、membership 与图形组件聚焦测试

- [x] T005 接入确认语义与安全 SVG/PNG 导出
  - 来源：REQ-018, NFR-001, NFR-003, NFR-008, AC-F013-002, AC-F013-004
  - 依赖：T003, T004
  - 修改：候选/待确认/已确认/受影响状态、版本导出与安全检查
  - 完成证据：确认引用明确版本；导出与当前版本一致且不含脚本/外链；确认或导出不推进阶段
  - 验证：状态转换与导出安全聚焦测试

- [x] T006 组合、构建、重启并交付人工验收
  - 来源：REQ-018, NFR-001, NFR-003, NFR-005, NFR-007, NFR-008, AC-F013-001～AC-F013-004
  - 依赖：T003, T004, T005
  - 修改：Web Bundle、聚合配置、第三方说明、Architecture 和验证记录
  - 完成证据：聚焦测试和官方构建通过，3080 加载系统架构 View，等待用户检查真实架构效果
  - 验证：聚焦测试＋官方构建＋HTTP/Boot 清单；不执行浏览器截图自动化

- [x] T007 为方案设计人工门提供确认状态
  - 来源：REQ-018, REQ-023, NFR-001, NFR-003, NFR-005, NFR-007, NFR-008, AC-F013-004
  - 依赖：T005
  - 修改：F013/F018/F005 合同联调与聚焦测试
  - 完成证据：项目进度和 Host 门读取同一项目当前架构 revision/status；候选不满足门槛，确认本身不推进阶段
  - 验证：架构快照＋方案阶段路由测试

## Task 数量复核

- 任务总数：7
- 原因：在既有架构能力之外增加一个与方案设计人工门联调的独立结果；架构仍不拥有阶段推进权。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-26 | planned | 用户确认系统架构按 `dsh-planchart` 项目级适配方案，并要求当前只写文档；Spec、Plan、Tasks 已建立 | 尚未安装第三方插件或修改代码；等待后续统一开发指令 |
| 2026-08-26 | implementation-ready-for-manual-review | Workspace 级 `.fde/architecture.json`、有界校验、精确 revision、带锁原子候选替换、`architecture_get/set`、确认路由、确定性分组图、缩放和 SVG/PNG 导出已完成；版本冲突测试、完整构建和 3080 快照通过；数据分析项目已有 R1 候选 | 第一版不提供自由拖拽画布；架构视觉、导出文件和人工确认动作等待用户检查 |
| 2026-08-27 | in-progress | 用户确认已确认系统架构作为方案设计阶段结构化产物；F018/F005 合同已冻结 | T007 待与方案设计产物和人工门联调 |
| 2026-08-27 | implementation-ready-for-manual-review | T007 完成：项目快照和方案阶段 Host 门读取同一 `.fde/architecture.json` 当前 revision/status；candidate 明确不满足门槛，confirmed 才可配合四份方案文档进入 FDE 二次确认，架构确认本身不推进阶段 | 当前数据分析项目 R1 仍为 candidate，等待用户在系统架构页面审阅确认 |

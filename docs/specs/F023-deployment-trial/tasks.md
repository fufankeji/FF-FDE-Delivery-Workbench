---
document: feature-tasks
feature: F023
status: in-progress
updated: "2026-08-27"
---

# F023 · 部署试运行与进入验收移交任务

## 任务规则

- 本轮已进入开发；任务只有在对应代码与最窄验证完成后才勾选。
- 每项结果必须绑定当前项目、部署版本、目标环境和真实证据。
- Agent、Skill、部署动作、文件存在和人工接受均不能独立推进阶段。

## 任务清单

- [x] T001 冻结部署试运行产品合同
  - 来源：REQ-001, REQ-003, REQ-004, REQ-012, REQ-027, NFR-001, NFR-002, NFR-004, NFR-005, NFR-007, NFR-008, AC-F023-001, AC-F023-002, AC-F023-003, AC-F023-004
  - 依赖：无
  - 修改：`docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md`、`docs/specs/F023-deployment-trial/`
  - 完成证据：四份固定产物、问题状态、真实证据边界和 FDE 人工门已落盘
  - 验证：Product PRD、Product Spec 与 F023 定向文档校验

- [x] T002 冻结环境中立的最小执行边界
  - 来源：REQ-004, REQ-027, NFR-002, NFR-004, NFR-008, AC-F023-001, AC-F023-002
  - 依赖：T001
  - 修改：F023 Plan、Architecture 与真实项目运行说明
  - 完成证据：`.fde/deployment-trial.json` 只记录当前项目的环境摘要、授权、版本、证据和问题；真实动作由项目说明与当次 FDE 授权驱动，平台不读取或保存凭据
  - 验证：F023 Plan 与 Architecture 边界审阅

- [x] T003 建立部署试运行快照和四份产物扫描
  - 来源：REQ-003, REQ-027, NFR-001, NFR-002, NFR-005, NFR-007, NFR-008, AC-F023-001
  - 依赖：T002
  - 修改：`packages/fde/project/`
  - 完成证据：Host 只投影当前项目版本、环境、证据、问题和四份文件，并列出真实缺口
  - 验证：FDE Project 聚焦测试

- [x] T004 接入部署试运行指引和问题处理
  - 来源：REQ-003, REQ-004, REQ-027, NFR-002, NFR-004, NFR-008, AC-F023-002
  - 依赖：T002, T003
  - 修改：`packages/fde/stage/`、`packages/fde/project/`
  - 完成证据：Agent 只生成候选材料；项目进度中的精确合同动作要求 FDE 填写理由后，只把该问题更新为 accepted，并保留原始证据和其他阻塞
  - 验证：Stage 提示、Host 问题状态与 FDE 行内接受操作测试

- [x] T005 在项目进度展示部署试运行全貌
  - 来源：REQ-003, REQ-012, REQ-027, NFR-005, NFR-007, NFR-008, AC-F023-003
  - 依赖：T003, T004
  - 修改：`packages/client/ui-fde-project/`
  - 完成证据：页面展示版本、环境、证据、问题、四份产物及空/错/阻塞状态
  - 验证：Project Progress 聚焦组件测试＋用户人工验收

- [x] T006 接入 FDE 人工进入验收移交
  - 来源：REQ-001, REQ-012, REQ-027, NFR-001, NFR-004, NFR-005, NFR-008, AC-F023-004
  - 依赖：T003～T005
  - 修改：`packages/fde/stage/`、`packages/client/ui-fde-project/`
  - 完成证据：Host 复核全部门槛和 expected revision；只有 FDE 二次确认时执行一次 `pilot → handoff`
  - 验证：Stage 路由/CAS 测试＋用户人工流程验收

- [ ] T007 同步说明并完成最窄验证
  - 来源：REQ-003, REQ-027, NFR-001, NFR-005, NFR-007, NFR-008, AC-F023-001, AC-F023-002, AC-F023-003, AC-F023-004
  - 依赖：T003～T006
  - 修改：相关 README、Agent Note、验证记录和任务状态
  - 完成证据：聚焦测试、相关类型检查、目标构建和用户人工验收结果真实记录
  - 验证：一次聚焦测试命令＋一次相关类型检查

- [x] T008 补齐目标环境与试运行结论的 FDE 人工入口
  - 来源：REQ-004, REQ-027, NFR-001, NFR-004, NFR-005, NFR-008, AC-F023-004, AC-F023-005
  - 依赖：T003～T006
  - 修改：`packages/fde/project/`、`packages/client/ui-fde-project/`、相关说明与测试
  - 完成证据：当证据、问题决定和四份产物已经齐备但授权/status 尚未确认时，页面提供独立二次确认；Host 绑定当前合同摘要原子写入授权与 ready，随后阶段提交按钮可用
  - 验证：一次 FDE Project/Project Progress 聚焦测试命令

## Task 数量复核

- 任务总数：8
- 产品合同和环境中立技术边界已冻结；T003～T006 与 T008 已实现并通过聚焦检查与目标构建，T007 等待用户人工验收。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | product-contract-confirmed | PRD v3.1、PSC-031、Feature Map 与 F023 三件套已落盘 | 用户明确要求本轮不开发；Plan/Tasks 保持 draft，先确认真实目标环境 |
| 2026-08-27 | implementation-started | 冻结 `.fde/deployment-trial.json`、项目内证据与凭据不落盘边界 | 开始 Host、Stage 和项目进度实现；真实目标环境仍由每个项目决定 |
| 2026-08-27 | implementation-ready-for-build | T003～T006 已完成：Host 投影环境/证据/问题和四份产物，Skill 约束候选材料，项目进度展示阻塞与预览，两步 FDE 门执行 `pilot → handoff` | 5 个聚焦测试文件 30 项和四个相关包类型检查通过；等待目标构建、服务重启和用户人工验收，未运行浏览器截图或完整 E2E |
| 2026-08-27 | implementation-ready-for-manual-review | 根目录正式构建通过；隔离 `DSH_HOME` 的 Web 服务已重启，`http://127.0.0.1:3080/` 返回 HTTP 200 | T007 只剩用户人工检查部署试运行页面、问题人工接受与 `pilot → handoff` 两步确认；未运行浏览器截图或完整 E2E |
| 2026-08-27 | fde-readiness-confirmation-ready | T008 已完成：项目进度页新增目标环境与试运行结论的独立两步确认；Host 以当前合同 SHA-256 摘要原子写入 `environment.authorized=true` 与 `status=ready`，随后才开放“完成部署试运行” | 4 个聚焦测试文件共 30 项、3 个相关包类型检查和根目录正式构建均通过；隔离 Web 服务重启后返回 HTTP 200，T007 仍等待用户人工点击验收 |

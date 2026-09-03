---
document: feature-tasks
feature: F007
status: in-progress
updated: "2026-08-27"
---

# F007 · 验收移交与项目完成任务

## 任务规则

- 本轮已进入开发；任务只有在对应代码与最窄验证完成后才勾选。
- 最终交付引用前阶段真实事实和外部制品，不复制出第二套结果。
- Agent、Skill、文件存在、客户口头反馈和前端状态均不能完成项目。

## 任务清单

- [x] T001 冻结验收移交产品合同
  - 来源：REQ-001, REQ-003, REQ-005, REQ-012, REQ-028, NFR-001, NFR-002, NFR-004, NFR-005, NFR-007, NFR-008, AC-F007-001, AC-F007-002, AC-F007-003, AC-F007-004
  - 依赖：无
  - 修改：`docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md`、`docs/specs/F007-delivery-handoff/`
  - 完成证据：四份固定产物、验收状态、移交边界和 FDE 项目完成门已落盘
  - 验证：Product PRD、Product Spec 与 F007 定向文档校验

- [x] T002 冻结项目专有交付和企业确认边界
  - 来源：REQ-005, REQ-028, NFR-002, NFR-004, NFR-008, AC-F007-001, AC-F007-002
  - 依赖：T001, F023
  - 修改：F007 Plan、Architecture 与真实项目交付说明
  - 完成证据：`.fde/acceptance-handover.json` 允许项目专有交付条目；V1 由 FDE 代录企业确认；外部制品只记录位置和可取得状态，平台不代管制品
  - 验证：F007 Plan 与 Architecture 边界审阅

- [x] T003 建立验收移交快照和四份产物扫描
  - 来源：REQ-003, REQ-005, REQ-028, NFR-001, NFR-002, NFR-005, NFR-007, NFR-008, AC-F007-001
  - 依赖：T002
  - 修改：`packages/fde/project/`
  - 完成证据：Host 只投影当前项目交付物、验收、运维、移交和四份文件，并列出真实缺口
  - 验证：FDE Project 聚焦测试

- [x] T004 接入验收结论和移交状态
  - 来源：REQ-003, REQ-005, REQ-028, NFR-001, NFR-004, NFR-008, AC-F007-002
  - 依赖：T002, T003
  - 修改：`packages/fde/project/`、`packages/fde/stage/`
  - 完成证据：通过/带条件通过/退回/终止及条件、责任、已知问题和移交缺口保持可追溯
  - 验证：Host 状态解析与 Stage 提示测试

- [x] T005 在项目进度展示最终交付全貌
  - 来源：REQ-003, REQ-012, REQ-028, NFR-005, NFR-007, NFR-008, AC-F007-003
  - 依赖：T003, T004
  - 修改：`packages/client/ui-fde-project/`
  - 完成证据：页面展示四份产物、交付物可取得状态、验收结论、条件项、已知问题和移交缺口
  - 验证：Project Progress 聚焦组件测试＋用户人工验收

- [x] T006 接入 FDE 人工完成项目
  - 来源：REQ-001, REQ-005, REQ-012, REQ-028, NFR-001, NFR-004, NFR-005, NFR-008, AC-F007-004
  - 依赖：T003～T005
  - 修改：`packages/fde/stage/`、`packages/client/ui-fde-project/`
  - 完成证据：Host 复核全部门槛和 expected revision；只有 FDE 二次确认时执行一次 `handoff → completed`
  - 验证：Stage 路由/CAS 测试＋用户人工流程验收

- [ ] T007 同步说明并完成最窄验证
  - 来源：REQ-003, REQ-005, REQ-028, NFR-001, NFR-005, NFR-007, NFR-008, AC-F007-001, AC-F007-002, AC-F007-003, AC-F007-004
  - 依赖：T003～T006
  - 修改：相关 README、Agent Note、验证记录和任务状态
  - 完成证据：聚焦测试、相关类型检查、目标构建和用户人工验收结果真实记录
  - 验证：一次聚焦测试命令＋一次相关类型检查

- [x] T008 补齐验收移交事实的 FDE 人工记录入口
  - 来源：REQ-003, REQ-005, REQ-028, NFR-001, NFR-004, NFR-005, NFR-008, AC-F007-002, AC-F007-003, AC-F007-004, AC-F007-005
  - 依赖：T003～T006
  - 修改：`packages/fde/project/`、`packages/fde/stage/`、`packages/client/ui-fde-project/`、相关说明与测试
  - 完成证据：验收证据支持有界多路径；Skill 以部署试运行结构化合同为当前事实；项目进度通过精确合同摘要分步骤记录验收、交付物、条件项和责任移交，并保持最终完成二次确认独立
  - 验证：一次 FDE Project/Stage/Project Progress 聚焦测试命令

## Task 数量复核

- 任务总数：8
- 产品合同和项目专有交付边界已冻结；T003～T006、T008 已实现并通过聚焦检查与目标构建，T007 等待用户人工验收。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | product-contract-confirmed | PRD v3.1、PSC-010/PSC-031、Feature Map 与 F007 三件套已落盘 | 用户明确要求本轮不开发；Plan/Tasks 保持 draft，先完成 F023 并确认真实交付方式 |
| 2026-08-27 | implementation-started | 冻结 `.fde/acceptance-handover.json`、FDE 代录企业确认和外部制品只引用边界 | 开始 Host、Stage 和项目进度实现；企业侧独立账号/签章保持非目标 |
| 2026-08-27 | implementation-ready-for-build | T003～T006 已完成：Host 投影验收/交付物/条件/责任移交和四份产物，Skill 约束候选材料，项目进度展示阻塞与预览，两步 FDE 门执行 `handoff → completed` | 5 个聚焦测试文件 30 项和四个相关包类型检查通过；等待目标构建、服务重启和用户人工验收，未运行浏览器截图或完整 E2E |
| 2026-08-27 | implementation-ready-for-manual-review | 根目录正式构建通过；隔离 `DSH_HOME` 的 Web 服务已重启，`http://127.0.0.1:3080/` 返回 HTTP 200 | T007 只剩用户人工检查最终验收移交页面与 `handoff → completed` 两步确认；未运行浏览器截图或完整 E2E |
| 2026-08-27 | handoff-decision-entry-started | 真实项目暴露验收证据数组与 Host 单路径合同不一致、旧部署 Markdown 覆盖当前结构化状态、页面缺少验收/移交事实记录动作 | 开始 T008；不替真实项目写入客户验收、交付物可取得或责任移交完成状态 |
| 2026-08-27 | handoff-decision-entry-ready-for-manual-review | Host 支持最多 40 份验收证据并以合同摘要原子记录人工决定；Skill 明确以部署试运行 JSON 为事实源并保留人工字段；项目进度提供四步验收/交付物/条件/移交表单，最终完成仍是独立二次确认 | 4 个聚焦测试文件 33 项、3 个相关包类型检查、双语配对和正式构建通过；3080 已重启，真实项目只读快照可正常解析并保留 7 项真实阻塞，等待用户手动记录事实和验收 UI |

---
document: feature-tasks
feature: F018
status: in-progress
updated: "2026-08-27"
---

# F018 · 方案设计标准产物任务

## 任务规则

- 每项只交付一个可验证结果。
- Agent 产物和人工阶段推进必须分开验证。
- 完成证据真实存在后才勾选。

## 任务清单

- [x] T001 冻结方案设计产物与人工门合同
  - 来源：REQ-002, REQ-003, REQ-011, REQ-012, REQ-016, REQ-018, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F018-001～AC-F018-003
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、F018 Spec/Plan/Tasks
  - 完成证据：四份固定文档、项目级已确认架构、可选证据和 FDE 人工门已写入规格
  - 验证：PRD、Product Spec 与 Feature Spec 校验器

- [x] T002 注册方案设计 Skill 与阶段提示
  - 来源：REQ-002, REQ-011, REQ-023, NFR-003, NFR-005, AC-F018-001
  - 依赖：T001
  - 修改：`packages/fde/stage`
  - 完成证据：`solution` 阶段提示要求按需加载 `fde-solution-design`，Skill 固定路径和架构工具边界可检验
  - 验证：FDE Stage 聚焦测试

- [x] T003 建立固定产物快照与安全预览
  - 来源：REQ-003, REQ-016, REQ-023, NFR-001, NFR-005, NFR-007, NFR-008, AC-F018-002
  - 依赖：T001
  - 修改：`packages/fde/project`
  - 完成证据：Host 只解析四个固定产物标识，项目快照包含真实状态和同源预览地址
  - 验证：FDE Project 聚焦测试

- [x] T004 实现方案设计到项目开发的 Host 人工门
  - 来源：REQ-012, REQ-018, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F018-003
  - 依赖：T003
  - 修改：`packages/fde/stage` 状态、路由和测试
  - 完成证据：四份文件、已确认架构、当前阶段和 revision 均有效时只推进一次，其他情况列出真实缺口
  - 验证：FDE Stage 路由与状态测试

- [x] T005 接入项目进度方案产物与二次确认
  - 来源：REQ-003, REQ-012, REQ-016, REQ-018, REQ-023, NFR-001, NFR-004, NFR-005, NFR-007, NFR-008, AC-F018-002, AC-F018-003
  - 依赖：T003, T004
  - 修改：`packages/client/ui-fde-project`
  - 完成证据：四份文档可见可预览，架构状态真实，满足前置条件后 FDE 可两步确认并刷新到项目开发
  - 验证：UI FDE Project controller/组件聚焦测试

- [x] T006 完成窄范围验证并恢复隔离服务
  - 来源：REQ-002, REQ-003, REQ-012, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F018-001～AC-F018-003
  - 依赖：T002～T005
  - 修改：相关测试、包构建、任务执行记录和隔离运行服务
  - 完成证据：聚焦测试与相关包构建通过，3080 使用项目 `.runtime/dsh-home` 并加载最新工件
  - 验证：一次聚焦测试命令＋一次相关包构建＋HTTP/隔离项目检查

- [x] T007 将项目 PRD 补为第五份固定方案产物
  - 来源：REQ-002, REQ-003, REQ-011, REQ-012, REQ-016, REQ-018, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F018-001～AC-F018-003
  - 依赖：T002～T006
  - 修改：PRD/Product Spec/F005/F011/F013/F018 合同、`packages/fde/project`、`packages/fde/stage`、`packages/client/ui-fde-project`、相关测试与 Agent Note
  - 完成证据：`project-prd.md` 进入 Skill、固定快照、只读预览、项目进度和 Host 人工门；项目 PRD 与 `solution-design.md` 的“做什么/怎么做”边界明确；用户可通过对话生成而系统不会预创建文件
  - 验证：规格校验＋FDE Project/Stage/UI 聚焦测试＋相关 Bundle＋3080 HTTP

## Task 数量复核

- 任务总数：7
- 前六项保留原四文档切片的真实执行记录；T007 独立承接用户后续确认的第五份项目 PRD，避免改写既有验证历史。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 剩余项 |
|---|---|---|---|
| 2026-08-27 | in-progress | T001 已冻结单一 Skill、四份固定文档、已确认系统架构、可选证据边界和 FDE 人工门 | T002～T006 待实现和验证 |
| 2026-08-27 | implementation-ready-for-manual-review | T002～T006 完成：方案设计 Skill 与阶段提示已注册；Host 快照和同源预览只接受四个固定产物；方案门同时校验四份文件、已确认架构、当前阶段和 revision；项目进度提供两步 FDE 确认；26 项聚焦测试、3 个相关包类型检查、Host/Client 构建和隔离 3080 服务通过 | 当前真实项目仍为 `solution` revision 2，方案产物 0/4、架构为 candidate；等待用户通过 Agent 生成候选产物、人工确认架构并手动验收阶段门 |
| 2026-08-27 | in-progress | 用户确认项目 PRD 应在方案设计阶段生成，并要求在其通过对话生成前补为第五份固定产物；产品合同已收敛“项目 PRD 定义做什么、方案设计定义怎么做” | T007 待实现和验证；不得预创建真实项目的 `project-prd.md` |
| 2026-08-27 | project-prd-deliverable-complete | T007 完成：第五个固定 ArtifactId、Skill、阶段提示、快照、只读预览、项目进度和人工门均已接入；项目 PRD 与方案设计职责分开；4 个测试文件 25 项测试、Host TypeScript build、Client Bundle、oxlint、双语配对和 3080 HTTP 通过 | 等待用户在现有项目对话中让 Agent 生成 `project-prd.md` 并手动预览；未预创建真实项目文件 |

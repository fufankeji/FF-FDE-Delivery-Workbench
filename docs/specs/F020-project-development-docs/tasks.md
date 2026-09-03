---
document: feature-tasks
feature: F020
status: in-progress
updated: "2026-08-27"
---

# F020 · 项目开发规范与研发进度任务

## 任务规则

- 每项只交付一个可验证结果，并映射至少一个 Feature 验收标准。
- 文档状态、任务勾选和运行证据必须来自当前项目真实文件，不推算未知日期或进度。
- 完成证据存在后才勾选；Agent 产出和 FDE 人工阶段推进分开验证。

## 任务清单

- [x] T001 冻结项目开发 docs、研发进度和人工门合同
  - 来源：REQ-002, REQ-003, REQ-004, REQ-011, REQ-012, REQ-015, REQ-016, REQ-024, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, NFR-010, AC-F020-001～AC-F020-003
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、F020 Spec/Plan/Tasks
  - 完成证据：标准 docs 树、真实研发进度、三份收口产物和 FDE 人工门均已写入产品合同；观测/评估继续归 F014/F015
  - 验证：PRD、Product Spec 与 Feature Spec 校验器

- [x] T002 注册项目开发 Skill 与阶段提示
  - 来源：REQ-002, REQ-004, REQ-011, NFR-003, NFR-005, AC-F020-001
  - 依赖：T001
  - 修改：`packages/fde/stage`
  - 完成证据：`development` 阶段提示要求按需加载 `fde-project-development`，Skill 固定标准 docs、证据和不推进阶段边界
  - 验证：FDE Stage 聚焦测试

- [x] T003 建立开发 docs 快照与安全预览
  - 来源：REQ-003, REQ-015, REQ-016, REQ-024, NFR-001, NFR-005, NFR-007, NFR-008, NFR-010, AC-F020-002
  - 依赖：T001
  - 修改：`packages/fde/project`
  - 完成证据：Host 有界扫描核心文档、合法 Feature、任务 checkbox 和三份收口产物，只为安全 realpath 生成同源预览地址
  - 验证：FDE Project 聚焦测试

- [x] T004 接入项目进度开发阶段视图
  - 来源：REQ-003, REQ-015, REQ-016, REQ-024, NFR-001, NFR-005, NFR-007, NFR-008, NFR-010, AC-F020-002
  - 依赖：T003
  - 修改：`packages/client/ui-fde-project`
  - 完成证据：项目进度展示核心文档、Feature、任务证据、声明日期/里程碑/阻塞和收口产物
  - 验证：项目进度组件与 view availability 聚焦测试

- [x] T005 实现项目开发到验证评估的 FDE 人工门
  - 来源：REQ-012, REQ-024, NFR-003, NFR-004, NFR-005, NFR-008, AC-F020-003
  - 依赖：T002, T003, T004
  - 修改：`packages/fde/stage`、`packages/client/ui-fde-project`
  - 完成证据：三份固定收口文件、当前阶段和 expected revision 均有效时，只有 FDE 二次确认可单步进入 validation
  - 验证：Host CAS/路由与 Client 二次确认聚焦测试

- [x] T006 逆向数据分析项目完整 docs
  - 来源：REQ-003, REQ-015, REQ-016, REQ-024, NFR-001, NFR-005, NFR-007, NFR-008, NFR-010, AC-F020-001, AC-F020-002
  - 依赖：T001, T003
  - 修改：`/Users/muyu/test/ai-analysis/docs/`
  - 完成证据：基于真实源码形成 PRD、架构、产品总规格、Feature Map、7 个 Feature 的 spec/plan/tasks、源码证据台账和三份研发收口产物；未知日期保持待确认
  - 验证：F020 真实扫描结果为核心文档 3/3、7 个 Feature、47/47 任务、收口产物 3/3、问题 0

- [x] T007 完成窄范围验证和文档同步
  - 来源：REQ-002, REQ-003, REQ-012, REQ-024, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, NFR-010, AC-F020-001～AC-F020-003
  - 依赖：T002～T006
  - 修改：相关 README、Agent Note、验证记录与本任务状态
  - 完成证据：双语 README 与 Agent Note 已同步；4 个聚焦测试文件共 27 项、Host/Client TypeScript build、相关 Bundle、四对翻译配对和 3080 HTTP 均通过；证据见 `docs/verification/2026-08-27-f020-project-development-docs.md`
  - 验证：一次聚焦测试命令、Host/Client TypeScript build、文档校验和翻译配对检查

## Task 数量复核

- 任务总数：7
- T001 冻结合同；T002～T005 实现开发 Skill、真实快照/UI 和人工门；T006 提供真实数据分析验证样本；T007 收口验证与文档。

## 执行记录

| 日期 | 状态 | 证据 | 剩余项 |
|---|---|---|---|
| 2026-08-27 | in-progress | T001 已冻结 Spec Kit 轻量适配、标准 docs、真实研发进度、三份收口产物与人工门 | T002～T007 |
| 2026-08-27 | implementation-ready-for-manual-review | T002～T007 已完成：项目开发 Skill、固定 docs 扫描与安全预览、研发进度页面、`development → validation` 人工门和数据分析项目完整 docs 均已落地；27 项聚焦测试、Host/Client TypeScript build、相关 Bundle、翻译配对和 3080 HTTP 通过 | F020 依赖 Feature 仍在进行中，且等待用户在 3080 工作台手工验证真实项目展示和阶段确认；未执行浏览器截图或端到端自动化 |
| 2026-08-27 | in-progress | 删除 F020 中错误的“开发阶段评估入口”职责；观测/评估页面重新归属 F014/F015，F020 只保留研发文档、进度和人工门 | 等待用户刷新 3080 后人工确认阶段入口顺序 |

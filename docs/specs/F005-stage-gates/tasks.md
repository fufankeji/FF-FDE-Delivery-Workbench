---
document: feature-tasks
feature: F005
status: in-progress
updated: "2026-08-27"
---

# F005 · 阶段交付门任务

## 任务规则

- 一个 Task 交付一个可独立验证的结果，阶段转换必须与人工入口一起验证。
- 只有完成证据和验证结果真实存在后才勾选。

## 任务清单

- [x] T001 冻结需求调研阶段门
  - 来源：REQ-001, REQ-011, REQ-012, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-001, AC-F005-002
  - 依赖：无
  - 修改：F005 Feature Spec、Product Spec、Feature Map 与 Architecture
  - 完成证据：前置产物、人工确认、revision 和单步推进合同已写入 Spec
  - 验证：Feature Spec 校验器

- [x] T002 实现 Host 单步人工推进
  - 来源：REQ-001, REQ-011, REQ-012, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-001, AC-F005-002
  - 依赖：T001
  - 修改：`packages/fde/stage` 状态、HTTP 路由与聚焦测试
  - 完成证据：Host 在真实文件、当前阶段和 revision 都有效时只推进一次
  - 验证：`fde-stage` 聚焦测试

- [x] T003 接入项目进度人工确认
  - 来源：REQ-011, REQ-012, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-001, AC-F005-002
  - 依赖：T002
  - 修改：`packages/client/ui-fde-project` 阶段输出、二次确认与刷新
  - 完成证据：阶段产出显示缺失项；齐备后出现二次确认并刷新到方案设计
  - 验证：`ui-fde-project` controller/组件聚焦测试

- [x] T004 完成当前切片窄范围验证
  - 来源：REQ-001, REQ-011, REQ-012, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-001, AC-F005-002
  - 依赖：T002, T003
  - 修改：相关 Host/Client 测试、类型检查与任务执行记录
  - 完成证据：聚焦测试和相关包类型检查通过
  - 验证：一次聚焦测试命令＋一次相关包类型检查

- [x] T005 冻结方案设计人工门
  - 来源：REQ-012, REQ-018, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-003
  - 依赖：无
  - 修改：F005 Feature Spec/Plan、Product Spec 与 Feature Map
  - 完成证据：四份固定文档、已确认架构、FDE 二次确认和 `solution → development` 单步合同已冻结
  - 验证：Feature Spec 校验器

- [x] T006 实现方案设计 Host 单步人工推进
  - 来源：REQ-012, REQ-018, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-003
  - 依赖：T005
  - 修改：`packages/fde/stage` 状态、HTTP 路由与聚焦测试
  - 完成证据：Host 在四份真实文档、已确认架构、当前阶段和 revision 都有效时只推进一次
  - 验证：`fde-stage` 聚焦测试

- [x] T007 接入方案设计二次确认并验证
  - 来源：REQ-012, REQ-018, REQ-023, NFR-001, NFR-004, NFR-005, NFR-008, AC-F005-003
  - 依赖：T006
  - 修改：`packages/client/ui-fde-project` 阶段控制器、组件测试与相关包构建
  - 完成证据：缺失/候选时不能提交，满足前置条件且 FDE 二次确认后刷新到项目开发
  - 验证：一次聚焦测试命令＋一次相关包构建

- [x] T008 将项目 PRD 纳入方案设计 Host 人工门
  - 来源：REQ-012, REQ-018, REQ-023, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-003
  - 依赖：F018 T007, T006～T007
  - 修改：F005 Spec/Plan、`packages/fde/stage` 门前置条件、UI 状态文案与聚焦测试
  - 完成证据：`project-prd.md` 缺失时 Host 明确阻止 `solution → development`；五份文档、已确认架构、当前阶段、revision 和 FDE 二次确认同时成立时仍只推进一次
  - 验证：Feature Spec 校验＋FDE Stage/UI 聚焦测试

- [x] T009 冻结验证评估人工门
  - 来源：REQ-003, REQ-004, REQ-012, REQ-020, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-004
  - 依赖：F006 T001
  - 修改：F005 Feature Spec/Plan、Product Spec、Feature Map 与 Architecture
  - 完成证据：验证合同、证据、三份固定产物、FDE 二次确认和 `validation → pilot` 单步合同已冻结
  - 验证：Feature Spec 校验器

- [x] T010 实现验证评估 Host 单步人工推进
  - 来源：REQ-012, REQ-020, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-004
  - 依赖：T009, F006 T003
  - 修改：`packages/fde/stage` 状态、HTTP 路由与聚焦测试
  - 完成证据：Host 只在验证合同、证据、三份产物、当前阶段和 revision 有效时推进一次
  - 验证：`fde-stage` 聚焦测试

- [x] T011 接入验证评估二次确认并验证
  - 来源：REQ-012, REQ-026, NFR-001, NFR-004, NFR-005, NFR-008, AC-F005-004
  - 依赖：T010, F006 T005
  - 修改：`packages/client/ui-fde-project` 项目进度、控制器与聚焦测试
  - 完成证据：页面展示真实缺口；满足前置条件且 FDE 二次确认后刷新到部署试运行
  - 验证：一次聚焦测试命令＋一次相关包类型检查

- [x] T012 将当前评估方案确认纳入验证阶段门
  - 来源：REQ-012, REQ-020, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-004
  - 依赖：T009～T011, F006 T008
  - 修改：F005 Spec/Plan、`packages/fde/stage` 与项目进度聚焦测试
  - 完成证据：未确认或因方案定义、来源文件内容变化而 stale 的方案阻止 `validation → pilot`；执行结果写回不使确认失效；确认摘要、证据、产物、阶段和 revision 全部有效时仍只推进一次
  - 验证：Stage 路由/CAS 聚焦测试

- [x] T013 将必需指标的 FDE 人工接受纳入验证阶段门
  - 来源：REQ-003, REQ-004, REQ-012, REQ-020, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F005-004
  - 依赖：T009～T012
  - 修改：F005 Spec/Plan、`packages/fde/project` 门前置条件、`packages/fde/stage` 与项目进度聚焦测试
  - 完成证据：未满足的必需指标默认阻塞；完整 FDE 人工接受只解除对应指标阻塞并保留原结果；过期或不完整决定不能推进 `validation → pilot`
  - 验证：Stage 路由/CAS、FDE Project 和 Project Progress 聚焦测试

- [x] T014 冻结单步人工返回合同
  - 来源：REQ-012, NFR-001, NFR-003, NFR-005, NFR-008, AC-F005-005
  - 依赖：T001～T013
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F005/F010/F011 规格
  - 完成证据：上一阶段、非空原因、revision、审计、产物保留、待重新确认和 completed 重开合同已落盘
  - 验证：PRD/Product Spec/Feature Spec 校验器

- [x] T015 实现 Host 返回状态与同源路由
  - 来源：REQ-012, NFR-001, NFR-003, NFR-008, AC-F005-005
  - 依赖：T014
  - 修改：`packages/fde/stage` schema、状态、HTTP、Bundle 注册和聚焦测试
  - 完成证据：Host 只按当前状态返回一步，增加 revision 并记录有界审计；需求调研、空原因、旧 revision 与任意目标均失败
  - 验证：`fde-stage` 聚焦测试

- [x] T016 接入项目进度返回交互和重新确认状态
  - 来源：REQ-012, NFR-005, NFR-008, AC-F005-005
  - 依赖：T015
  - 修改：`packages/client/ui-fde-project` controller、Slot、项目详情、样式与聚焦测试
  - 完成证据：返回原因和二次确认可用；completed 显示重新打开；最新返回和待重新确认范围清晰；成功后同项目状态刷新
  - 验证：Client controller/组件聚焦测试

- [x] T017 完成本轮聚焦验证并更新记录
  - 来源：REQ-012, NFR-005, AC-F005-005
  - 依赖：T015, T016
  - 修改：README/Agent Note/验证记录、相关包类型检查与 Bundle
  - 完成证据：聚焦测试、类型检查、文档校验和官方构建通过，3080 重启可访问
  - 验证：一次聚焦测试＋一次相关类型检查＋一次构建＋HTTP 200

## Task 数量复核

- 任务总数：17
- T014～T017 独立覆盖返回合同、Host 原子状态、项目进度交互与交付验证；不改变六个既有向前门的业务前置条件。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | in-progress | T001 已冻结固定前置条件、FDE 二次确认与单步 revision 合同 | T002～T004 待实现和验证 |
| 2026-08-27 | current-slice-complete | T002～T004 完成：Host 校验三份真实文件、当前阶段和 revision 后只执行 `requirements → solution`；项目进度提供两步 FDE 确认并在成功后刷新阶段；相关 19 项聚焦测试和 3 个相关包 TypeScript 检查通过 | 等待用户人工走通阶段门；Agent 未获得推进能力，后续五个阶段门仍不在本切片 |
| 2026-08-27 | in-progress | T005 已冻结方案设计四份文档、已确认架构与人工单步门 | T006～T007 待实现和验证；Agent 仍无推进能力 |
| 2026-08-27 | current-slice-complete | T006～T007 完成：Host 只在四份真实方案文档、当前已确认架构、`solution` 阶段和精确 revision 同时成立时执行 `solution → development`；项目进度在提交前要求 FDE 二次确认，并在成功后刷新同项目阶段 | 等待用户生成真实方案产物、确认架构并人工走通；项目开发之后的阶段门仍未定义，Agent 仍无阶段推进能力 |
| 2026-08-27 | in-progress | 用户确认项目 PRD 属于方案设计阶段，当前门合同扩展为五份固定文档加已确认架构 | T008 待实现和验证；既有四文档切片的执行记录保留 |
| 2026-08-27 | project-prd-gate-complete | T008 完成：Host 快照驱动的方案门新增项目 PRD；缺失时稳定返回 `stage-solution-incomplete` 和“项目 PRD”缺口，全部前置条件成立时仍只允许 FDE 单步进入项目开发 | 等待用户生成项目 PRD 后手动验收二次确认；后续阶段门仍未定义 |
| 2026-08-27 | in-progress | T009 已开始：用户确认验证评估的候选版本、输入/指标/环境、真实证据、三份固定产物和 FDE 人工门 | T010～T011 待实现与聚焦验证；部署试运行之后的阶段门未定义 |
| 2026-08-27 | current-slice-complete | T014～T017 完成：Host 支持带非空原因、revision 冲突保护和有界审计的单步人工返回；项目进度提供二次确认、completed 重新打开、待重新确认范围和最近返回记录；全部既有项目产物保持原位 | 8 个聚焦测试文件共 47 项通过，Host/Client TypeScript、官方完整 Build、定向双语配对和 Feature 文档校验通过；3080 已用隔离 DSH_HOME 重启并返回 HTTP 200，等待用户手动验收 |
| 2026-08-27 | validation-gate-complete | T009～T011 完成：验证合同与项目内证据、三份固定产物、当前阶段和精确 revision 同时有效时，Host 才允许 FDE 二次确认并只执行一次 `validation → pilot`；页面持续显示未执行、失败和证据缺口 | 等待用户以真实验证结果手动验收；部署试运行之后的阶段门仍未定义，Agent 未获得阶段推进能力 |
| 2026-08-27 | in-progress | 用户确认开始验证前必须先生成并由 FDE 确认带前阶段来源的评估方案 | T012 待实现；既有验证证据/产物/revision 门保持不变 |
| 2026-08-27 | validation-plan-gate-complete | T012 完成：Host 要求当前方案定义摘要已由 FDE 确认；方案定义或来源文件内容变化后旧确认失效，执行结果写回不使确认失效；既有证据、产物、阶段和 revision 门保持不变。相关 73 项测试、3 个包 TypeScript 检查和完整 Build 通过 | 等待用户以真实验证结果手动走通 `validation → pilot`；部署试运行之后的阶段门仍未定义 |
| 2026-08-27 | in-progress | 用户真实关闭问题后仍被两个 NOT_RUN 必需指标阻塞，确认阶段门缺少带理由的指标人工接受 | T013：接入精确合同决定并验证只解除单项阻塞 |
| 2026-08-27 | validation-metric-acceptance-complete | T013 完成：验证阶段门把“合格可读取证据”或“完整 FDE 人工接受”视为单个必需指标已决策；人工接受不改变真实指标状态，也不影响其他阻塞。Host 原子更新、Client 路由与项目进度交互聚焦测试通过，完整 Build 和 3080 HTTP 可访问 | 等待用户在真实项目手动验收两个指标后，再由 FDE 二次确认进入部署试运行 |

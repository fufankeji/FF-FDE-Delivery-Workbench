---
document: feature-tasks
feature: F006
status: in-progress
updated: "2026-08-27"
---

# F006 · 验证评估与进入部署试运行任务

## 任务规则

- 每项交付一个可独立验证的结果，并映射至少一个 Feature 验收标准。
- PASS/WARN/FAIL、证据和任务勾选必须来自当前项目真实文件与运行，不根据 Agent 自述补造。
- 完成证据存在后才勾选；Agent 产出和 FDE 人工推进分开验证。

## 任务清单

- [x] T001 冻结验证评估合同和人工门
  - 来源：REQ-001, REQ-003, REQ-004, REQ-012, REQ-020, REQ-026, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F006-001～AC-F006-003
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、F005 与 F006 Spec/Plan/Tasks
  - 完成证据：候选版本、项目适用输入、指标/阈值、真实证据、三份固定产物和 FDE 人工门已写入合同
  - 验证：PRD、Product Spec 与 Feature Spec 校验器

- [x] T002 建立验证合同和产物快照
  - 来源：REQ-003, REQ-026, NFR-001, NFR-002, NFR-005, NFR-007, NFR-008, AC-F006-001, AC-F006-002
  - 依赖：T001
  - 修改：`packages/fde/project`
  - 完成证据：Host 有界解析固定 JSON、项目内证据与三份产物，输出稳定缺口和 gateReady
  - 验证：FDE Project 聚焦测试

- [x] T003 注册验证 Skill 与阶段提示
  - 来源：REQ-002, REQ-004, REQ-026, NFR-003, NFR-005, AC-F006-001
  - 依赖：T001
  - 修改：`packages/fde/stage`
  - 完成证据：validation 阶段提示要求按需加载 `fde-validation`，Skill 明确不编造输入/阈值、不自动运行和不推进阶段
  - 验证：FDE Stage Skill/Prompt 聚焦测试

- [x] T004 扩展评估页验证准备和证据展示
  - 来源：REQ-020, REQ-026, NFR-001, NFR-005, NFR-007, NFR-008, AC-F006-002
  - 依赖：T002
  - 修改：`packages/client/ui-fde-project`
  - 完成证据：既有 Trial 区保留，页面新增候选版本、环境、输入、指标、证据、问题与未覆盖项
  - 验证：EvaluationView 聚焦组件测试

- [x] T005 接入项目进度产物和 FDE 人工门
  - 来源：REQ-012, REQ-016, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F006-003
  - 依赖：T002, T003, T004
  - 修改：`packages/fde/stage`、`packages/client/ui-fde-project`
  - 完成证据：项目进度展示三份固定产物与真实缺口；完整门槛且 FDE 二次确认时只执行一次 `validation → pilot`
  - 验证：Stage 路由/CAS 与 Project Progress 组件测试

- [x] T006 增加数据分析项目验证准备样本
  - 来源：REQ-003, REQ-020, REQ-026, NFR-001, NFR-005, NFR-007, NFR-008, AC-F006-001, AC-F006-002
  - 依赖：T002
  - 修改：`/Users/muyu/test/ai-analysis/.fde/evaluations/` 与 `fde-deliverables/04-validation/validation-plan.md`
  - 完成证据：合同引用现有验收方案和研发基线；真实已有证据可标记，尚未执行项保持 NOT_RUN，不生成假通过报告/基线
  - 验证：F006 Host 对真实样本的扫描结果

- [x] T007 完成窄范围验证和文档同步
  - 来源：REQ-003, REQ-012, REQ-020, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, AC-F006-001～AC-F006-003
  - 依赖：T002～T006
  - 修改：相关 README、Agent Note、验证记录与本任务状态
  - 完成证据：聚焦测试、相关包类型检查和目标 Bundle 通过；不执行浏览器截图或完整 E2E
  - 验证：一次聚焦测试命令＋一次相关包类型检查

- [x] T008 增加带来源的评估方案与 FDE 摘要确认
  - 来源：REQ-003, REQ-004, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F006-001～AC-F006-003
  - 依赖：T002, T003
  - 修改：`packages/fde/project`、`packages/fde/stage` 与数据分析验证合同
  - 完成证据：每项指标具有项目内前阶段来源和编号；Host 只确认当前方案定义摘要，候选、环境、数据、指标定义或来源文件内容变化后确认失效，执行结果写回不使确认失效；Skill 区分生成方案与开始验证
  - 验证：FDE Project/Stage 聚焦测试

- [x] T009 接入评估三步入口与固定用例回归命名
  - 来源：REQ-020, REQ-026, NFR-003, NFR-005, NFR-008, AC-F006-002
  - 依赖：T008
  - 修改：`packages/client/ui-fde-project`
  - 完成证据：评估页显示生成方案、确认方案、开始验证和指标来源；开始验证只在确认有效时可用并切回当前对话；旧 Runner 逐字显示“运行固定用例”
  - 验证：EvaluationView 与 Client controller 聚焦测试

- [x] T010 将方案确认纳入部署试运行人工门
  - 来源：REQ-012, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F006-003
  - 依赖：T008, T009
  - 修改：`packages/fde/stage`、项目进度与 F005 合同
  - 完成证据：未确认或 stale 方案始终阻止 `validation → pilot`，其他既有证据/产物/revision 条件不回归
  - 验证：Stage 路由与 Project Progress 聚焦测试

- [x] T011 同步说明并完成最窄验证
  - 来源：REQ-003, REQ-012, REQ-020, REQ-026, NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, AC-F006-001～AC-F006-003
  - 依赖：T008～T010
  - 修改：相关 README、Agent Note、验证记录与本任务状态
  - 完成证据：聚焦测试、相关包类型检查、目标 Bundle 和双语配对通过；服务保持可访问，不执行浏览器截图或完整 E2E
  - 验证：一次聚焦测试命令＋一次相关包类型检查

- [x] T012 重构评估页的信息层级与真实数据可视化
  - 来源：REQ-003, REQ-016, REQ-020, REQ-026, NFR-001, NFR-005, NFR-007, NFR-008, AC-F006-002
  - 依赖：T008～T011
  - 修改：`packages/client/ui-fde-project` 的 EvaluationView、主题样式与组件测试
  - 完成证据：首屏突出当前三步动作、必需指标完成率、结果分布、证据覆盖、阶段产物、阻塞和运行上下文；指标可按结果/类别筛选且保留完整来源、阈值、方法和证据；全部数字直接派生自验证快照
  - 验证：EvaluationView 聚焦测试、Client TypeScript、定向 lint、完整 Build 与 3080 HTTP 可访问

- [x] T013 修复验证结果字段生成与单指标无效时的页面降级
  - 来源：REQ-003, REQ-020, REQ-026, NFR-001, NFR-005, NFR-007, NFR-008, AC-F006-001, AC-F006-002
  - 依赖：T008～T012
  - 修改：`fde-validation` Skill、`packages/fde/project`、双语说明与数据分析项目现有验证合同
  - 完成证据：Skill 固定单字符串 `evidence` 与 camelCase `waiverReason`；数据分析项目恢复 10 项真实结果；单个指标格式错误时 Host 保留顶层信息、其他有效指标和三份独立产物，同时保持合同无效和阶段阻塞
  - 验证：FDE Stage Skill 文本测试、FDE Project 部分投影测试、数据分析项目真实快照、相关 TypeScript、完整 Build 与 3080 HTTP 可访问

- [x] T014 修复验证信息溢出并接入 FDE 问题人工关闭
  - 来源：REQ-003, REQ-012, REQ-016, REQ-026, NFR-001, NFR-004, NFR-005, NFR-007, NFR-008, AC-F006-002～AC-F006-004
  - 依赖：T008～T013
  - 修改：`packages/fde/project` 的问题人工接受路由与原子合同更新；`packages/client/ui-fde-project` 的项目进度内联确认、快照刷新和长文本响应式样式；相关双语说明与实现记录
  - 完成证据：长哈希、路径、问题说明与接受理由不再撑破容器；FDE 可对 open 问题填写理由并确认，Host 保留原问题、写入 waived/waiverReason/waivedAt 并返回新快照；该问题不再阻塞，但任何指标结果与其他阻塞保持原样
  - 验证：FDE Project Host 聚焦测试、Project Progress 组件交互测试、相关 TypeScript、定向 lint、完整 Build 与 3080 HTTP 可访问

- [x] T015 补齐必需指标的 FDE 人工接受
  - 来源：REQ-003, REQ-004, REQ-012, REQ-020, REQ-026, NFR-001, NFR-004, NFR-005, NFR-007, NFR-008, AC-F006-003, AC-F006-005
  - 依赖：T008～T014
  - 修改：`packages/fde/project` 的指标人工接受原子写入与阶段门判定；`packages/client/ui-fde-project` 的项目进度指标内联确认、快照刷新与状态展示；相关说明和聚焦测试
  - 完成证据：FDE 可对未满足的必需指标填写理由并确认；Host 保留原 NOT_RUN/FAIL、证据和说明，写入人工接受理由与时间，只解除该指标阻塞；过期摘要、非必需/已正常满足指标和空理由均拒绝
  - 验证：FDE Project Host、Project Progress 和 Stage 聚焦测试＋相关 TypeScript＋目标 Build

## Task 数量复核

- 任务总数：15
- T001～T007 保留首版实现证据；T008～T011 修复人工验收发现的指标来源、方案确认和运行入口可理解性；T012 重构高密度验证数据的页面层级；T013 修复真实运行暴露的结果字段生成错误和单指标失败导致整页全零的问题；T014 补齐既有 waived 问题的 FDE 人工入口；T015 补齐必需指标的人工接受，使真实结果保持不变但能够形成明确 FDE 决策。

## 执行记录

| 日期 | 状态 | 证据 | 剩余项 |
|---|---|---|---|
| 2026-08-27 | in-progress | T001 已冻结验证合同、三份产物、真实证据和 FDE 人工门 | T002～T007 |
| 2026-08-27 | current-slice-complete | T002～T007 完成：Host 有界解析验证合同与项目内证据；`fde-validation` Skill、评估页、项目进度和 `validation → pilot` 人工门已接通；数据分析样本保留 8 项 `NOT_RUN` 与 11 个真实阻塞；39 项聚焦测试、3 个相关包 TypeScript 检查、目标 Bundle、双语配对及 PRD/Product Spec/F005/F006 定向校验通过 | 等待 FDE 在真实项目中执行验证、补齐报告与基线并人工走通；Agent 未获得阶段推进能力，不执行浏览器截图或完整 E2E |
| 2026-08-27 | in-progress | 用户人工验收发现首版未说明指标来源，也无法判断应通过对话、评估按钮还是上传触发；已确认采用“生成方案 → FDE 确认 → 开始验证”，固定用例回归保持独立 | T008～T011 |
| 2026-08-27 | current-slice-complete | T008～T011 完成：Host 为 8 项样例指标解析 3 份真实前阶段来源并绑定方案定义摘要；评估页接通生成方案、FDE 确认和开始验证，固定用例回归保持独立；确认纳入 `validation → pilot` 人工门。19 个相关测试文件共 73 项测试、3 个相关包 TypeScript 检查、定向 lint、完整 Build、双语配对及 PRD/Product Spec/F005/F006 校验通过；3080 返回 HTTP 200 | 等待用户在数据分析项目中手动确认方案并开始真实验证；不执行浏览器截图或完整 E2E |
| 2026-08-27 | in-progress | 用户以真实页面指出三步大卡、环境长文本和指标表缺少信息层级，要求用更多真实数字、图表和进度展示丰富验证数据 | T012 |
| 2026-08-27 | current-slice-complete | T012 完成：评估页首屏新增由验证快照直接派生的必需指标完成度、已执行数、证据与产物覆盖、阻塞，以及五步推进、结果分布、类别覆盖、运行上下文和结果／类别筛选；保留完整指标来源、阈值、方法、证据、三步人工流程和固定用例回归。EvaluationView 聚焦测试、Client TypeScript、定向 lint、完整 Build、双语配对与 F006 校验通过；3080 返回 HTTP 200 | 等待用户手动刷新并验收视觉效果；不执行浏览器截图或完整 E2E |
| 2026-08-27 | in-progress | 首次真实运行已生成 10 项结果和 3/3 阶段产物，但 Agent 把 `result.evidence` 写成数组、把 WARN 理由写成 `accept_reason`；Host 因单指标字段错误返回空合同，页面错误显示 0 项指标 | T013 |
| 2026-08-27 | current-slice-complete | T013 完成：数据分析项目现有合同已改为单字符串 `evidence` 与 `waiverReason`，真实投影恢复候选版本、1 组数据、10 项指标（5 PASS、2 WARN、3 NOT_RUN）及 3/3 阶段产物；Skill 固定精确结果模板；Host 在单指标格式错误时保留其余有效事实，同时整份合同保持无效、无摘要且不能确认或推进。FDE Project／Stage 共 27 项聚焦测试、两包 TypeScript、定向 lint、完整 Build、双语配对和真实快照通过；3080 返回 HTTP 200 | 当前仍有 4 个真实业务阻塞，需 FDE 后续执行或处理；不重新运行评估，不执行浏览器截图或完整 E2E |
| 2026-08-27 | in-progress | 用户人工验收发现问题卡片与数据集长元信息会横向溢出，并明确要求 FDE 可以手动关闭单个阻塞问题；现有合同已经支持 waived，但缺少可信 UI 与 Host 写入入口 | T014：实现带理由的人工接受、精确冲突检查、快照刷新和响应式断行；不把指标真实结果改成通过 |
| 2026-08-27 | current-slice-complete | T014 完成：项目进度中的数据集哈希、路径、问题说明和接受理由可在容器内断行；open 问题提供带明确影响说明和理由必填的 FDE 行内确认。Host 在合同文件锁内核对当前方案摘要和问题状态，保留原问题并写入 waived、waiverReason、waivedAt，刷新快照且不修改任何指标结果或其他阻塞。FDE Project／Stage／Client 共 41 项聚焦测试、三包 TypeScript、定向 lint、完整 Build、四组双语配对和 F006 校验通过；3080 返回 HTTP 200 | 等待用户手动刷新并验证真实问题关闭体验；不执行浏览器截图或完整 E2E |
| 2026-08-27 | in-progress | 用户在真实项目关闭 3 个问题后，“完成验证评估”仍因两个必需指标 NOT_RUN 保持不可用；确认现有 Host 只有问题人工接受，缺少指标人工接受 | T015：新增带理由和时间的单指标人工接受；保留真实结果并只解除该项阻塞 |
| 2026-08-27 | current-slice-complete | T015 完成：项目进度为尚未满足的必需指标提供理由必填的“人工接受指标”；Host 在合同锁内复核当前方案摘要、指标必需性和当前结果，原子写入 `manualAcceptance.reason/acceptedAt`，保留 NOT_RUN／FAIL、证据、数值和说明，只解除目标指标阻塞。过期摘要、可选指标、正常满足指标、重复决定和空理由均拒绝。FDE Project／Stage／Client 共 45 项聚焦测试、两包 TypeScript、完整 Build、四组双语配对和 PRD／Product Spec／F005／F006 校验通过；3080 返回 HTTP 200 | 等待用户在真实数据分析项目逐项填写接受理由并验证“完成验证评估”恢复可用；不修改真实项目合同，不执行浏览器截图或完整 E2E |

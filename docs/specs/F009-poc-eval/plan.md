---
document: feature-plan
feature: F009
status: ready
updated: "2026-09-07"
---

# F009 · 阶段 5：PoC 与 Eval 实施计划

## 现有上下文与复用

- 当前实现与入口：已有评估页、validation.json、项目终端、浏览器和报告展示可作为迁移基础。
- 直接复用点：F008 候选方案与验证计划，F003 operation，F004 Artifact／证据关系。
- 必须保持的现有行为：已有评估资料和手动指标可读取；V1 项目不强制迁移到新门禁。
- 必须保持的 Product Spec 合同：PSC-003, PSC-005, PSC-006, PSC-018, PSC-021, PSC-022, PSC-023。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/fde/evaluation` | 当前评估数据与执行 | 引入候选版本、运行轮次、案例、结果和证据模型 | AC-F009-001, AC-F009-002 |
| `packages/fde/project` | 阶段 Artifact | 适配 Evaluation Case／Report、执行清单与 UAT | AC-F009-002 |
| `packages/skill/*` | 评估能力路由 | 按机制选择方法与工程验证能力 | AC-F009-001 |
| `packages/host` | 项目工具执行 | 运行并持久化每项真实验证 | AC-F009-001 |
| `packages/client/ui-fde-evaluation` | 评估页面 | 呈现方案确认、运行、结果分布、证据和决定 | AC-F009-001, AC-F009-002 |

## 实现方案

以 EvaluationRun 关联固定 CandidateSnapshot、EvaluationCase 和 ResultEvidence。生成方案与运行验证是两个显式动作；每项执行独立持久化。第五阶段使用专属工作台，首页展示受测范围／版本、运行情况、指标证据、待解决问题和阶段验收，不设开发区；状态读取同一项目事实。非 AI 项目的验证由 DSH 调用项目自身测试命令，不另建执行引擎。

### 2026-09-07 本轮承接适配

- `packages/fde/project/src/evaluation-workbench.ts` 解析 `.fde/stages/evaluation.json` 中新增的 `evaluation` 对象；`v2-stage-surface.ts` 继续负责固定产物、状态读取和统一阶段门。原有 `plan/cases/run/conclusion` 工作项 ID 与三个固定产物路径保留，不静默迁移 V1 数据。
- `evaluation.candidate` 包含 `summary`（本轮受测范围）、`version` 和 `sourceFiles`（本轮代码、配置与数据依赖的相对文件清单）；不采集开发任务、不推算开发进度。
- `evaluation.testing` 包含 `environment`、`metrics`（`id/title/kind/required/criterion/sourceRefs`）和可选 `run`。`run` 包含 `fingerprint` 与 `results`（`metricId/status/value/evidenceRefs`）；结果状态为 `NOT_RUN/RUNNING/PASS/WARN/FAIL`，运行前缺省保持未运行。
- Host 对候选文件的真实字节、版本、环境和指标定义生成 SHA-256 指纹；`project_evaluation_get` 只读工具返回当前投影和指纹，DSH 执行真实检查后记录对应结果。版本不匹配显示 `STALE`；路径越界、文件不可读、必测项缺证据／非 PASS 阻止阶段门。指纹只覆盖显式清单，DSH 必须列全本轮实现、配置和数据依赖，工作台不扫描整个客户目录。
- 工作台复用 `ProjectRuntimeHeaderInjected` 的四个运行回调与既有快照，保留运行期轮询。进入架构／评估页通过既有视图导航；准备方案／执行指标只调用 `prepareStageDraft`，不会自动发送消息。
- `EvaluationStagePanel` 接收现有 StageWorkbench 共享 props，提供受测版本、运行情况、测试表、证据预览、问题与验收、按需展开的项目记录；CSS 使用容器宽度适配和内部表格横向滚动。
- 参考用户 `阶段 5.png`，采用阶段横幅、等宽双栏、验证结果和登记／验收材料分组。保留原有输入框和高度预留；补充记录和验证按钮调用原有 `prepareStageDraft`，切换到 Agent 对话、保留已有草稿，不自动发送。其他阶段、对话输入与历史只读合同不变。
- 版本、环境、指标、运行状态、产物与阻塞数仍来自同一投影；详细阻塞条件保留在可展开区域，不按参考图硬编码缺失记录或待核对数量。长表、记录展开和返回表单使用自然高度，不将操作裁切在固定面板内。
- 本轮不实现新的自动评估引擎、客户项目、指标豁免或生产权限；既有 Agent Trial 页面继续可用并明确其作用范围。F009 其他尚未完成的广义执行器／UAT 任务继续保持未完成。

## 实施顺序

1. 固定阶段 5 方法、模板、Schema 和工程 Skills。
2. 定义候选版本、验证方案、运行轮次、结果和 UAT Artifact。
3. 实现按机制路由、方案确认和逐项执行。
4. 重构评估页面为真实状态与证据投影。
5. 接入结论建议、FDE 决定、重跑和过期规则。
6. 用通过、失败、中断和缺正式阈值场景验证。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 自动生成指标脱离客户目标 | 验证无业务意义 | 必须回指结果合同并由 FDE 确认 | 方案测试 |
| 任务清单被误作执行结果 | 虚假完成 | 只从 ResultEvidence 聚合 | 运行状态测试 |
| 环境变化导致旧结果误用 | 门禁失真 | CandidateSnapshot 变化即过期 | 依赖测试 |

## 回退策略

验证失败或中断时保留候选版本、全部结果和失败证据；允许修复后创建新运行轮次，不覆盖旧报告，不把未运行项折算为通过。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F009-001 | 方案确认后对固定候选逐项真实运行 | 运行评估流程定向集成测试 | 计划、执行、结果、失败和恢复状态一致 |
| AC-F009-002 | 报告与人工决定只读取真实证据 | 运行结果聚合、过期和阶段决定测试 | 未运行不通过、旧版本过期、非人工事件不推进 |
| AC-F009-003 | 有效信息主页面、运行复用、DSH 指令与历史只读 | 定向组件测试 | 空态、动态指标、运行按钮、返回入口一致 |
| AC-F009-004 | 版本与指标投影及真实文件指纹门禁 | 定向 Host 测试 | 无结果／旧版本／越界／缺失证据拒绝，完整证据可评审 |

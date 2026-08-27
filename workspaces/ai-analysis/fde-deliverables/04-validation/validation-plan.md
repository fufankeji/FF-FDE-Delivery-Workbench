# DS4-AI 数据分析系统验证计划（候选）

> 计划日期：2026-08-27  
> 候选版本：`DS4-0.1.0-local-20260827`  
> 状态：待 FDE 确认；尚未执行，本文件不代表任何指标已经通过  
> 结构化合同：`.fde/evaluations/validation.json`

## 1. 验证目的

本轮验证不是重复开发阶段的单元测试，而是检查当前候选版本是否能在约定环境中完成真实的数据分析交付，并为每个验收结论留下可复核证据。重点回答四个问题：

1. 客户的核心分析链路能否由实际使用者完整完成。
2. 数据、SQL、图表、模型和报告结论能否回溯到真实项目产物。
3. 只读、安全、离线和恢复边界是否符合已确认需求。
4. 当前是否具备进入部署试运行的条件；若不具备，缺口是什么、由谁处理。

## 2. 输入与边界

### 2.1 已读取输入

- `fde-deliverables/02-solution-design/acceptance-plan.md`：候选验收条件与证据要求。
- `fde-deliverables/02-solution-design/solution-baseline.md`：已确认决策与未决项。
- `fde-deliverables/03-project-development/implementation-report.md`：实现范围和剩余缺口。
- `fde-deliverables/03-project-development/runbook.md`：启动、停止、日志和恢复方法。
- `fde-deliverables/03-project-development/development-baseline.md`：开发期已执行的测试与运行事实。
- `fde-resources/05-脱敏订单数据样例.csv`：520 条数据行，SHA-256 为 `b44c966361fee66d463466f4494d0fa5377a2b63d2f6ef0eba214fd8843e689a`。

### 2.2 当前不冒充已具备的输入

- 客户 10 个验收问题及现有 SQL/Excel 对账结果尚未提供。
- 百万行性能数据集、目标设备和固定查询集尚未确认。
- 复购模型训练/测试时间窗口、正式阈值与业务代价尚未确认。
- 3 名真实分析师的独立试运行记录尚不存在。

这些缺口会保留在验证合同的 `issues[]` 中，不用虚构数据或替代口径绕过。

### 2.3 指标来源映射

每项指标的业务来源同时写入 `.fde/evaluations/validation.json` 的 `metrics[].sources`，平台会校验来源文件真实存在，并在评估页显示文档编号：

| 指标 | 来源编号 |
|---|---|
| 核心分析链路 | `project-prd.md` FR-1/FR-8；`acceptance-plan.md` BA-1 |
| 样例数据质量检出 | `project-prd.md` FR-6；`acceptance-plan.md` FA-5 |
| 只读查询安全边界 | `project-prd.md` FR-4；`acceptance-plan.md` FA-2/SA-1 |
| 无在线模型时的确定性能力 | `project-prd.md` FR-11；`acceptance-plan.md` DA-3 |
| 报告版本与恢复 | `project-prd.md` FR-9；`acceptance-plan.md` FA-8 |
| Agent 分析可追溯性 | `project-prd.md` FR-8；`acceptance-plan.md` AI-1 |
| 百万行查询性能 | `acceptance-plan.md` PA-1；`solution-baseline.md` SD-09/U-2 |
| 复购模型指标与复现 | `project-prd.md` FR-7；`acceptance-plan.md` AI-3/AI-4 |
| 凭据与敏感字段导出边界 | `acceptance-plan.md` SA-2/SA-3；`solution-baseline.md` SD-04 |
| 项目导出、备份与恢复 | `acceptance-plan.md` DA-2；`project-prd.md` FR-1 |

FDE 确认绑定当前 `validation.json` 的方案定义摘要（候选、环境、数据、指标来源/方法/阈值）。后续正常写回结果不会使确认失效；如修改方案定义，平台会要求重新确认后才能继续执行。

## 3. 验证环境

当前准备环境为 FDE 本机 macOS：

- Web：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:8000`
- 健康接口：`http://127.0.0.1:8000/api/health`
- 启停入口：`./scripts/start.sh`、`./scripts/stop.sh`
- 运行日志：`.runtime/logs/api.log`、`.runtime/logs/web.log`

正式性能、Docker 沙箱、MySQL、在线/私有模型及多用户试运行，需要在对应目标环境单独执行，不能从本机启动成功推断通过。

## 4. 指标与证据要求

| 指标 | 类别 | 必需 | 当前状态 | 验证证据 |
|---|---|---:|---|---|
| 核心分析链路 | 业务 | 是 | 待执行 | 操作记录、数据/查询/图表/模型/报告产物及血缘 |
| 样例数据质量检出 | 数据 | 是 | 待执行 | 质量画像、预期问题对账表、字段级结果 |
| 只读查询安全边界 | 安全 | 是 | 待执行 | 合法与拒绝用例记录、审计日志、产物检查 |
| 无在线模型时的确定性能力 | 功能 | 是 | 待执行 | 无凭证环境操作记录和实际产物 |
| 报告版本与恢复 | 恢复 | 是 | 待执行 | v1/v2/v3 文件、版本记录、渲染与引用检查 |
| Agent 分析可追溯性 | Agent | 是 | 待执行 | 会话记录、工具调用、项目产物引用和结论核对 |
| 百万行查询性能 | 性能 | 是 | 输入待确认 | 设备/数据/查询集说明、原始压测数据和 P95 报告 |
| 复购模型指标与复现 | 模型 | 否 | 输入待确认 | 数据窗口、种子、划分、参数、AUC/召回率/F1、逐行预测 |
| 凭据与敏感字段导出边界 | 安全 | 是 | 待执行 | 导出包审查、字段敏感等级检查、模型外发字段检查 |
| 项目导出、备份与恢复 | 恢复 | 是 | 待执行 | 导出清单、备份/恢复演练记录、恢复后产物核对 |

开发期 `ruff`、`mypy`、`pytest`、Vitest 和构建结果可作为候选版本背景证据，但不能替代上述验收环境中的实际执行结果。

## 5. 执行顺序

### 批次 A：环境与安全底线

1. 按运行手册重新启动前后端，记录环境、端口、健康状态和日志位置。
2. 执行只读 SQL 正向和拒绝用例，确认越界请求不会发布成功产物。
3. 移除在线模型凭证，逐项验证确定性能力是否真的执行。

如果安全边界失败或离线硬需求无法满足，停止放行判断，记录 FAIL 和缺陷后回到项目开发处理。

### 批次 B：核心业务链路

1. 导入脱敏订单样例并核对文件哈希、行数、字段和来源状态。
2. 完成质量画像及已知问题检出。
3. 完成只读查询、图表、模型实验和版本化报告的一条连续旅程。
4. 核对每个结论的 lineage、参数、版本和引用。

### 批次 C：恢复与 Agent

1. 创建、修订和恢复报告，确认历史版本不可变。
2. 在已配置的模型环境运行一个明确业务问题，核对 Agent 的计划、工具调用、证据引用和未知项表达。

### 批次 D：待客户补充后执行

1. 用客户 10 个验收问题与现有 SQL/Excel 结果做正确性对账。
2. 用确认的百万行数据和固定查询集执行性能测试。
3. 在确认的时间窗口执行复购模型验证。
4. 进入部署试运行后，由 3 名分析师独立完成任务；该记录不在本轮验证阶段提前伪造。

## 6. 证据存储约定

本轮执行证据统一放入 `.fde/evaluations/reports/<本轮验证编号>/`，例如：

- `environment.md`：设备、依赖、端口、候选版本与启动状态。
- `core-journey.md`：核心旅程步骤、结果和产物路径。
- `data-quality.md`：质量画像和预期问题对账。
- `readonly-security.md`：只读与拒绝用例。
- `offline-capabilities.md`：无模型凭证测试。
- `report-recovery.md`：报告版本与恢复记录。
- `agent-traceability.md`：Agent 会话与证据引用核对。
- `credential-sensitive.md`：导出/外部边界与敏感字段/凭据检查。
- `backup-recovery.md`：导出、备份与恢复演练记录。
- `performance.json` / `model-metrics.json`：适用时保留原始结构化结果。

只有证据文件真实存在后，才能在 `validation.json` 中把对应指标从 `NOT_RUN` 更新为 `PASS`、`WARN` 或 `FAIL`。`WARN` 必须写清接受理由。

## 7. 职责与确认

- Agent：读取已授权输入，协助执行命令、整理证据、更新合同和候选报告；不得编造数据或推进阶段。
- FDE：选择本轮候选版本、核对环境与阈值、复验关键旅程、判断 WARN/风险是否可接受，并最终决定是否提交进入部署试运行。
- 客户业务负责人：提供验收问题、指标口径和业务结果确认。
- 客户 IT/数据负责人：确认目标设备、数据、凭证、安全与部署边界。

## 8. 完成条件

只有同时满足以下条件，项目进度页才应允许 FDE 提交验证评估：

1. 所有必需指标均已执行，结果不是 FAIL，且引用项目内可读取证据。
2. 所有 WARN 均有明确接受理由。
3. critical/high 问题均已解决或留下经 FDE 接受的处理决定。
4. `validation-plan.md`、`validation-report.md`、`validation-baseline.md` 三份文件齐备。
5. FDE 在项目进度页阅读阻塞项与产物后进行二次确认。
6. 执行前，FDE 已在评估页确认当前版本的评估方案；该确认不能由 Agent 代替。

当前尚不满足完成条件：指标均未执行，两项 high 输入缺口仍开放，验证报告和验证基线尚未生成。因此本文件只负责启动真实验证，不声明可以进入部署试运行。

# DS4-AI 数据分析系统问题关闭清单（候选）

> 部署试运行阶段产物（候选） ｜ 候选版本 `DS4-0.1.0-local-20260827`
> 说明：记录进入/执行部署试运行前待处理问题。Agent 只能把问题状态写为 `open` / `resolved` / `deferred`，**不得代替 FDE 将问题标为 `accepted`**。`critical`/`high` 问题在 `open` 时阻止进入部署试运行。

## 1. 阻塞进入/执行试运行的问题

| id | 标题 | 严重级 | 状态 | 证据/说明 | 需谁关闭 |
|---|---|---|---|---|---|
| IT-ACC-RECONCILIATION | 客户尚未提供 10 个验收问题及现有 SQL/Excel 对账结果 | high | open | `../04-validation/validation-report.md` §3.1 | 客户业务负责人 |
| IT-ACC-PERF-BASELINE | 性能设备、百万行数据集与固定查询集、正式 P95 阈值未确认 | high | open | 验证报告 PA-1；`.fde/evaluations/validation.json` issues | FDE + 客户 IT |
| IT-ACC-MODEL-WINDOW | 复购模型训练/测试窗口、阈值与业务代价未确认 | medium | open | 验证报告 AI-3/AI-4 | 增长团队 |
| IT-ACC-TRIAL-AUTH | 未记录 FDE 对目标部署与试运行的目标/动作授权 | high | open | 部署基线 §2（`authorized=false`） | FDE |
| IT-ACC-ANALYST-TRIAL | 3 名分析师的独立试运行记录尚不存在 | medium | open | `trial-operation-report.md` §4 | 分析团队 + FDE |
| IT-ACC-ROLLBACK-DRILL | 回滚/恢复演练证据未产生 | medium | open | `deployment-runbook.md` §5 | FDE + IT |

## 2. 需在模型凭证会话中复核（当前未配置，先记录）

| id | 标题 | 严重级 | 状态 | 说明 |
|---|---|---|---|---|
| IT-AGR-TRACE | Agent 分析可追溯性未执行（需模型凭证） | medium | open | 验证报告 agent 指标 NOT_RUN |
| IT-SEC-MODEL-OUTBOUND | 「模型外发仅脱敏/聚合」子条件未复核 | medium | deferred | 无模型凭证；验收接受理由待 FDE 决策后可 `accepted` |

## 3. 已接受风险（候选，待 FDE 明确后成立）

| id | 标题 | 严重级 | 状态 | 接受理由（候选） |
|---|---|---|---|---|
| IT-RISK-EXPORT-RECOVERY | 应用内无项目恢复/导入端点，恢复需人工 | medium | deferred | 导出（备份）已验证；恢复能力未暴露，数据保留于 `.runtime/`，需 FDE/IT 决策是否补充导入或在恢复策略中接受人工恢复。 |
| IT-RISK-MODEL-METRICS | 聚类模型运行返回 `code/model/predictions`，无独立 metrics 产物 | low | deferred | 指标内嵌于模型产物元数据；建议在报告/履约材料中明确指标访问路径，不影响确定性能力使用。 |

> 说明：`deferred` 表示此处先记录、待对应条件/输入到位再处理；**不得并入 `accepted`**，除非 FDE 给出明确决定并记录 decisionReason。

## 4. 关闭路径（建议顺序）

1. FDE 明确授权目标部署与试运行目标/动作（IT-ACC-TRIAL-AUTH → resolved）。
2. 客户提供 10 个验收问题与对账结果（IT-ACC-RECONCILIATION → resolved）。
3. 客户/FDE 确认性能设备、百万行数据、查询集与阈值（IT-ACC-PERF-BASELINE → resolved）。
4. 增长团队确认复购窗口/阈值/业务代价（IT-ACC-MODEL-WINDOW → resolved）。
5. 执行部署+健康+关键旅程+3 分析师试用+回滚演练，补齐证据（IT-ACC-ANALYST-TRIAL、IT-ACC-ROLLBACK-DRILL → resolved）。
6. 配置模型凭证后复验 Agent 可追溯性与模型外发子条件（IT-AGR-TRACE、IT-SEC-MODEL-OUTBOUND）。

> 在 `critical`/`high`（ID：IT-ACC-RECONCILIATION、IT-ACC-PERF-BASELINE、IT-ACC-TRIAL-AUTH）仍为 `open` 时，阻止进入部署试运行；须由 FDE 在项目进度页核对后决定。

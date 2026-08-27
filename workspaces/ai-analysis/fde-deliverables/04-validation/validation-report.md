# DS4-AI 数据分析系统验证报告（候选）

> 验证编号：`run-2026-08-27-valid`
> 候选版本：`DS4-0.1.0-local-20260827`
> 报告日期：2026-08-27
> 状态：候选验证报告 ｜ 基于 `.fde/evaluations/reports/run-2026-08-27-valid/` 真实证据 ｜ 尚未代表 FDE 确认，也未宣布进入部署试运行

## 1. 执行摘要

本报告对应已由 FDE 确认的验证合同（`.fde/evaluations/validation.json`，schemaVersion=2，10 指标）。仅执行了**当前环境具备且得到授权**的真实检查；未具备条件（需客户数据/确认、需模型凭证、需目标性能设备）的指标保持 `NOT_RUN`。

| 状态 | 数量 | 指标 |
|---|---|---|
| PASS | 5 | 核心分析链路、样例数据质量检出、只读查询安全边界、无在线模型时的确定性能力、报告版本与恢复 |
| WARN | 2 | 凭据与敏感字段导出边界、项目导出/备份与恢复 |
| NOT_RUN | 3 | Agent 分析可追溯性、百万行查询性能、复购模型指标与复现 |

真实执行基于**离线确定性环境**（健康接口 `model=credential_not_in_process`，未配置模型凭证）；全程通过运行中的 HTTP API（`http://127.0.0.1:8000/api`）驱动，产物均有项目内 ID 与血缘。

## 2. 逐项结果、实际值与证据

| 指标 | 类别 | 状态 | 实际值/结论 | 证据 |
|---|---|---|---|---|
| 核心分析链路 | business | PASS | 接入样例 CSV(520行,指纹 b44c…)→查询→画像→图表→聚类模型→报告 v1/v2/v3→HTML 全链路完成，产物均有血缘 | `core-journey.md`、`validation-run.json` |
| 样例数据质量检出 | data | PASS | duplicate_rows=4；missing_cells=844；channel unique=5(含抖音/抖音商城)；satisfaction_score.max=6.0(>5) | `data-quality.md` |
| 只读查询安全边界 | security | PASS | 合法 SELECT 200；DML/多语句/主机文件函数/未登记表均 400 被服务端拒绝 | `readonly-security.md` |
| 无在线模型时的确定性能力 | functional | PASS | 无模型凭证下，接入/查询/画像/图表/模型/报告/导出均真实执行；聊天本地回退不伪造 | `offline-capabilities.md`、`core-journey.md` |
| 报告版本与恢复 | recovery | PASS | v1/v2/v3 均存在；恢复基于 v1 生成 v3，历史未覆盖；HTML(v2) 生成成功 | `report-recovery.md` |
| 凭据与敏感字段导出边界 | security | WARN | 导出 ZIP 未发现 api_key/password/secret/mobile/address/身份证，manifest 无 config/credential；但「模型外发仅脱敏/聚合」未触发 | `credential-sensitive.md` |
| 项目导出、备份与恢复 | recovery | WARN | 导出(备份)已验证(2.2MB/15文件含项目/报告/模型产物)；应用内**无项目恢复/导入端点**，恢复未复验 | `backup-recovery.md` |
| Agent 分析可追溯性 | agent | NOT_RUN | 需配置模型凭证后在验收会话执行；当前环境无模型 | — |
| 百万行查询性能 | performance | NOT_RUN | 目标设备/百万行数据集/固定查询集未确认 | — |
| 复购模型指标与复现 | model | NOT_RUN | 训练/测试窗口、正式阈值与业务代价未确认 | — |

## 3. 问题与观察

### 3.1 仍开放的高/中影响问题（来自合同 `issues[]`）
- `missing-customer-reconciliation-set`（high）：客户尚未提供 10 个验收问题及现有 SQL/Excel 对账结果 → 正确性对账未执行。
- `performance-baseline-unconfirmed`（high）：性能设备/百万行数据/查询集与正式 P95 阈值未确认 → 性能指标 NOT_RUN。
- `model-window-unconfirmed`（medium）：复购模型训练/测试窗口与业务代价未确认 → 模型指标 NOT_RUN。

### 3.2 本轮新观察（供 FDE 判断，不改变阈值）
1. **聚类模型运行返回产物键为 `code/model/predictions`，未返回独立 `metrics` 产物**（`metrics_id=null`）——指标内嵌于模型产物元数据，与开发评估（FR-7 标注「指标/预测登记」）一致；建议在报告/履约材料中明确指标访问路径。
2. **应用内无项目恢复/导入端点**（仅 `/system/mysql/import` 与报告恢复），「导出后恢复」需人工或后续导入能力，是 `project-export-backup-recovery` 判 WARN 的原因。
3. 图表数据范围按披露策略截断（`rows_used=500/520, truncated=true`），符合「有界预览」要求，非缺陷。

## 4. 偏差

- 与已确认合同相比，未修改任何指标来源、方法、阈值或候选版本；仅写回 `result` 状态与证据。
- 三项 NOT_RUN 均因当前环境/客户输入不具备条件，非方案偏差；不具备条件的指标如实保留 `NOT_RUN`，未伪造为通过。

## 5. 风险与是否建议进入部署试运行

- **建议：暂不建议进入部署试运行。** 理由：① 2 项 metrics 为 WARN（模型外发子条件未触发、项目恢复未复验）；② 3 项 NOT_RUN 中 2 项关联 high 开放问题（客户对账、性能基线）；③ Agent 可追溯需模型会话；④ 进入部署试运行还需 FDE 在项目进度页核对其余阻塞项（3 名分析师试运行记录、业务口径确认）后二次确认。
- 通过本轮的 5 项 PASS 可作为候选版本的**确定性能力可信度证据**，但不足以支撑放行部署试运行。

## 6. 下一步

- 待客户提供 10 个验收问题与对账结果 → 执行正确性对账（对应指标补执行）。
- 待客户/FDE 确认性能设备、百万行数据、查询集与阈值 → 执行性能测试。
- 待增长团队确认复购窗口/阈值/业务代价 → 执行模型验证。
- 在配置模型凭证后执行 Agent 可追溯性；并在模型启用会话复核「模型外发仅脱敏/聚合」子条件。
- `validation-baseline.md` 与三份收口产物齐备后，由 FDE 在项目进度页决策是否进入部署试运行。

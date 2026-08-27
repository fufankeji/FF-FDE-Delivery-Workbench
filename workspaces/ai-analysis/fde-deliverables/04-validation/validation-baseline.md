# DS4-AI 数据分析系统验证基线（候选）

> 验证编号：`run-2026-08-27-valid`
> 基线日期：2026-08-27
> 状态：候选验证基线 ｜ 不得据此宣布进入部署试运行；是否进入由 FDE 在项目进度页核对全部阻塞项后决定

## 1. 候选版本与环境

- 候选版本：`DS4-0.1.0-local-20260827`（来源：`fde-deliverables/03-project-development/development-baseline.md`）。
- 验证环境：FDE 本机 macOS（Apple Silicon）；Python 3.12.13 / uv 0.11.18 / node 24.16.0 / pnpm 11.24.0；Web `http://127.0.0.1:5173`、API `http://127.0.0.1:8000/api`。
- 运行状态：健康接口 `{"status":"ok","model":"credential_not_in_process","mysql":"not_configured","sandbox":"docker"}`；前端 HTTP 200；OpenAPI 3.1.0（57 路径）。
- 环境备注：本机无模型凭证（离线确定性环境）；正式性能设备、Docker、MySQL、在线/私有模型与多用户试运行环境未在本轮验证。

## 2. 数据/用例版本

- 数据：`fde-resources/05-脱敏订单数据样例.csv`，520 条数据行（+1 表头），SHA-256 `b44c966361fee66d463466f4494d0fa5377a2b63d2f6ef0eba214fd8843e689a`（已与实际文件核对一致）。
- 业务问题样例：按验收方案使用该样例完成 接入→查询→画像→图表→模型→报告 旅程。

## 3. 已确认指标结果（本验证轮）

| 指标 | 类别 | 结果 | 证据 |
|---|---|---|---|
| 核心分析链路 | business | PASS | `core-journey.md` |
| 样例数据质量检出 | data | PASS | `data-quality.md` |
| 只读查询安全边界 | security | PASS | `readonly-security.md` |
| 无在线模型时的确定性能力 | functional | PASS | `offline-capabilities.md` |
| 报告版本与恢复 | recovery | PASS | `report-recovery.md` |
| 凭据与敏感字段导出边界 | security | WARN | `credential-sensitive.md` |
| 项目导出、备份与恢复 | recovery | WARN | `backup-recovery.md` |
| Agent 分析可追溯性 | agent | NOT_RUN | 需要模型凭证会话 |
| 百万行查询性能 | performance | NOT_RUN | 需要目标设备/数据/查询集 |
| 复购模型指标与复现 | model | NOT_RUN | 需要窗口/阈值/业务代价 |

> 以上为本候选版本在**离线确定性环境**下的真实结果。PASS/WARN 引用 `run-2026-08-27-valid` 目录下的真实证据文件。

## 4. 接受风险（WARN 接受理由）与未决项

- 凭据与敏感字段导出边界（WARN）：导出 ZIP 未发现 api_key/password/secret/mobile/address/身份证，manifest 无 config/credential；但「模型外发仅脱敏/聚合」子条件因当前无模型凭证未触发，需在模型启用会话复核。
- 项目导出、备份与恢复（WARN）：导出（备份）已验证；应用内未暴露项目恢复/导入端点，恢复未在实际会话复验，数据保留于 `.runtime/` 需人工恢复。
- 未决（open）高/中问题：客户 10 个验收问题及对账结果（high）、性能设备/百万行数据/查询集与阈值（high）、复购模型训练/测试窗口与业务代价（medium）——对应 3 项 NOT_RUN 指标，均需对应输入/确认后才能补执行。

## 5. 可追溯证据

- 结构化运行记录：`.fde/evaluations/reports/run-2026-08-27-valid/validation-run.json`
- 分项证据：`environment.md`、`core-journey.md`、`data-quality.md`、`readonly-security.md`、`offline-capabilities.md`、`report-recovery.md`、`credential-sensitive.md`、`backup-recovery.md`
- 导出备份样例：`northlight-a9a6b185-...zip`
- 验证合同：`.fde/evaluations/validation.json`（schemaVersion=2）

## 6. FDE 确认记录

- 方案确认：`.fde/evaluations/validation-plan-approval.json`（contractDigest `ed393d...`，2026-08-27，平台写入）。
- FDE 是否进入部署试运行：**待 FDE 在项目进度页核对全部阻塞项后决定**（本文件不代表已放行）。

> 本验证基线为候选产物：只记录本候选版本在离线确定性环境下已确认的指标结果与接受风险；不推进项目阶段，不宣布进入部署试运行。

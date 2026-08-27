# DS4-AI 数据分析系统部署基线（候选）

> 部署试运行阶段产物（候选） ｜ 候选版本 `DS4-0.1.0-local-20260827`
> 说明：只记录候选版本、目标环境与真实证据。**不代 FDE 授权；进入试运行须 FDE 在项目进度页核对阻塞项后决定。**

## 1. 候选版本

- 版本：`DS4-0.1.0-local-20260827`（与验证基线一致；来源 `fde-deliverables/03-project-development/development-baseline.md`）。
- 包版本：0.1.0（`pyproject.toml` / `frontend/package.json`）；当前目录非 Git 工作树，无可信 commit SHA；以 `MANIFEST.json` 哈希与研发基线为交付参考。

## 2. 目标环境

| 项 | 值 |
|---|---|
| 名称 | FDE 本机 macOS（Apple Silicon）本地优先单机试点 |
| 运行版本 | Python 3.12.13 / uv 0.11.18 / node 24.16.0 / pnpm 11.24.0 |
| 地址 | 页面 `http://127.0.0.1:5173/`；API `http://127.0.0.1:8000/api`；文档 `http://127.0.0.1:8000/docs` |
| 授权 | `authorized = false`（未记录 FDE 对目标部署/试运行的明确授权） |
| 备注 | 离线确定性环境（无模型凭证）；正式性能设备、Docker、MySQL、在线/私有模型、多用户试运行环境未纳入 |

> 当前本机运行实例为**开发/验证环境实例**；部署试运行的**正式目标部署**须 FDE 明确授权后才生效（见 `.fde/deployment-trial.json`）。

## 3. 证据引用

| 证据 | 路径 |
|---|---|
| 验证基线 | `fde-deliverables/04-validation/validation-baseline.md` |
| 验证报告 | `fde-deliverables/04-validation/validation-report.md` |
| 部署运行手册 | `fde-deliverables/05-deployment-trial/deployment-runbook.md` |
| 环境与健康证据 | `.fde/deployment-trial/evidence/environment-health.md` |
| 回滚策略 | `fde-deliverables/05-deployment-trial/deployment-runbook.md` §5 |
| 试运行说明 | `fde-deliverables/05-deployment-trial/trial-operation-report.md` |

## 4. 部署与运行状态

- 部署步骤见 `deployment-runbook.md`。
- 当前健康：页面 HTTP 200；`/api/health` → `{"status":"ok","model":"credential_not_in_process","mysql":"not_configured","sandbox":"docker"}`；OpenAPI 3.1.0（57 路径）。
- **试运行状态：未正式启动**（`status=preparing`；`environment.authorized=false`）。一次启动与 HTTP 200 只作为单项证据，不等同于试运行完成。

## 5. 进入试运行的前置（未满足项→见 issue-closure-list.md）

- FDE 对目标部署与试运行动作的明确授权。
- 2 个 high 开放问题（客户 10 个验收问题及对账结果、性能设备/百万行/查询集与阈值）关闭。
- 3 名分析师的试运行记录尚不存在。
- 回滚演练证据未产生。
- Agent 可追溯性与「模型外发仅脱敏/聚合」子条件需模型凭证会话（当前未配置）。

> 本部署基线为候选产物：只记录候选版本、目标环境与真实证据，不推进阶段、不宣布进入试运行。

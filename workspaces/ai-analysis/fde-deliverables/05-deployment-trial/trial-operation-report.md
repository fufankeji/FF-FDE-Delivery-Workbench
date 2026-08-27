# DS4-AI 数据分析系统试运行操作报告（候选）

> 部署试运行阶段产物（候选） ｜ 候选版本 `DS4-0.1.0-local-20260827`
> 目标环境：FDE 本机 macOS 单机（本地优先试点）
> 说明：**本报告如实反映当前状态——试运行尚未正式授权与执行。** 不虚构操作记录；一次启动、端口可访问或 HTTP 200 只作为单项证据，不代表试运行完成。

## 1. 试运行状态

- 状态：`preparing`（未正式启动）；`environment.authorized = false`。
- 原因：① 未记录 FDE 对目标部署/试运行的目标与动作授权；② 验证阶段仍有 2 个 high 开放问题与 3 项 `NOT_RUN`（见验证报告）；③ 3 名分析师试运行记录尚不存在；④ 回滚演练未执行。

## 2. 当前环境观测（真实，非试运行完成）

| 项 | 实测 |
|---|---|
| 页面 | `http://127.0.0.1:5173/` HTTP 200 |
| 后端健康 | `/api/health` → `{"status":"ok","model":"credential_not_in_process","mysql":"not_configured","sandbox":"docker"}` |
| OpenAPI | `/openapi.json` 3.1.0（57 路径）；`/docs` HTTP 200 |
| 运行日志 | `.runtime/logs/api.log`、`.runtime/logs/web.log` |

以上为**开发/验证环境实例**的健康事实，用于确认应用可启动，不代表试运行已完成。

## 3. 计划的首要试运行操作（待 FDE 授权后执行并补证据）

1. 明确目标环境与授权（`environment.authorized=true`、`status=deploying/running`）。
2. 按 `deployment-runbook.md` 在目标环境部署并核验健康。
3. 采用脱敏样例完成一条真实分析旅程，记录产物与血缘。
4. 3 名分析师各独立完成一次分析并导出项目，记录使用问题。
5. 关键安全/边界复核：只读、敏感字段、导出不含凭证、无模型可用性。
6. 记录试运行问题清单、回滚/恢复演练与结果。

## 4. 证据部分

- 试运行证据：**尚未产生**（待授权执行）。当前仅有：
  - 环境/健康证据：`.fde/deployment-trial/evidence/environment-health.md`。
  - 验证基线：`fde-deliverables/04-validation/validation-baseline.md`。
- 待补：试运行操作记录、3 名分析师使用记录、回滚演练记录、问题与解决记录。

## 5. 结论

- 未达到「试运行完成」；不得据此宣布进入验收移交。
- 下一步需 FDE：明确授权目标部署与试运行 → 重新部署 → 执行健康 + 关键旅程 + 3 分析师试用 → 记录证据与问题 → 关闭阻塞项。随后由 FDE 在项目进度页决定是否进入验收移交。

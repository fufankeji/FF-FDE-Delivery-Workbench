# 部署目标环境与健康证据（部署试运行准备阶段）

- 目标环境：FDE 本机 macOS（Apple Silicon）本地优先单机部署。
- 运行时：Python 3.12.13 / uv 0.11.18 / node 24.16.0 / pnpm 11.24.0。
- 候选版本：`DS4-0.1.0-local-20260827`。
- 页面：`http://127.0.0.1:5173/`（HTTP 200）。
- 后端健康：`http://127.0.0.1:8000/api/health` → `{"status":"ok","model":"credential_not_in_process","mysql":"not_configured","sandbox":"docker"}`。
- OpenAPI：`http://127.0.0.1:8000/openapi.json`（3.1.0，57 路径）；`/docs` HTTP 200。
- 说明：本机为离线确定性环境（无模型凭证）。此实例为开发/验证环境实例；**部署试运行的正式目标部署须由 FDE 明确授权后才生效**，本文件只记录当前环境与健康事实，不代表试运行已授权或完成。

# 验证环境记录（run-2026-08-27-valid）

- 设备：FDE 本机 macOS（Apple Silicon）；Python 3.12.13 / uv 0.11.18 / node 24.16.0 / pnpm 11.24.0。
- 依赖安装：`uv sync --group dev`（`UV_CACHE_DIR=.uv-cache`）、`pnpm --dir frontend install --frozen-lockfile --store-dir=.pnpm-store`、`pnpm --dir frontend rebuild esbuild`。
- 启动：`./scripts/start.sh`（API 8000 / Web 5173）：前端 `http://127.0.0.1:5173` HTTP 200；API 健康 `http://127.0.0.1:8000/api/health`。
- 健康接口结果：`{"status":"ok","model":"credential_not_in_process","mysql":"not_configured","sandbox":"docker"}`。
- 候选版本：`DS4-0.1.0-local-20260827`（见 `fde-deliverables/03-project-development/development-baseline.md`）。
- 说明：本机无模型凭证（`model=credential_not_in_process`），因此当前环境=离线确定性环境；在线对话/外部模型未配置。

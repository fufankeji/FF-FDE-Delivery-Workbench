# AGENTS.md — DS4-AI 数据分析系统

本文件为项目的权威启动/运行说明。相关细节以 `README.md`、`INSTALL.md`、`scripts/start.sh`、`scripts/stop.sh` 为准；以下为启动本项目所需的最小事实（均来自上述真实文件，非猜测）。

## 项目是什么

本地优先、单用户的数据分析工作台。把数据源接入、只读查询、数据探索、特征工程、机器学习、产物血缘、报告编排与可扩展 Skills 组织在同一个项目工作区中。确定性能力（项目管理、数据接入、查询、图表、机器学习、报告版本、产物管理）**不依赖在线模型**；仅“在线对话/模型服务”需要模型 API Key。

## 环境要求

- Python 3.12（`requires-python = ">=3.12,<3.13"`）；uv
- Node.js 22+；pnpm
- 内存 8GB+（推荐 16GB）；浏览器 Chromium/Chrome/Edge 当前稳定版
- 可选：Docker Desktop（脚本型 Skill 沙箱）、MySQL（MySQL 数据源/Olist 复现）

## 安装依赖（项目根目录执行，一次）

```bash
uv sync --group dev
pnpm --dir frontend install --frozen-lockfile
# 可选（仅端到端测试需要）
pnpm --dir frontend exec playwright install chromium
```

## 准备本地配置

```bash
cp .env.example .env
chmod 600 .env
```

`.env` 默认值（见 `.env.example`）：`NORTHLIGHT_RUNTIME_ROOT=.runtime`、`NORTHLIGHT_MODEL_NAME=deepseek-v4-flash`、`NORTHLIGHT_MODEL_BASE_URL=https://api.deepseek.com`。模型 API Key 不写入源码或 `.env`，启动后在“设置 → 模型服务”填写并连接测试。

## 启动（前后端）

```bash
./scripts/start.sh
```

- 默认端口：API `8000`，Web `5173`。
- 浏览器地址：`http://127.0.0.1:5173`
- 后端健康接口：`http://127.0.0.1:8000/api/health`
- 指定其他端口：`NORTHLIGHT_API_PORT=18100 NORTHLIGHT_WEB_PORT=15180 ./scripts/start.sh`（此时 Web=`http://127.0.0.1:15180`，API=`http://127.0.0.1:18100/api/health`）

`start.sh` 只启动已安装好的后端与前端，不会代替依赖安装。API 未就绪时查看 `.runtime/logs/api.log`；Web 未就绪查看 `.runtime/logs/web.log`。

## 状态检查

```bash
curl --noproxy '*' -fsS http://127.0.0.1:8000/api/health
curl --noproxy '*' -I http://127.0.0.1:5173/
```

## 停止

```bash
./scripts/stop.sh
```

停止脚本不删除 `.runtime/` 中的项目、数据源、模型、报告与设置。

## 可选能力

- 脚本型 Skill：先启动 Docker Desktop，再 `./scripts/build-sandbox.sh`。
- 本地 MySQL 演示（macOS Apple Silicon）：`./scripts/mysql-local.sh start|status|stop`。
- Olist 演示数据：放入 `.runtime/datasets/olist/olist.zip` 后 `uv run python scripts/prepare_olist.py`。

## 构建与测试

```bash
uv run ruff check backend scripts
uv run mypy backend/northlight
uv run pytest -q
pnpm --dir frontend test
pnpm --dir frontend build
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost pnpm --dir frontend test:e2e
```

## 常见问题

- API 未就绪：查看 `.runtime/logs/api.log`，确认 8000 端口未被占用。
- 页面无法访问 API：确认 5173 端口未被占用，并为 localhost 设置 `NO_PROXY=127.0.0.1,localhost`。
- 在线聊天无凭证：设置页完成模型连接测试（不影响本地确定性能力）。
- Skill 脚本无法运行：确认 Docker Desktop 已启动并已构建 `northlight-python-sandbox:0.1` 镜像。

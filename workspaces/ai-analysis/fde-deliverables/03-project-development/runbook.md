# DS4-AI 数据分析系统运行手册（候选）

> 状态：候选研发收口产物  
> 适用：macOS、Linux 或 WSL2 本地单机运行  
> 更新日期：2026-08-27

## 1. 基础环境

- Python 3.12
- uv
- Node.js 22+
- pnpm
- 8 GB 内存，建议 16 GB
- Chromium/Chrome/Edge 当前稳定版

Docker 仅用于脚本型 Skill；MySQL 仅用于 MySQL 来源；二者不是 CSV/Excel/SQLite 主路径的启动前置。

## 2. 安装

在项目根目录执行：

```bash
uv sync --group dev
pnpm --dir frontend install --frozen-lockfile
```

> **受限环境提示（重要）**：若本机的 `~/.cache`（uv）或 pnpm 全局 store 不可写（例如在受限/沙箱目录运行脚本），请把缓存与 store 指到项目内，否则安装会以“无法打开缓存/存储索引”失败：
> ```bash
> UV_CACHE_DIR="$PWD/.uv-cache" uv sync --group dev
> pnpm --dir frontend install --frozen-lockfile --store-dir="$PWD/.pnpm-store"
> ```
>
> 另注意：较新版本的 pnpm 默认忽略依赖构建脚本，vite 依赖的 **esbuild** 可能因此缺少二进制。若启动时 vite/esbuild 失败，执行：
> ```bash
> pnpm --dir frontend rebuild esbuild
> ```
> 并用 `frontend/node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild --version` 确认可运行。

仅运行 Playwright 时安装 Chromium：

```bash
pnpm --dir frontend exec playwright install chromium
```

复制公开配置，不把真实 Key 写入示例文件：

```bash
cp .env.example .env
chmod 600 .env
```

## 3. 启动与健康检查

```bash
./scripts/start.sh
curl --noproxy '*' -fsS http://127.0.0.1:8000/api/health
curl --noproxy '*' -I http://127.0.0.1:5173/
```

> **首次启动时序提示**：若首轮 `start.sh` 报 `[ERROR] API did not become ready`，多为首次初始化运行 SQLite/内置 Skills 时的时序问题，而非代码故障。查看 `.runtime/logs/api.log`；若初始化已完成，重新执行 `./scripts/start.sh` 即可，无需改动代码。本轮实测在初始化完成后重跑即成功。

默认地址：

- Web：`http://127.0.0.1:5173`
- API 健康：`http://127.0.0.1:8000/api/health`
- FastAPI 文档：`http://127.0.0.1:8000/docs`（OpenAPI 3.1.0，57 路径，OpenAPI JSON 为 `http://127.0.0.1:8000/openapi.json`）

端口冲突时：

```bash
NORTHLIGHT_API_PORT=18100 NORTHLIGHT_WEB_PORT=15180 ./scripts/start.sh
```

## 4. 停止与数据保留

```bash
./scripts/stop.sh
```

停止只终止本项目记录的前后端进程，不删除 `.runtime/`。彻底重置前先备份项目；删除 `.runtime/` 会移除本地项目、来源、报告、模型配置和运行记录，不能作为普通排障步骤。

## 5. 日志与排障

- API 未就绪：检查 `.runtime/logs/api.log` 和 API 端口。
- Web 不可用：检查 `.runtime/logs/web.log`、Web 端口和 localhost 代理例外。
- 在线对话无凭据：在“设置 → 模型服务”测试并保存；本地查询/建模/报告不受影响。
- 来源 changed：重新画像后再使用，避免沿用旧字段基线。
- 报告缺图：先保存图表 Artifact，再创建新的报告版本。
- 脚本 Skill 失败：确认 Docker 已启动并构建 `northlight-python-sandbox:0.1`。

## 6. 验证命令

```bash
uv run ruff check backend scripts
uv run mypy backend/northlight
uv run pytest -q
pnpm --dir frontend test
pnpm --dir frontend build
```

端到端测试需要浏览器运行时：

```bash
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost pnpm --dir frontend test:e2e
```

> 本轮（2026-08-27）已实际执行并通过：`ruff`、`mypy`、`pytest -q`（59 passed / 2 skipped，沙箱镜像未构建而跳过）、`pnpm --dir frontend test`（20 passed）、`pnpm --dir frontend build`。未执行：Playwright e2e（需 Chromium）、沙箱集成（需 Docker）、Olist/MySQL/百万行（可选能力）。

执行结果必须记录到研发基线；命令出现在手册中不代表已经通过。

## 7. 可选服务

```bash
./scripts/build-sandbox.sh
./scripts/mysql-local.sh start
uv run python scripts/prepare_olist.py
uv run python scripts/benchmark_million.py
```

分别需要 Docker、本地 MySQL/Olist 数据或足够资源；失败不会自动判定基础 Web/API 不可运行。

## 8. 恢复策略

- 服务重启：停止后重新执行 `start.sh`，`.runtime` 状态继续使用。
- 模型配置失败：旧配置保持；用设置页重新测试新 Key。
- 报告渲染失败：保留 Markdown 版本，修复环境后对同一版本重试 HTML。
- 来源损坏/变化：保留 failed/changed 记录，更换文件或 reprofile，不手工伪改状态。
- 项目误归档：从首页恢复；项目删除后的恢复需从备份/trash 人工处理，先停止写入。

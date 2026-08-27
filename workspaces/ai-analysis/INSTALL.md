# 安装说明

本文档说明如何在本机安装并运行该项目。

本项目是一套**本地优先的单用户数据分析工作台**，把数据源接入、只读查询、数据探索、特征工程、机器学习、产物血缘、报告编排和可扩展 Skills 组织在同一个项目工作区中。它不需要云端服务即可运行项目管理、数据接入、查询、图表、机器学习、报告版本和产物管理等确定性能力；仅“在线对话/模型服务”需要填写模型 API Key。

> 本文档默认以已解压的项目源码根目录为当前工作目录。文中所有命令均在根目录执行。

---

## 一、环境要求

运行本项目需要：

- **Python 3.12**（`requires-python = ">=3.12,<3.13"`）；
- **uv**（Python 依赖管理工具）；
- **Node.js 22 或更高版本**；
- **pnpm**（前端包管理器）；
- 内存 **8 GB 以上，推荐 16 GB**；
- 浏览器使用 **Chromium、Chrome 或 Edge** 的当前稳定版本。

**可选**：

- **Docker Desktop**：仅在执行脚本型 Skill 时需要；
- **MySQL**：仅在连接 MySQL 数据源或复现实验数据时需要。CSV、Excel 和 SQLite 主路径不依赖 MySQL。

先检查本机版本：

```bash
python3.12 --version
uv --version
node --version
pnpm --version
```

> Windows 用户：项目启动与沙箱脚本使用 Bash、POSIX 进程信号和 Unix 文件权限。建议使用 **WSL2** 运行；当前版本未把 PowerShell 原生运行列为已验证路径。

---

## 二、安装依赖

以下命令均在项目根目录执行。

### 1. 安装后端依赖（含开发/测试依赖）

```bash
uv sync --group dev
```

该命令会在项目根目录创建 `.venv/` 虚拟环境，并按 `pyproject.toml` 与 `uv.lock` 安装后端依赖（DuckDB、FastAPI、pandas、polars、scikit-learn、SQLAlchemy 等）以及 `dev` 组的开发测试依赖（mypy、pytest、ruff 等）。

### 2. 安装前端依赖

```bash
pnpm --dir frontend install --frozen-lockfile
```

严格按照 `frontend/pnpm-lock.yaml` 锁文件安装 `frontend/` 下的依赖。

### 3. 安装浏览器测试运行时

```bash
pnpm --dir frontend exec playwright install chromium
```

安装浏览器端到端测试所需要的 Chromium（仅在执行端到端测试时需要，可跳过）。

---

## 三、准备本地配置

复制公开配置示例并收紧文件权限：

```bash
cp .env.example .env
chmod 600 .env
```

`.env` 默认内容（见 `.env.example`）：

```ini
NORTHLIGHT_RUNTIME_ROOT=.runtime
NORTHLIGHT_MODEL_NAME=deepseek-v4-flash
NORTHLIGHT_MODEL_BASE_URL=https://api.deepseek.com
```

> 模型凭证不会写入源码包或 `.env`。需要在线对话时，启动后进入“设置 → 模型服务”，填写 API Key、模型名称和 Base URL，先执行连接测试再保存；凭证将作为权限为 `600` 的运行时文件保存在 `.runtime/` 中。这不影响本地确定性能力。

---

## 四、启动、状态检查与停止

### 启动

依赖安装完成后，使用项目脚本一次性启动后端与前端：

```bash
./scripts/start.sh
```

启动脚本只负责启动**已安装好**的后端和前端，不会代替依赖安装。

- 浏览器地址：`http://127.0.0.1:5173`
- 后端健康接口：`http://127.0.0.1:8000/api/health`

### 状态检查

```bash
curl --noproxy '*' -fsS http://127.0.0.1:8000/api/health
curl --noproxy '*' -I http://127.0.0.1:5173/
```

### 停止

```bash
./scripts/stop.sh
```

停止脚本不会删除 `.runtime/` 中的项目、数据源、模型、报告与设置。需要彻底重置时，先备份所需项目，再手动删除 `.runtime/`。

### 指定其他端口

若默认端口被占用，可指定另外一组端口启动：

```bash
NORTHLIGHT_API_PORT=18100 NORTHLIGHT_WEB_PORT=15180 ./scripts/start.sh
```

此时浏览器地址为 `http://127.0.0.1:15180`，API 健康接口为 `http://127.0.0.1:18100/api/health`。停止命令仍为 `./scripts/stop.sh`。

---

## 五、可选能力

### 脚本型 Skill（无网络沙箱）

执行脚本型 Skill 前，启动 Docker Desktop 并构建无网络沙箱镜像：

```bash
./scripts/build-sandbox.sh
```

### 本地 MySQL 演示环境

macOS Apple Silicon 上的本地 MySQL 8.4 演示环境可由项目脚本手动管理：

```bash
./scripts/mysql-local.sh start
./scripts/mysql-local.sh status
./scripts/mysql-local.sh stop
```

> Linux 或 WSL2 可连接已有 MySQL 8.x 实例；`mysql-local.sh` 使用 Homebrew 安装路径，不属于 Linux 与 Windows 原生启动脚本。

### Olist 演示数据

Olist 演示数据不随源码包分发。需要复现巴西电商分析时，可向助教领取数据文件，或从数据集发布页下载后放入 `.runtime/datasets/olist/olist.zip`，再执行：

```bash
uv run python scripts/prepare_olist.py
```

---

## 六、构建与测试

### 后端：静态检查、类型检查与测试

```bash
uv run ruff check backend scripts
uv run mypy backend/northlight
uv run pytest -q
```

### 前端：单元测试、生产构建与端到端测试

```bash
pnpm --dir frontend test
pnpm --dir frontend build
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost pnpm --dir frontend test:e2e
```

### 性能诊断（可选）

百万行数据性能诊断：

```bash
uv run python scripts/benchmark_million.py
```

---

## 七、常见问题

- **API 未就绪**：查看 `.runtime/logs/api.log`，确认 8000 端口未被其他进程占用。
- **页面无法访问 API**：确认 5173 端口未被占用，并为 localhost 设置 `NO_PROXY=127.0.0.1,localhost`。
- **在线聊天提示没有凭证**：进入“设置”页完成模型连接测试；这不影响本地确定性能力。
- **报告没有图表**：报告只嵌入明确引用的图表产物。应先保存图表，再创建新报告版本。
- **数据源显示已变化**：重新执行画像后再查询，避免沿用过期字段基线。
- **Skill 脚本无法运行**：确认 Docker Desktop 已启动，并已构建 `northlight-python-sandbox:0.1` 镜像。

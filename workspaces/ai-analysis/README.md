# DS4-AI数据分析系统学员版

DS4-AI数据分析系统是一套本地优先的单用户数据分析工作台。系统把数据源接入、只读查询、数据探索、特征工程、机器学习、产物血缘、报告编排和可扩展 Skills 组织在同一个项目工作区中。

## 一、领取并解压项目包

向助教领取 `DS4-AI数据分析系统-学员版.zip`。项目源码包不包含真实 API Key、个人数据库连接、运行数据库和原始 Olist 数据。

macOS、Linux 或 WSL2 可在保存压缩包的目录执行：

```bash
unzip 'DS4-AI数据分析系统-学员版.zip'
cd 'DS4-AI数据分析系统'
```

Windows PowerShell 可先完成解压，再从 WSL2 进入解压目录：

```powershell
Expand-Archive -Path '.\DS4-AI数据分析系统-学员版.zip' -DestinationPath '.'
```

项目启动与沙箱脚本使用 Bash、POSIX 进程信号和 Unix 文件权限。Windows 学员应使用 WSL2；当前学员版没有把 PowerShell 原生运行列为已验证路径。

## 二、环境要求

基础运行需要：

- Python 3.12；
- uv；
- Node.js 22 或更高版本；
- pnpm；
- 8 GB 以上内存，推荐 16 GB；
- 浏览器使用 Chromium、Chrome 或 Edge 的当前稳定版本。

Docker Desktop 只在执行脚本型 Skill 时需要。MySQL 只在连接 MySQL 数据源或复现实验数据时需要；CSV、Excel 和 SQLite 主路径不依赖 MySQL。

检查本机版本：

```bash
python3.12 --version
uv --version
node --version
pnpm --version
```

## 三、安装依赖

以下命令均在解压后的 `DS4-AI数据分析系统` 根目录执行：

```bash
uv sync --group dev
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend exec playwright install chromium
```

第一条命令在 `.venv/` 中安装后端与开发测试依赖；第二条命令严格按照前端锁文件安装依赖；第三条命令安装浏览器端到端测试所需的 Chromium。

## 四、准备本地配置

复制公开配置示例：

```bash
cp .env.example .env
chmod 600 .env
```

模型凭证不写入源码包或 `.env.example`。系统无需在线模型即可运行项目管理、数据接入、查询、图表、机器学习、报告版本和产物管理等确定性能力。需要在线对话时，启动系统后进入“设置 → 模型服务”，填写 API Key、模型名称和 Base URL，并先执行连接测试再保存；凭证将以权限为 `600` 的运行时文件保存在本机 `.runtime/` 中。

## 五、启动、状态检查与停止

依赖安装完成后使用项目脚本启动前后端：

```bash
./scripts/start.sh
```

启动脚本只负责启动已经安装好的后端和前端，不会代替依赖安装。浏览器访问 `http://127.0.0.1:5173`，后端健康接口为 `http://127.0.0.1:8000/api/health`。

检查服务状态：

```bash
curl --noproxy '*' -fsS http://127.0.0.1:8000/api/health
curl --noproxy '*' -I http://127.0.0.1:5173/
```

停止本项目启动的前后端进程：

```bash
./scripts/stop.sh
```

停止脚本不会删除 `.runtime/` 中的项目、数据源、模型、报告与设置。需要彻底重置时，应先备份所需项目，再手动删除 `.runtime/`。

若默认端口已被占用，可在启动时指定另一组端口：

```bash
NORTHLIGHT_API_PORT=18100 NORTHLIGHT_WEB_PORT=15180 ./scripts/start.sh
```

此时浏览器地址为 `http://127.0.0.1:15180`，API 健康接口为 `http://127.0.0.1:18100/api/health`。停止命令仍为 `./scripts/stop.sh`。

## 六、第一个分析项目

1. 在首页创建一个分析项目。
2. 在“数据资产”或项目数据源页面上传 CSV、Excel 或 SQLite 文件。
3. 返回项目对话页并选择本轮数据源。
4. 使用自然语言提出查询、图表、数据质量、特征工程或建模任务。
5. 在右侧“运行、结果、报告”区域检查执行步骤、产物与报告版本。
6. 在产物页查看数据、SQL、代码、图表、模型、预测和报告之间的血缘关系。

Olist 演示数据不随源码包重复分发。需要复现课程中的巴西电商分析时，可向助教领取对应数据文件，或从数据集发布页自行下载后放入 `.runtime/datasets/olist/olist.zip`，再执行：

```bash
uv run python scripts/prepare_olist.py
```

## 七、可选能力

执行脚本型 Skill 前，启动 Docker Desktop 并构建无网络沙箱镜像：

```bash
./scripts/build-sandbox.sh
```

macOS Apple Silicon 上的本地 MySQL 8.4 演示环境可由项目脚本手动管理：

```bash
./scripts/mysql-local.sh start
./scripts/mysql-local.sh status
./scripts/mysql-local.sh stop
```

Linux 或 WSL2 可连接已有 MySQL 8.x 实例；项目自带的 `mysql-local.sh` 使用 Homebrew 安装路径，不属于 Linux 与 Windows 原生启动脚本。

## 八、构建与测试

后端静态检查、类型检查与测试：

```bash
uv run ruff check backend scripts
uv run mypy backend/northlight
uv run pytest -q
```

前端单元测试、生产构建与浏览器端到端测试：

```bash
pnpm --dir frontend test
pnpm --dir frontend build
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost pnpm --dir frontend test:e2e
```

百万行数据性能诊断属于可选步骤：

```bash
uv run python scripts/benchmark_million.py
```

## 九、常见问题

- API 未就绪：检查 `.runtime/logs/api.log`，确认 8000 端口未被其他进程占用。
- 页面无法访问 API：确认 5173 端口未被占用，并为 localhost 设置 `NO_PROXY=127.0.0.1,localhost`。
- 在线聊天提示没有凭证：进入设置页完成模型连接测试；这不影响本地确定性能力。
- 报告没有图表：报告只嵌入明确引用的图表产物，应先保存图表，再创建新报告版本。
- 数据源显示已变化：重新执行画像后再查询，避免沿用过期字段基线。
- Skill 脚本无法运行：确认 Docker Desktop 已启动，并已构建 `northlight-python-sandbox:0.1` 镜像。

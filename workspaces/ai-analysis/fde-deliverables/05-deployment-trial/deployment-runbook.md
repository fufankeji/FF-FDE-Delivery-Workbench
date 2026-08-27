# DS4-AI 数据分析系统部署运行手册（候选）

> 部署试运行阶段产物（候选） ｜ 候选版本 `DS4-0.1.0-local-20260827`
> 目标环境：FDE 本机 macOS（Apple Silicon）本地优先单机部署
> 说明：本手册描述**如何在该目标环境部署、启动、健康检查、停止与回滚**。它不代替 FDE 对目标部署动作的授权；一次启动、端口可访问或 HTTP 200 只作为单项证据，不能冒充试运行完成。

## 1. 部署前提（目标环境）

| 项 | 要求 |
|---|---|
| Python | 3.12（`requires-python = ">=3.12,<3.13"`） |
| uv | 已安装 |
| Node.js / pnpm | Node 22+ / pnpm |
| 内存 | 8GB+，建议 16GB |
| 浏览器 | Chromium / Chrome / Edge 当前稳定版 |
| 可选 | Docker（脚本型 Skill 沙箱）、MySQL（MySQL 来源/Olist 复现） |

说明：CSV / Excel / SQLite 主路径不依赖 MySQL 与 Docker；本项目为本地优先单机，不做多人并发集群。

## 2. 部署步骤（安装依赖与配置）

在项目根目录执行：

```bash
uv sync --group dev
pnpm --dir frontend install --frozen-lockfile
cp .env.example .env && chmod 600 .env
```

> 受限环境提示：若本机 `~/.cache`（uv）或 pnpm 全局 store 不可写，把缓存/store 指到项目内：
> ```bash
> UV_CACHE_DIR="$PWD/.uv-cache" uv sync --group dev
> pnpm --dir frontend install --frozen-lockfile --store-dir="$PWD/.pnpm-store"
> pnpm --dir frontend rebuild esbuild   # 若 pnpm 忽略 esbuild 构建脚本导致 vite 失败
> ```

模型凭证不写入源码或 `.env`；需要在线对话时，启动后到「设置 → 模型服务」填写并连接测试（不影响本地确定性能力）。

## 3. 启动与健康检查

```bash
./scripts/start.sh
curl --noproxy '*' -fsS http://127.0.0.1:8000/api/health
curl --noproxy '*' -I http://127.0.0.1:5173/
```

- 默认端口：Web `5173`，API `8000`。
- 页面：`http://127.0.0.1:5173/`；AP健康：`http://127.0.0.1:8000/api/health`；文档 `http://127.0.0.1:8000/docs`。
- 指定其他端口：`NORTHLIGHT_API_PORT=18100 NORTHLIGHT_WEB_PORT=15180 ./scripts/start.sh`。
- **首次启动时序提示**：若首轮 `start.sh` 报 `[ERROR] API did not become ready`，多为首次初始化运行时 SQLite/内置 Skills 的时序问题；查看 `.runtime/logs/api.log`，初始化完成后重新执行 `start.sh` 即可，不必改代码。

## 4. 停止与数据保留

```bash
./scripts/stop.sh
```

停止只终止本项目记录的前后端进程，不删除 `.runtime/` 。彻底重置前先备份项目；删除 `.runtime/` 会移除本地项目、来源、报告、模型配置与运行记录，不能作为普通排障步骤。

## 5. 回滚策略

- **应用回滚**：无正式版本号仓库（当前目录非 Git 工作树），回滚依赖 `MANIFEST.json` 文件哈希与备份导出包。回滚动作=停止当前服务（`stop.sh`）+ 恢复先前的导出/备份到 `.runtime/` 工作区 + 重新 `start.sh`，并核验 `/.api/health` 与页面。
- **前端/后端单边回滚**：`stop.sh` 后按需替换 `backend/northlight/` 或 `frontend/dist`（生产构建）对应版本，再启动。
- **数据回滚**：备份到 `.runtime/`/导出 zip；恢复为人工，因应用内无项目恢复端点（见 `issue-closure-list.md`）。
- 说明：本手册为候选；**正式回滚演练与证据需 FDE 授权后执行并记录**，现未执行。

## 6. 日志与排障

- API 未就绪：`.runtime/logs/api.log`，确认 8000 端口未被占用。
- Web 不可用：`.runtime/logs/web.log`，确认 5173 端口未被占用，并为 localhost 设 `NO_PROXY=127.0.0.1,localhost`。
- 在线对话无凭证：「设置 → 模型服务」测试并保存；本地查询/建模/报告不受影响。
- 来源 changed：重新画像后再使用，避免沿用旧字段基线。
- 报告缺图：先保存图表 Artifact，再创建新报告版本。
- 脚本 Skill 失败：确认 Docker 已启动并构建 `northlight-python-sandbox:0.1` 镜像。

## 7. 可观测/运维边界

- 运行记录：`.runtime/logs/`、`.runtime/*.pid`；系统概览 `/api/system/overview`。
- 安全：模型/数据库凭证仅存于 `.runtime/settings/connections.json`（`600`）或进程环境，不进入源码、状态响应或导出包；导出包已核对不含 api_key/password/mobile/address 等。

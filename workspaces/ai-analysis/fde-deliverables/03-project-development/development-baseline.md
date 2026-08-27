# DS4-AI 数据分析系统研发基线（候选）

> 基线日期：2026-08-27  
> 代码版本：本目录不是 Git 工作树，无法记录可信 commit SHA；包版本为 0.1.0  
> 状态：候选，等待 FDE 核对和实际运行复验

## 1. 基线范围

- 后端：`backend/northlight/`
- 后端测试：`backend/tests/`
- 前端：`frontend/src/`
- 运行脚本：`scripts/`
- 依赖锁：`uv.lock`、`frontend/pnpm-lock.yaml`
- 研发文档：`docs/`

## 2. 本轮完成的文档验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 标准核心文档 | 已生成 | `docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md` |
| Feature 文档 | 7/7，每个含 spec/plan/tasks | `docs/specs/F001-*` 至 `F007-*` |
| 任务证据 | 已逐项引用现有源码/测试文件 | 各 Feature `tasks.md` |
| 架构与源码台账 | 已生成 | `docs/architecture/architecture.md`、`docs/verification/source-evidence.md` |
| 研发收口产物 | 3/3 | 当前目录三份 Markdown |

## 3. 本轮已执行的运行与验证结果（2026-08-27）

### 3.1 依赖安装（已真实执行，均为退出码 0）

| 命令 | 结果 | 备注 |
|---|---|---|
| `uv sync --group dev` | 通过 | 因沙箱限制 `~/.cache` 不可写，使用 `UV_CACHE_DIR=.uv-cache` 将缓存置于工作区 |
| `pnpm --dir frontend install --frozen-lockfile` | 通过 | store 指到工作区 `--store-dir=.pnpm-store`；esbuild 构建脚本被 pnpm 忽略，已执行 rebuild 补装二进制 |

### 3.2 服务启动与页面验证（已真实执行）

| 检查 | 结果 | 证据 |
|---|---|---|
| `./scripts/start.sh` | 成功，输出 `DS4 is ready at http://127.0.0.1:5173` | `.runtime/logs/api.log`、`web.log`；端口 5173/8000 监听 |
| 前端 `http://127.0.0.1:5173/` | HTTP 200 | 页面标题「DS4-AI数据分析系统 · 赋范空间团队」 |
| 后端 `http://127.0.0.1:8000/api/health` | `{"status":"ok",...}` | 健康接口返回正常 |
| OpenAPI `http://127.0.0.1:8000/openapi.json` | HTTP 200，OpenAPI 3.1.0 | 57 个路径，含 `/api/health` |
| Swagger `http://127.0.0.1:8000/docs` | HTTP 200 | FastAPI 文档可用 |

> 备注：首次 `start.sh` 因初始化数据库/内置 Skills 存在启动时序，健康检查未在首轮通过；初始化完成后重跑即成功。当前服务保持运行。

### 3.3 静态检查与测试（已真实执行）

| 命令 | 结果 | 证据 |
|---|---|---|
| `uv run ruff check backend scripts` | 通过 | `All checks passed!` |
| `uv run mypy backend/northlight` | 通过 | `Success: no issues found in 21 source files` |
| `uv run pytest -q` | 59 passed, 2 skipped | 沙箱集成用例因镜像未构建而跳过（docker 依赖） |
| `pnpm --dir frontend test` | 20 passed (9 files) | vitest 运行通过 |
| `pnpm --dir frontend build` | 通过 | `tsc -b && vite build` 成功产出 `frontend/dist/` |

### 3.4 本轮未执行（待 FDE 在目标环境复验）

- Playwright 端到端（`pnpm ... test:e2e`）：需 Chromium 运行时，本轮未执行。
- 沙箱集成（`test_skill_sandbox_integration.py`）：需 Docker 镜像，本轮跳过。
- Olist 数据 / MySQL 直连 / 百万行性能（可选能力）：依赖目标环境与数据，本轮未验证。

## 4. 已知风险与未确认项

- 本目录没有 Git 元数据，无法把候选基线绑定到不可变 commit；可用 `MANIFEST.json` 的文件哈希做交付包参考，但新增 docs 不在原清单中。
- **开发前代码评估发现的缺口**（详见 `fde-deliverables/03-project-development/code-readiness-assessment.md`，候选结论）：字段画像缺 min/max（FR-3）、模型可复现元数据不完整/划分参数未登记/潜在 target 泄漏（FR-7）、离线时部分确定性能力不执行（FR-11）、样本外发边界与导出包脱敏（安全）、性能验收未闭环（PA-1）、前端报告路由/画像统计量/参数化 UI 等。这些属开发收口前需评估或排期的剩余项，不代表本轮测试失败。
- 计划日期、正式里程碑和交付承诺没有事实依据，保持待确认。
- 在线模型、MySQL、Docker 沙箱、Olist 数据和百万行性能依赖目标环境，不能由源码存在推断可用。
- 多人鉴权、正式部署、PDF/Word 报告和业务指标最终口径不在当前已验证产品范围。

## 5. FDE 确认记录

- FDE 审阅人：待填写
- 审阅时间：待填写
- 核心旅程复验：待执行
- 是否进入验证评估：由 FDE 在项目进度页决定

> 本文件存在只满足“可提交”的文件条件；不得把候选基线表述为已经验证或已经交付。

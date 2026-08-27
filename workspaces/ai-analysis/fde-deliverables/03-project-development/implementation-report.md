# 项目开发实施报告（候选）

> 项目：DS4-AI 数据分析系统  
> 版本依据：`pyproject.toml` / `frontend/package.json` 均为 0.1.0  
> 整理日期：2026-08-27  
> 状态：候选研发收口产物，尚未代表 FDE 已确认进入验证评估

## 1. 已实现范围

当前源码已经形成七个可独立追踪的产品 Feature：

1. 项目与数据资产管理：项目生命周期、独立 workspace、全局资产、项目绑定、画像、指纹和来源恢复。
2. 安全查询与数据探索：CSV/Excel/SQLite/MySQL 只读查询、AST/范围限制、结果产物、分页、筛选、下载和图表。
3. 数据质量、清洗与特征工程：非覆盖式画像、清洗、特征和 lineage。
4. 机器学习训练与预测：分类、回归、聚类、后台 Job、取消、指标、复现代码和预测产物。
5. Agent 对话、运行与 Skills：意图路由、Run/Step、流式工具、重试/取消、内置/上传 Skill 和无网络沙箱。
6. 产物血缘、可视化与版本化报告：Artifact 关系、图表、报告证据审计、不可变版本、恢复和 HTML。
7. 运行配置、沙箱与系统管理：本地启停、健康、模型/MySQL 配置、凭据保护和可选数据/性能脚本。

详细需求、跨 Feature 规则和任务证据分别见：

- `docs/PRD.md`
- `docs/specs/product-spec.md`
- `docs/specs/feature-map.md`
- `docs/specs/F001-*` 至 `docs/specs/F007-*`
- `docs/verification/source-evidence.md`

## 2. 关键实现边界

- 本地优先、单用户；不提供生产数据库写回、自动营销触达或多人审批。
- 项目数据、来源、运行、产物和报告以 ProjectId 隔离。
- SQL 只读，文件函数和 MySQL 表范围由服务端限制。
- Agent 生成文本不等于产物；只有 Repository 登记的 Artifact 才进入血缘与报告。
- 模型/数据库凭据不进入仓库、普通状态响应、Artifact 元数据或项目导出。
- 报告当前固定交付为 Markdown 版本和 HTML，PDF/Word 仍未成为已实现固定范围。

## 3. 已有验证资产

- 后端：Ruff、Mypy、Pytest 配置和 11 个测试模块，覆盖项目、资产、查询、分析、模型、Agent、报告、Skills、设置和沙箱。
- 前端：Vitest 组件/页面测试、TypeScript/Vite build 和 Playwright e2e 配置。
- 运行：`scripts/start.sh`、`stop.sh`、健康接口和可覆盖端口。

本报告只说明这些源码和测试资产存在；**本轮实际执行结果以 `development-baseline.md` §3 为准**（依赖安装、服务启动与页面/健康/OpenAPI 验证、ruff/mypy/pytest/vitest/build 均已实跑通过；e2e 与沙箱集成本轮未执行）。

## 3.1 本轮运行与验证事实（2026-08-27）

- 已补齐 `AGENTS.md`（依据 README/INSTALL/start.sh 的真实启动说明），并完成依赖安装（`uv sync --group dev`、`pnpm install`，缓存/store 指到工作区、esbuild 已重建）。
- 服务已由「项目运行」终端真实启动并验证：前端 `http://127.0.0.1:5173` HTTP 200、后端 `/api/health` 返回 ok、OpenAPI 3.1.0（57 路径）与 `/docs` 可用；服务当前保持运行。

## 3.2 开发前代码评估（候选，供后续排期）

针对 PRD 功能项（FR-1~14）与安全要求，已完成一次静态代码支撑度评估，结论与缺口见 `fde-deliverables/03-project-development/code-readiness-assessment.md`（候选）。其主要剩余项已记入 `development-baseline.md` §4，属收口前需评估或排期的项，不代表本轮测试失败。

## 4. 剩余项与风险

- 正式项目计划起止日期和里程碑日期没有事实依据，仍为待确认。
- 多人并发、账号鉴权和审批不在当前单用户基线中。
- PowerShell 原生运行未验证，Windows 建议 WSL2。
- Docker、MySQL、Olist 数据和在线模型属于可选外部依赖，需要在目标机器单独验证。
- 业务指标口径、模型业务阈值和最终验收样本仍需 FDE/客户确认，不能由源码测试替代。

## 5. FDE 收口检查建议

FDE 在进入验证评估前应核对：本报告、运行手册、研发基线、七个 Feature tasks 的证据路径、目标机器启动结果、核心用户旅程以及仍保留的业务未决项。三份文件存在只代表“可提交”，不是自动通过。

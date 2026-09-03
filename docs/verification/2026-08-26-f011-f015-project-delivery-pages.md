# F011～F015 项目交付页面验证记录

## 验证范围

本记录覆盖独立“项目进度”页面、项目 API 文档与 OpenAPI 工具、项目级系统架构、项目观测、项目评估，以及 F010 会话内“交付流程”页签移除。验证不包含浏览器自动点击、截图、视觉对比或真实付费模型调用。

## 固定第三方来源

| 能力 | 固定来源 | 许可/边界 |
|---|---|---|
| OpenAPI | `dsh-openapi@fb854355b89e495ded090b9e2eb94c33430d2366` | MIT；复用 parser/catalog/http 模块，不挂载跨项目共享的静态目录 |
| 系统架构参考 | `dsh-planchart@e63a6359ed43e6ae35cac505f10a8d128f53eba7` | MIT；只复用分组/节点/关系思路，不安装 Session steps overlay |
| 观测 | `dsh-observe@0.2.0` / `64791ff93ac01bac5bb6e6a14f48d072b479464b` | Apache-2.0；Bundle 默认 disabled、无后端、关闭 Prompt/Completion 采集 |
| 评估 | `dsh-eval-harness@2f59376e2a2f22c151f75de446d5cde764dd5aff` | package 声明 MIT、仓库根缺少 LICENSE；作为固定 Git 依赖构建，不复制源码 |

## 实现与测试证据

| 检查 | 结果 |
|---|---|
| `pnpm install` | 退出 0；固定 Git 评估包完成 prepare/build；历史 DSH 精确依赖重定向到当前锁定 checkout |
| `pnpm exec tsc -b tsconfig.host.json tsconfig.client.json` | 退出 0 |
| `pnpm exec vitest run packages/fde/project/tests packages/client/ui-fde-project/tests packages/client/ui-fde-stage/tests` | 8 个测试文件、18 项测试通过；包含评估跨项目路径、dsh_bin/Profile、Judge 和符号链接拒绝 |
| `dsh-observe` 固定源码 `pnpm test` | 18 个测试文件、119 项测试通过；覆盖配置、脱敏、sink、队列、缓冲、失败服务和组合；没有模型调用 |
| `dsh-eval-harness` 固定源码 `pnpm test` | 10 个测试文件、231 项测试通过；覆盖 YAML、Trace、断言、报告、Baseline gate、重试、Trial、超时和无模型 runner fixture |
| F011～F015 相关路径 OxcLint | 退出 0；范围为 `ui-fde-project`、`fde-project`、F010/F002 直接受影响包与 tool catalog generator |
| `pnpm run build` | 退出 0；Host/Client bundles 与 Vite Web dist 完整生成，记录 207 个 Client artifacts |
| `pnpm run doc-sync` | 28 个文档门全部通过，包括双语配对、配置/工具/Client/Cordis 目录、链接、格式、预算和站点构建 |
| `http://127.0.0.1:3080/` | HTTP 200 |
| `ui-fde-project` Client bundle | HTTP 200；构建产物包含“项目进度”“API 文档”“系统架构”“项目观测”“项目评估” |
| `POST /api/fde-project/snapshot` | 数据分析项目返回 `api=configured`、系统架构 `revision=1`、16 节点、评估用例 0 |

全库 `lint:contracts-ready` 曾命中当前脏工作树已有的 `ui-workspace`、`ui-fde-sources` 分层/类型和缩进债务；本轮新增与直接调整路径已经单独清零并通过 TypeScript、聚焦测试与完整构建。本轮未扩大范围修改这些既有问题。

## 当前运行状态

- 使用隔离 `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`。
- 当前服务地址：`http://127.0.0.1:3080`。
- 当前统一执行会话：`85120`；监听进程 PID 在最终检查时为 `35657`。
- 数据分析项目 WorkspaceId：`22caf7a1-28f1-4590-aa62-6500f166eb8b`。
- 为人工查看准备了真实项目配置：`/Users/muyu/test/ai-analysis/.fde/api-docs.json` 与 `/Users/muyu/test/ai-analysis/.fde/architecture.json`。架构内容根据该项目 README、FastAPI、Agent Runtime、分析能力和存储源码整理，保持候选状态，不替用户执行确认。

## 未执行与人工检查项

- 未运行浏览器自动化、截图、录屏或视觉对比；页面布局、主题、窄窗口、项目切换、架构导出和确认动作等待用户手动验收。
- 未启动数据分析项目的 8000 API 服务；“API 文档”当前只证明真实地址已配置，不声称服务已连接。服务启动后可内嵌或从外部入口打开。
- `dsh-observe` 保持 disabled，没有采集、缓冲或向 Langfuse/OTLP 外发当前项目数据；实际外部后端状态需要配置后单独联调。
- 数据分析项目没有评估 YAML，因此页面显示真实空状态；没有运行任何付费 Trial。固定 runner 未提供可靠独立取消，页面明确不显示假取消。未来运行的 output、overlay、Session 和工作副本留在项目 `.runtime/fde-evaluations/`，只发布两份报告文件。
- 评估报告与正式候选源码版本、阶段交付门的绑定仍由 F005/F006 消费；当前评估页面本身不会推进项目阶段。

## 临时产物清理

公开插件调研与测试使用的 `/tmp/fde-feature-vendors.ab9OUU` 在测试后约 240 MiB，来源均可从固定公开提交再生；目录及依赖树已经删除，没有删除项目文件或唯一交付物。

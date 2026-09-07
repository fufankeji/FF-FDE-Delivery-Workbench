# 第五阶段信息工作台验证

日期：2026-09-07。目录：`FDEDeliveryWorkbench` 主工作树；分支：`main`。只修改系统 Spec、工作台和数据投影，不开发或执行客户项目，不操作 3081。

## 本轮结果

第五阶段保留“运行 PoC 与 Eval”，开发完全留在已有 Agent 对话。首页展示受测范围与版本、共享运行状态与操作、指标结果及来源／证据、未解决条件、固定报告与人工阶段验收；记录在正文按需展开。没有开发任务看板、开发进度百分比或额外任务门槛。

新增 `evaluation.candidate` 与 `evaluation.testing` 投影和只读 `project_evaluation_get`，沿用 `.fde/stages/evaluation.json`、四个固定工作项 ID 及三份固定产物。指纹绑定显式候选文件内容、版本、环境、指标和依据；过期、缺失、无证据及必测项未通过不允许阶段验收。既有 V1 验证合同、Agent Trial、运行操作与其他阶段保持原入口。

## 已执行检查

命令均在 `upstream/deepseek-harness` 执行，规格校验除外。以下记录各项最终成功结果，不将组件测试视为真实浏览器验收。

| 检查 | 命令／范围 | 结果 |
|---|---|---|
| Host 版本与证据 | `corepack pnpm exec vitest run packages/fde/project/tests/evaluation-workbench.spec.ts` | 14 项通过；文件、版本、环境、阈值、来源变更导致 STALE，缺失、失败、警告、重复 ID、越界与符号链接均不被伪装为通过；无需开发任务清单 |
| 原项目投影兼容 | `corepack pnpm exec vitest run packages/fde/project/tests/project.spec.ts` | 23 项通过，覆盖直接关联的旧投影与验证合同 |
| 阶段指令 | `corepack pnpm exec vitest run packages/fde/stage/tests/stage.spec.ts` | 24 项通过；保留七个既有第五阶段方法和固定 stage 身份，不增加开发流程 Skill |
| 页面交互 | `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx` | 24 项通过；其中新增 7 项覆盖第五阶段空态、指标、证据预览、运行／架构复用、草稿准备、失败／过期、人工确认、返回及历史只读 |
| 类型 | `corepack pnpm exec tsc -p packages/{client/ui-fde-project,fde/project,fde/stage}/tsconfig.json --noEmit --pretty false`（三个包分别执行） | 均退出 0 |
| 定向静态检查 | 对新增投影、只读工具、面板和投影测试执行 `corepack pnpm exec oxlint` | 修正新面板换行与箭头参数格式后通过 |
| 客户端构建 | `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | 构建成功；生成物在既有忽略目录，不纳入 Git |
| 产品规格 | `validate_prd.py --require-confirmed`、`validate_product_spec.py --require-confirmed`、`validate_feature_specs.py --feature F009 --require-ready` | 均通过；PRD 原有超过 12 项需求的提示保留 |
| 既有文档配对 | `verify-translation-pairing`，仅生命周期 Agent Note、Host 和 Client 包 README 三组 | 三组通过；根目录产品规格保持简体中文单一来源 |

初次阶段指令检查暴露新短提示遗漏既有方法提示及固定 stage 声明，已补回兼容约束；未删除原断言或弱化要求。全仓 lint、doc-sync、计费模型运行和完整 Web E2E 不在本轮最窄验证范围。

## 3080 运行检查

- 重载前通过只读 `session.list` 确认无 Agent 正在运行；测试项目运行状态为 `stopped`。
- 另一个已登记项目的 5173/8000 服务由独立进程维护，重载前后 PID 8373/8351 保持存在；未终止这些进程。
- 3080 监听 PID 47996 使用主工作树及显式 `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`，主页返回 HTTP 200。
- 从主页 `globalThis["__DSH_BOOT__"]` 读取真实客户端 URL，在线 Bundle 返回 200，包含“项目运行与验证”，不包含新增开发任务门槛文案。
- 对已登记 Workspace `c4247945-6e07-498b-8bf4-f95bee3a7133` 调用只读 snapshot：`evaluation.status=missing`、指标为空、`reviewReady=false`、项目运行状态仍为 `stopped`。未登记数据保持缺失，不填演示结果；客户项目未被本轮写入。
- 主隔离运行区仍保留原有 3 个 Workspace；未复制、迁移或删除用户项目和 Session。

## 待人工确认与边界

- 按 [第五阶段手动测试](../manual-tests/stage-05-evaluation/README.md) 检查实际窗口下的信息层级、表格内部横向滚动、页面底部不被输入框覆盖，以及项目记录展开效果。未自行打开浏览器、截图或录屏。
- 真实项目开发、业务测试、模型效果、完整 UAT 和客户验收尚未执行。F009 的其他未完成任务继续保持未完成。
- 文件指纹只覆盖显式清单；文件可读取不证明报告内容真实，FDE 仍须核对原始证据及范围。历史页读取已有文件，不声称持有过去文件的不可变快照。
- 本轮按用户确认提交本地 Git，不推送 GitHub。

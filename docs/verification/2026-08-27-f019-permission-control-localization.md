# F019 权限控件中文化验证

## 范围

- Feature：F019 权限控件中文化
- 分支：`feature/fde-small-optimizations`
- Worktree：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.worktrees/fde-small-optimizations`
- 基线：`ed6a99dfe4489d970966bb3320bd304fb4eb0268`
- Feature 提交：`f08f286b8fcf3e20797a67cf59a2473cc8c8bed5`（`feat(fde): localize permission controls`）
- 用户可见目标：中文界面的对话输入栏、设置页和命令弹出选择器显示 `只读`、`工作区写入`、`完全访问`；输入栏菜单说明三种权限后果，并以红色风险文案和图标突出完全访问；完全访问风险确认使用完整中文。
- 保持项：权限 ID、`/permission` 命令、Settings 持久值、默认权限、确认状态机、英文 locale 和 Host 自定义名称。

## 规格证据

| 检查 | 结果 |
|---|---|
| `validate_prd.py . --require-confirmed` | exit 0；PRD confirmed，22 个 REQ、10 个 NFR、21 个 AC |
| `validate_product_spec.py . --require-confirmed` | exit 0；Product Spec confirmed，27 个 PSC |
| `validate_feature_specs.py . --feature F019 --require-ready` | 用户反馈增量后 exit 0；F019 Spec/Plan ready，6 个任务格式与追踪有效，无错误或警告 |

## 实现与构建证据

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run` 三个权限聚焦测试文件 | exit 0；3 个文件、86 项全部通过 |
| `pnpm exec vitest run packages/client/ui-conversation/tests/input-bar.client.spec.tsx` | 风险菜单增量后 exit 0；1 个文件、77 项全部通过；精确断言菜单标题、三项说明和完全访问风险样式类 |
| 两个权限包定向 `tsc -b` | Host 生成类型就绪后 exit 0 |
| 11 个改动 TS/TSX 文件定向 `oxlint` | exit 0 |
| `ui-conversation` 与 `ui-permission-presets` 双包 bundle | exit 0 |
| 两份 README 双语配对定向校验 | exit 0；2 对文档一致 |
| Client `tsdown --env.DSH_BUILD_FACE client` | exit 0；为独立 Web 预览生成 Client 工件 |
| `pnpm run build:web` | exit 0；Vite 转换 336 个模块并生成生产静态资源 |
| `curl http://127.0.0.1:3181/` | HTTP 200 |
| 读取 3181 实际服务的两个权限插件包 | 两个包均检出 `只读`、`工作区写入`、`完全访问` |
| 核对 3181 Profile 的 `ui-conversation` 实际解析路径与工件 | 解析到 Feature worktree；运行工件检出菜单标题、完全访问后果说明和 `state-warn-label` 风险样式 |

聚焦测试同时证明：中文内置名称一致；输入栏菜单展示与 Studio 相同的标题和三项权限后果；完全访问复合项带风险文案与图标样式；完全访问必须勾选后才能提交；取消不改变权限；确认仍提交 `danger-full-access`；英文内置名称保持原文；复用内置 ID 的 Host 自定义名称保持原样。

## 隔离运行

- 页面：`http://127.0.0.1:3181`
- DSH_HOME：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/fde-small-optimizations-main-snapshot`
- 数据来源：从 main 的 `.runtime/dsh-home` 一次性复制 `sessions`、`storages` 与 `attachments`；保留 Feature 自己的 `profiles` 和设置，明确未复制 `.credentials.yaml`、`.anonymous-user-id`、`llm-deepseek` 或 main Profile。
- 快照文件核对：main 与 Feature 的 `workspace.json`、`fde_stage.json`、会话目录和附件目录一致；Feature 快照约 1.4 MiB。
- Host 投影核对：`workspace.list` 返回 1 个 `数据分析项目`，路径 `/Users/muyu/test/ai-analysis`，关联 3 条会话；`session.list` 返回 3 条历史会话且 cwd 均为该真实 Workspace。
- 隔离边界：main 继续在 3080 运行，Feature 在 3181 运行，两边不共写 DSH_HOME。Workspace 文件路径按用户要求保持同一真实目录，因此在 3181 编辑项目文件会同时被 main 看见；Session、阶段与附件后续写入留在 Feature 快照。
- 源码边界：Feature worktree 提交后干净；main checkout 仍保留主会话自己的未提交改动，本轮未在 main 中切分支、构建、暂存或修改源码。

## 未执行项与已知基线问题

- 按项目的人工优先约束，未运行完整浏览器回放、自动截图或视觉对比；页面保留给用户手动验收菜单风险色、项目侧栏、工作区与历史会话。
- `pnpm run build:lib:client` 的聚合 TypeScript 阶段仍会在未修改的 `packages/client/ui-fde-document-preview/src/client/index.ts` 失败：`size: number | undefined` 不能赋给启用 `exactOptionalPropertyTypes` 后的可选 `number`。F019 两个包的定向类型检查与 bundle 均通过，本轮没有扩大范围修复该基线问题。

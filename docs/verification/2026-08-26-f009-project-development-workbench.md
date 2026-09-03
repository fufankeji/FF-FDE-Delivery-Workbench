# F009 项目开发工作区验证记录

日期：2026-08-26  
状态：实现已接入，待用户人工确认页面布局与文件行为

## 本次范围

- 把左侧开发者布局作为 F009 当前切片：项目/会话与文件/Git 共用左栏，中部显示代码或 Diff，右侧保留官方项目对话。
- 锁定并组合 `@lsq64737/dsh-workbench-layout@0.1.5`，对应社区源码提交 `e74b1a281e3e0a791cb2a934c966e4c5135f6e16`，MIT License。
- 不同时安装右侧 `dsh-better-sidebar` 与 `dsh-file-review-tab`，避免双工作台；当前 Git Diff 不冒充按 Agent/会话/轮次归因的审查。

## 规格证据

| 检查 | 结果 |
|---|---|
| `validate_prd.py . --require-confirmed` | exit 0；14 个 REQ、9 个 NFR、13 个 PRD AC |
| `validate_product_spec.py . --require-confirmed` | exit 0；17 个 PSC，全部需求与 AC 已覆盖 |
| `validate_feature_specs.py . --feature F009 --require-ready` | exit 0；F009 spec/plan/tasks 定向校验通过 |

## 实现与运行证据

| 命令/观察 | 结果 |
|---|---|
| `corepack pnpm install` | exit 0；安装 `@lsq64737/dsh-workbench-layout@0.1.5` 及 21 个依赖项；`node-pty@1.1.0` 原生安装成功 |
| `corepack pnpm why @lsq64737/dsh-workbench-layout` | Web App 仅解析到一个 `0.1.5` 版本 |
| `dsh --profile web --dump-config` | `fde-workbench-layout` row 存在，注入 `webRuntime` 与 `workspaceRegistry` |
| `corepack pnpm run build` | exit 0；Host/Client、Vite Web 全部构建成功；记录 203 个 Client artifacts |
| `pnpm patch-commit` | exit 0；生成 `patches/@lsq64737__dsh-workbench-layout@0.1.5.patch`；改为左侧 Activity Rail 后的最终 lockfile patch hash 为 `c7bef9e449d1c0619ab7aa13e5a821363114ec892819040fc9870960fa6e8fb8` |
| patch 后重新执行 `corepack pnpm run build` | exit 0；相关输入变化后的最终官方构建通过 |
| 重启 `dsh web --no-open --host 127.0.0.1 --port 3080` | 当前运行会话 `37202`；日志输出 `dsh web: http://127.0.0.1:3080` |
| `GET /` | HTTP 200 |
| 首页 `__DSH_BOOT__` | 包含 `@lsq64737/dsh-workbench-layout` 及其 Client URL |
| `GET /plugins/@lsq64737/dsh-workbench-layout/client.js?...` | HTTP 200，`text/javascript`，约 1.94 MB |
| `GET /dsh-workbench-layout/tree` | HTTP 405＋`METHOD_NOT_ALLOWED`，证明 Host route 已注册且只接受受信 POST |
| 当前服务器工作台 Client 内容 | 包含 `sidebarMode: "sessions"`、`editorExpanded: false`、中文模式名“项目”和“选择一个项目后浏览文件” |
| FDE Sidebar Activity Rail | FDE 组合下 Client 标记回退宿主并注入 `44px minmax(0, 1fr)` 两列布局；四个模式以竖向纯图标＋Tooltip 呈现，项目/文件内容位于右列；语法检查、完整构建与最终 Client 提供均通过 |

## 未自动执行

- 遵循项目的人工优先协同验收约束，本次没有运行 Playwright、浏览器截图、视觉对比或完整 Web E2E。
- 以下项目等待用户在当前 3080 页面手动确认：左侧模式入口与列顺序；会话模式能否完整恢复现有项目树；文件打开/保存；外部变化冲突；Git/非 Git Diff；两个项目切换时是否串文件。

## 已知边界与风险

- 插件要求 Node.js `>=24.0.0`；当前本地环境满足，正式发行若需兼容 Node 22 必须另做选型或适配。
- 插件使用官方 AppFrame 的稳定 DOM 标记重排列，Harness 升级仍需兼容验证。
- 插件同时提供终端和较完整 Git 操作，但当前 F009 验收只覆盖文件、文本编辑、外部变化和 Diff；这些额外入口不会被自动调用。
- 当前没有按 Agent、Code Mode、子代理和轮次持久归因的独立审查列表；官方工具 Diff 和 Git Diff 保持各自真实语义。

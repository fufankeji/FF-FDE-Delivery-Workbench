# F009 右侧项目开发工作台验证记录

日期：2026-08-26  
状态：右侧插件组合与 Agent 文件树自动刷新修复已运行，待用户人工确认文件行为

## 产品纠正

- 被否定方案：顶部横向模式条、左侧 Activity Rail、文件/项目共用同一业务导航。
- 当前方案：左侧只保留“项目 → 会话”，中央保留官方 Conversation；Files/Editor、Git Diff 与 Agent File Review 进入唯一、可收起的右侧 Dock。
- 参考模式：`DSH-better-sidebar` 与 `dsh-workbench` 均采用对话旁的右侧独立工作区；本项目选择可扩展 Tab 底座并组合文件审查。

## 锁定依赖

| 包 | 版本 | 来源提交 | 许可证 | 用途 |
|---|---:|---|---|---|
| `dsh-better-sidebar` | `0.16.1` | `f9153dfc1ce47cf43445c1b351ee3ae47b4ad9f1` | MIT | 右侧 Files/Editor/Git/Diff 底座 |
| `dsh-file-review-tab` | `0.2.0` | `31ef012c00708e9afe22b4eeff5740ee532c98da` | MIT | 对话尾部改动摘要与右侧会话/轮次文件审查 |

`@lsq64737/dsh-workbench-layout@0.1.5`、`fde-workbench-layout` row、release-age 例外和 `patches/@lsq64737__dsh-workbench-layout@0.1.5.patch` 已从最终依赖与配置中移除。

## FDE 裁剪

- Better Sidebar patch hash：`f39a168385d02961fac5bd78bb217820972eeec5074ff1234c6ae4a3fc667f9d`。
- 新项目会话默认展开右侧 Dock。
- 默认保留 Files/Editor、Git、Diff 与外部 File Review Tab。
- 默认禁用 Subagent、Side Chat、Browser、Terminal 与模型终端工具。
- 隐藏底部工作台入口并关闭底部自动终端。
- 官方 `ui-deliverables` row 禁用，由 File Review 的 turn-tail 改动摘要接管。
- 当前 Session 成功完成 `write/edit` 或 Code Mode 嵌套文件变更后，文件树在 300ms 合并窗口后刷新根目录、已展开目录和当前搜索；流式文本与只读工具不触发刷新。

## 验证证据

| 检查 | 结果 |
|---|---|
| PRD confirmed 校验 | exit 0；14 个 REQ、9 个 NFR、13 个 PRD AC |
| Product Spec confirmed 校验 | exit 0；17 个 PSC，需求与 AC 全部覆盖 |
| F009 定向 Feature 校验 | exit 0 |
| `pnpm why` | Better Sidebar 与 File Review 均只有一个锁定版本，File Review 解析到同一 Better Sidebar |
| `dsh --profile web --dump-config` | `ui-deliverables` disabled；`fde-workbench` 与 `fde-file-review` rows 存在；无 Workbench Layout row |
| 外部包语法检查 | Better Sidebar 与 File Review 的 Host/Client bundles 均通过 `node --check` |
| `corepack pnpm run build` | exit 0；官方 Host/Client 与 Vite Web 完整构建通过，记录 203 个 Client artifacts |
| 当前服务 | 运行会话 `90987`；`http://127.0.0.1:3080` 返回 HTTP 200 |
| Boot Manifest | 包含 `dsh-better-sidebar` 与 `dsh-file-review-tab`，无 `dsh-workbench-layout` |
| Client 提供 | Better Sidebar Client HTTP 200，约 1.25 MB；File Review Client HTTP 200，约 267 KB |
| Host route | `GET /sidebar/api/fs.tree` 返回受控 HTTP 405 `method not allowed`，证明 Host prefix 已注册 |
| 最终 Better Sidebar Client | rev `a030e7e357e5`，1,249,078 bytes；包含 `openByDefault: true`、禁用 Tab 默认值、隐藏底部按钮，以及 Session snapshot 驱动的文件树刷新链路 |
| Agent 文件树刷新实现 | Client 语法检查通过；同时识别已完成工具节点和运行中 Code Mode 的嵌套工具结果，成功变更后只增加一次 tree `refreshTick`，不使用轮询 |
| 用户故障样本核对 | `数据分析项目` 的真实 Session Log 在 seq 3458/3459 记录 `write` 调用及成功结果，目标 `INSTALL.md` 已真实落盘；该事件形态由新增订阅直接覆盖 |

## 待人工确认

- 左侧项目/会话和中央对话是否完全保持原层级。
- 右侧 Dock 是否默认展开、只显示 Files/Git/Review 所需入口，并能正常收起。
- `数据分析项目` 文件树是否直接显示 `frontend/`、`backend/` 等源码。
- 硬刷新页面后，让 Agent 新建一个文件，确认文件无需点击刷新按钮即可出现在右侧 Files；可同时展开一个子目录检查嵌套文件更新。
- 文本打开/保存、Git 非仓库降级、Agent 文件审查与项目/会话切换是否符合预期。

按协同验收约束，本次没有运行 Playwright、浏览器截图、视觉对比或完整 Web E2E。

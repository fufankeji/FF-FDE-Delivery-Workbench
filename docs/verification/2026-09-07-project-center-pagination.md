# 项目中心参考图调整与多项目浏览

日期：2026-09-07。状态：实现完成，待人工视觉确认。

## 范围

- 对应 F011 / AC-F011-019 / T033；参考 `/Users/muyu/Desktop/首页.png`（1536×1024）。
- 仅修改项目中心概览、对应组件测试和 F011 文档；不改产品介绍首页、阶段页面、后端、人工阶段门或 FDE-Agent 数据。
- 优先事项、四项指标、卡片及底部摘要均复用真实项目派生数据。参考图中的演示头像和固定通知数不复制；文档插画为纯装饰 SVG。
- 项目集合先搜索名称/企业、筛选和排序，再按 6 项分页；保留卡片、列表和完整周期视图。底部动态默认 3 条，展开后滚动；周期默认 2 个已登记项目，并有全部入口。

## 已执行检查

以下构建命令在当前 worktree 的 `upstream/deepseek-harness/` 执行。

| 检查 | 结果 |
|---|---|
| 定向 Vitest：`packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx` | 退出 0，10 项通过；新增 13 项目测试覆盖翻页、搜索/清空、卡片与列表切换、数据减少、全量摘要和真实导航回调 |
| `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` | 首次发现可选优先项目参数不符合严格类型约束；修正为显式允许 undefined 后退出 0 |
| `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | 退出 0；平台提示为 Linux 可选包在 macOS 不适用，未阻止构建 |
| `git diff --check` | 退出 0 |
| 隔离预览 | `http://127.0.0.1:3081` 返回 200；新监听 PID 44669，工作目录为本 worktree 的 `upstream/deepseek-harness`，`DSH_HOME=../../.runtime/dsh-home` |
| 隔离 Workspace 登记 | 三个 Workspace 均指向本 worktree 的 `.runtime/workspaces/`，不混用主工作树或全局可变数据 |
| 在线 Client Bundle | 从首页 Boot Manifest 读取 `/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=7b363cdd83ea`；HTTP 200，包含 `data-project-center`、`项目分页`、`搜索项目或企业`、`projectCompactCard`，不含旧固定通知文案或 `demo-avatar.png` |

启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3081`。仅重启已核实属于本 worktree 的旧 3081 Host，未停止主工作树 3080 或既有数据同步进程。

## 未验证项

### 本次人工返修：底部留白与字号偏大

- 用户当前缺陷图：`codex-clipboard-2ycRtv.png`，图片 1818×1203，CSS 视口/DPR 未确认。源码原因是概览主容器沿用 `display: block`，摘要、集合和底部详情只按各自高度堆叠，不吸收剩余视口高度。
- 本次仅调整 CSS：主容器恢复纵向 Flex；桌面三个主要区块分配额外空间，项目卡片内部均衡间距；内容超过一屏时保持面板最低内容高度并让页面滚动，窄容器使用自然高度。周期无记录时提示居中，不造记录填空。
- 字号：页面标题 34→28，优先事项标题 28→23，项目卡片标题 21→17，集合标题 22→18，底部分区标题 18→16，指标 40→32；正文/控件降至 13–14px，原有小号辅助文字保留。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` 退出 0。仅 CSS 改动，不重复此前已通过的 10 项组件行为测试，也不把该结果作为本次布局证据。
- 重新启动隔离 3081：PID 45926。首页与 Boot Manifest 指向的 `client.js?rev=c436a923d25a` 均返回 200；在线压缩 CSS 包含本次 Flex 和标题、卡片、指标字号规则。首次在线探针因查找未压缩 CSS 字符串未匹配，按实际 Bundle 压缩格式更正匹配方式。
- 两项返修仍待用户实际视口复核；未执行自动化浏览器和截图比较。

遵守仓库人工优先规则，本轮未打开自动化浏览器、未截图、未运行像素比较。以上结果不代表已经达到像素级 1:1。参考图的字号、玻璃插画、卡片密度与宽屏/窄屏实际观感，交由用户手动确认；T033 保持未勾选。分页验证使用测试内数据，不向真实工作区创建虚构项目。

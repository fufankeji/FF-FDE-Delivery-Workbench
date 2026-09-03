# F021 工作区布局稳定性验证

## 范围

- Feature：F021 工作区布局稳定性
- 分支：`feature/fde-small-optimizations`
- Worktree：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.worktrees/fde-small-optimizations`
- 基线：`f08f286b8fcf3e20797a67cf59a2473cc8c8bed5`
- 用户可见目标：从对话“已编辑文件”直接打开差异时，右侧 Dock 顶部、底部和审查标题完整；左侧折叠栏的“新建项目”与“搜索会话”保持 12px 间距。
- 保持项：Diff 内容与归因、撤销行为、Dock 宽度和 Tab、左侧展开态及搜索状态机、项目和 Session 数据。

## 复现与根因

| 问题 | 修复前真实 3181 证据 | 根因 |
|---|---|---|
| 右侧差异页上下裁切 | 点击审查前 Host `scrollTop=0`、Dock `top=0/bottom=1218`；定位后 Host `scrollTop=80`，Dock 变为 `top=-80/bottom=1138` | Better Sidebar 的固定 Host 使用 `overflow:hidden`，会成为可被 File Review `scrollIntoView()` 程序滚动的外层容器 |
| 左栏两个操作间距过大 | 两个 36px 按钮的实际可见间距为 60px | 新建项目后的 12px 间距之外，折叠态仍保留 36px 空 `sectionHeader` 和其后的 12px 间距 |

修复保持现有结构：Dock Host 改用 `overflow:clip`，继续裁切收起面板但不再可程序滚动；File Review 的内部 `.body` 仍是可滚动容器。WorkspaceBrowser 只在 `.rail` 状态隐藏内容为空的 `sectionHeader`，展开态不受影响。

## 规格与实现证据

| 检查 | 结果 |
|---|---|
| `validate_feature_specs.py . --feature F021 --require-ready` | exit 0；F021 Spec/Plan ready，4 个任务格式与追踪有效；仅提示任务需保持独立可验证 |
| `pnpm exec vitest run` 两个 WorkspaceBrowser 聚焦测试文件 | exit 0；2 个文件、56 项全部通过 |
| `pnpm --filter @deepseek-ai/dsh-client-ui-workspace run bundle` | exit 0；生成最新 Client 运行工件，3181 不再读取旧 rail 样式 |
| `pnpm run build:web` | exit 0；Vite 转换 336 个模块并生成 Web 工件 |
| `pnpm install --frozen-lockfile --offline --ignore-scripts` | exit 0；锁定 patch hash `b3a014af5a801b163bada4ae0b5717274985fd28167e431470301623be54ecbd` 可离线安装 |
| `git diff --check` | exit 0；改动无空白错误 |

样式合同测试精确覆盖折叠态空标题隐藏、两个 36px 控件及其唯一 12px 间距来源；既有 WorkspaceBrowser 组件测试继续覆盖展开、搜索、聚焦和项目/Session 交互。

## 真实运行几何证据

3181 使用 `1807×1218` 视口、真实 `数据分析项目` 和历史会话 `客户需求初步解读结论`。检查动作是直接点击 `fde-deliverables/01-requirement-research/requirement-baseline.md` 的审查入口，而不是构造静态页面。

| 对象 | 修复后结果 |
|---|---|
| Dock Host | `overflow=clip`，`scrollTop=0`，`scrollLeft=0`，边界 `top=0/bottom=1218` |
| 右侧 Dock | 边界 `top=0/bottom=1218`，宽度 632px |
| Dock Tab 栏 | `top=0/bottom=35`，完整可见 |
| File Review 标题 | `top=35/bottom=72`，完整可见 |
| 直接定位的目标文件行 | `top=261/bottom=293`，位于可见审查区域 |
| File Review 内层滚动区 | `clientHeight=1146`、`scrollHeight=1827`，继续承担内容滚动 |
| 折叠栏新建项目 | `36×36`，`top=66/bottom=102`，`left=10` |
| 折叠栏搜索会话 | `36×36`，`top=114/bottom=150`，`left=10` |
| 两按钮实际可见间距 | `114 - 102 = 12px` |

几何检查以非截图的窄范围无头浏览器脚本完成；未执行完整浏览器回放、自动截图或视觉对比。

## 隔离运行与人工确认

- 页面：`http://127.0.0.1:3181`
- DSH_HOME：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/fde-small-optimizations-main-snapshot`
- 运行数据：页面仍显示 main 快照中的 `数据分析项目`、真实 Workspace `/Users/muyu/test/ai-analysis` 和历史会话；Feature 与 main 不共写 Session/阶段存储。
- 生成的 `apps/web/dist/`、`packages/client/ui-workspace/lib/` 和依赖树均为可重建且被 Git 忽略的运行工件，没有进入提交范围。
- 待用户刷新 3181 人工确认：右侧差异页上下边界的视觉完整性，以及左侧两个图标的实际观感。人工确认前 F021 保持 `in-progress`。

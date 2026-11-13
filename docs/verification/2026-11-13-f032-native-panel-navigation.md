# F032 · 官方面板导航验证

状态：两轮截图反馈已落实导航修正、分组标题与底部精简；最新 18 项相关测试和完整构建通过，桌面加载检查见下。仍待用户人工体验确认。没有推送 GitHub、重打源码包、安装插件、创建真实自动化任务或调用模型。

## 分组标题与底部精简

用户认为底部两条返回动作冗余，并要求给官方功能增加类似“本地工作区”的标识。按 feature-spec-planning 增量更新 F032 Spec/Plan/Tasks，没有新增 Feature 或改变返回行为；UI 沿用 dsh-client-ui-ux 的分组、对齐与语义颜色规范。

实现为“本地工作区”与“Harness 原生功能”两组，原生组用辅助标题代替单独分隔线。底部保留仅在原生页出现的“返回工作台”，下方为设置；“返回介绍首页”改为无箭头的轻量“产品介绍”文字入口，研发署名位于末尾。设置、介绍和原来源返回的回调保留。窄栏隐藏长组标题但保留分组名称，返回有 Tooltip，设置沿用官方紧凑模式。没有新增图标或改变品牌。

截图疑似双选中经现有桌面只读查询确认：`aria-current=page` 仅在“插件”上，属于原选中与悬停视觉过近；本轮当前项采用主题强调色并加字重，FDE 当前项背景使用 active 语义色，与普通 hover 区分，没有改写官方选择状态。

- PRD、Product Spec 与 F032 校验器通过（保留既有数量提示，不扩大本轮治理范围）。
- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx packages/client/ui-fde-project/tests/workbench-surface.client.spec.ts`：2 文件、18 项通过，2.42 秒，日志 `.runtime/f032-sidebar-polish-tests.log`。覆盖分组、底部顺序、无重复返回箭头、介绍页导航、原来源返回、无多重当前项及紧凑设置传参。
- `corepack pnpm run build --serial`：11/11 通过，87.68 秒，登记 422 份 Client 产物，日志 `.runtime/f032-sidebar-polish-build.log`。
- ui-fde-project 中英 README 配对更新并通过校验，产品规格只维护中文；`git diff --check` 通过。
- 延续已确认的单实例更新方式，正常退出原桌面 12854 及 Host 12902 后，使用原 DSH_HOME 和 userData 运行 `start:desktop`，启动日志 `.runtime/harness-022-upgrade/desktop-f032-sidebar-polish.log`。未删除数据或创建运行副本。
- 加载核验通过：两个运行目录与原实例一致，渲染器 `readyState=complete`，应用已挂载且有内容，无插件加载失败页；当前 Boot Manifest 的 ui-fde-project 资源 HTTP 200，包含新 `workbench.native` 组标题与 `introLink` 底部布局。该检查只证明新版资源已加载，不替代人工视觉判断。

按项目人工优先规范未自动点击回放、截图或替用户判定视觉通过；下文保留先前两轮运行记录。

## 获准重启后的加载验证

用户回复“可以”后，进程与端口检查确认旧 FF-FDE 实例及其 Host 已退出，不需要强制停止，也未触碰其他 Electron 应用。使用既有目录执行：

```sh
DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/harness-022-validation/dsh-home DSH_DESKTOP_USER_DATA_DIR=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/harness-022-validation/desktop-user-data DSH_DESKTOP_OPEN_DEVTOOLS=0 corepack pnpm start:desktop
```

启动前未重复构建或运行已通过测试。启动日志确认两个目录正确；启动准备期间首次端口检查尚未监听，准备完成后以有超时的只读检查确认：渲染器 `readyState=complete`、应用有内容、`data-shell-frame` 新标记存在、无 `Failed to load plugins` 页面。通过当前 Boot Manifest 提供的地址读取 ui-fde-project 与 ui-layout Bundle，均返回 HTTP 200，分别包含 `data-fde-native-panel` 和 `data-shell-frame` 修复标记。未运行自动点击、截图或整套 UI 回放，人工验收保持待确认。

重用原桌面及运行目录，不新建副本或迁移数据；新增启动日志位于 `.runtime/harness-022-upgrade/desktop-f032-restart.log`，受 Git 忽略，仅供本轮诊断，问题确认后可删除日志，不删除同级运行数据。

## 用户截图反馈与修正

截图显示右侧为插件页，左侧却出现当前项目卡片与八阶段列表。原因是原实现关闭整个 FDE 导航覆盖面，暴露了官方项目侧栏。修正后 FDE 导航依据官方 `activePanelId` 保持统一左栏，仅释放右侧内容；从项目侧栏进入同样适用。原生页模式通过 AppFrame 标记调整网格并隐藏项目左列、工具区域、拖柄及抽屉遮罩，不写回项目布局偏好。返回关闭原生面板并恢复来源或原会话；业务页面切换清除旧面板选择，实验室保留自己的返回面板。创建插件草稿仍沿官方会话路径，不被全局导航覆盖。

本次证据：

- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx packages/client/ui-fde-project/tests/apply.client.spec.ts packages/client/ui-fde-project/tests/workbench-surface.client.spec.ts packages/client/ui-fde-project/tests/page-controller.client.spec.ts`：4 文件、23 项通过，2.36 秒，日志 `.runtime/f032-global-panel-fix-tests.log`。
- `corepack pnpm run build --serial`：11/11 通过，34.54 秒，登记 422 份 Client 产物，日志 `.runtime/f032-global-panel-fix-build.log`。
- ui-fde-project、ui-layout 两对 README 同步记录并通过 `verify-translation-pairing`；`git diff --check` 通过。
- 当前桌面主进程 8593、Host 8637，既有本地端口 55412。仅做有超时的只读加载诊断：渲染器 `readyState=complete`，尚无 `data-shell-frame` 新标记；从现有 `__DSH_BOOT__` 取得的 ui-fde-project、ui-layout 旧 Bundle 地址均返回 404。不能把磁盘构建完成当成正在运行的窗口已更新，亦未再次刷新或停止 Host。
- 已请求允许重启这一个实例；尚未完成当前窗口的新 Bundle 加载核验和人工视觉验收。未运行浏览器自动回放或截图。

下文保留首轮检查与当时的运行情况；首轮“退出 FDE 外壳”的实现已由上述修正替代。

## 实现边界

四个 FDE 业务入口顺序保留，下方通过原生 `sidebar.panels` Factory 渲染当前授权面板、图标和更多菜单。原侧栏和 FDE 使用同一面板源与内存固定列表，Factory 唯一声明 `sidebar.panellist.actions`。更多的固定、关闭不触发外壳交接；真正选中面板、浏览插件或创建草稿才调用可选 `beforeNavigate`。没有创建第二个插件管理器或调度器。

ProjectPageController 保存 FDE 来源快照；返回恢复来源页面或原会话，不重新打开 Session。实验室插槽一直挂载，原 labReturn 链保持。显式选择新的 FDE 页面会清除过期返回目标和原生选择。FDE 侧栏可见时，原侧栏通过专用标记从可访问/交互中隐藏，防止隐藏按钮重复进入焦点；业务入口和官方入口所在区域可滚动，官方紧凑模式与现有 640 px 断点一致。

规格规划按 feature-spec-planning 先落盘；UI 使用官方工厂、图标、Menu 和 Tooltip。按本项目人工优先规则，没有运行浏览器回放、截图或声称视觉验收通过。官方包 README 保留既有中英文合同，F032 规格和验证只维护中文。

## 已通过的检查

| 检查 | 结果 | 证据 |
|---|---|---|
| PRD、总 Spec 与 F032 校验 | 通过；F032 保持 in-progress | Skill 校验器输出 |
| 首轮 8 个定向测试文件 | 7 文件全绿；总计 100 项通过，13 项失败见下文 | `.runtime/f032-focused-tests.log` |
| 来源恢复与 FDE 导航补充 | 2 文件、8 项通过，包含恢复原生面板选择且不重开 Session | `.runtime/f032-return-tests.log` |
| 原壳中导航区域放置 | 本轮相关的 1 项通过，45 项未重复运行 | `.runtime/f032-shell-placement-test.log` |
| 窄屏模式与监听释放 | 新增 1 项通过 | `.runtime/f032-compact-tests.log` |
| 可滚动区域与隐藏背景侧栏规则 | 新增 1 项通过 | `.runtime/f032-surface-test.log` |
| 原生侧栏快照 | 5 项通过，仅增加 `data-native-sidebar` 标记，无其他快照差异 | `.runtime/f032-sidebar-snapshot.log` |
| `corepack pnpm run build --serial` | 最终 11/11，76.68 秒；Host/Client 聚合类型检查通过，登记 422 份 Client 产物 | `.runtime/f032-build-final.log` |
| 文档与生成目录 | 3 对直接受影响 README 一致，Slot 目录已重新生成；diff 空白检查通过 | `.runtime/f032-pairing-check.log`、`f032-client-catalog.log` |

首次构建在测试代码误用 Testing Library 的 `exact` 参数处失败，移除无效参数后完整构建通过；没有放宽类型检查。

## 未通过与未验证项

`ui-sidebar/tests/sidebar-root.client.spec.tsx` 首轮有 13 项失败：本轮提取导航工厂后，原壳位置测试的孤立 fixture 仍把 factory 返回值写为 null，该项已对齐新的组合位置并通过。其余 12 项仍断言已被 FDE 基线移除的全局 New Session 按钮、品牌点击或相应焦点/埋点；原控件移除不属于本轮新增变化，本轮没有恢复该入口或批量改写这些旧测试。不能据此声称整个 SidebarRoot 测试套件全绿。

桌面原进程为 Electron 27540、Host 27590，使用既有 `.runtime/harness-022-validation`。刷新前，页面读到的 body 文本为空、无非空文本草稿和可用的停止生成控件；因此未把“看不到停止按钮”当成所有后台任务空闲的证明。仅刷新客户端，没有停止 Host；随后 9222 页面列表和主进程调试求值超时，Host 的 `127.0.0.1:53826/` 仍响应未授权 401。没有证据将该现象归因于本次导航代码，也没有把匿名 401 当作新 Bundle 验证成功。

已通过异步问题请求用户允许重启这一个桌面实例，以免中断可能存在的任务；在确认前不强杀进程、不切换到空数据目录或另开 Host 共写同一 DSH_HOME。完整点击、浅深主题、菜单层级、低高度与窄屏视觉检查仍由用户人工验收。

本轮只新增源码、规格与少量 `.runtime/f032-*` 验证日志，没有新建 worktree、依赖树或运行数据副本。上次已推送版本与桌面源码 ZIP 不变；根 `.agents/`、旧未跟踪验包记录和 `lefthook.yml` 原样保留。

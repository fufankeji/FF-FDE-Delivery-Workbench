# macOS 桌面窗口按钮与 Logo 重叠修复

用户截图显示红黄绿原生窗口按钮覆盖工作台左上角 Logo。实际读取桌面布局：`data-platform=darwin`、非全屏、标题栏安全区 48 px；Logo 原顶部为 20 px、尺寸 35×35，侧栏未消费宿主安全区。

## 修复范围

仅在 `ui-fde-project/src/client/workbench.module.css` 的非全屏 macOS 侧栏叠加 `--dsh-frame-top-clearance`：常规顶部内边距 20+48=68 px，640 px 以下保持原 22 px 基础间距、合计 70 px。普通网页和全屏不匹配新增选择器，保留原 20/22 px；未修改全局安全区、窗口按钮位置、Logo 资源、尺寸、导航动作或业务数据。计划先记录在 F028 Plan，包说明保持既有中英配对。

## 验证

- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-surface.client.spec.ts -t 'native caption clearance'`：1 项通过、6 项无关用例跳过。验证 macOS 非全屏选择器、两档内边距、全局变量不改写及 Logo 尺寸保留。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project run bundle`：退出 0。
- 普通页面刷新遇到当前桌面进程中的插件资源加载失败；未扩展修改插件加载器，正常退出并以原有显式 `DSH_HOME` 和 `DSH_DESKTOP_USER_DATA_DIR` 完整重启，日志为 `.runtime/harness-021-upgrade/desktop-clearance-20261102.log`。
- 从实际桌面进入实验室/场景挑战，测得 Logo `(x=18, y=68, width=35, height=35)`、侧栏顶部内边距 68 px，已经位于 48 px 原生标题栏安全区下方。窗口已置前。未执行完整浏览器回放，未开始答题或模型访谈，也未清理记录。
- 窄窗口及全屏的保留规则由样式约束覆盖，本次未切换操作系统全屏状态或调整用户窗口大小。
- `git diff --check`：通过。构建更新已有被忽略的 `lib/`，未创建仓库副本或视频/截图产物。

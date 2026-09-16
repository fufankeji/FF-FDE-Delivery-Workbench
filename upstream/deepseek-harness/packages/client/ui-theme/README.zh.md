# @deepseek-ai/dsh-client-ui-theme

[English](README.md) | 中文

主题插件：基于 --dsw-* token 基础样式表（静态尺度 + 别名语义层）的 ThemeRuntime。该服务拥有实时主题偏好（`light`／`dark`／`system`），将 `system` 通过 `prefers-color-scheme` 解析为实际主题，并发布不可变的 `ThemeSnapshot`，通过 `theme/change` 事件通知变化；它不写入呈现 DOM：ui-layout 的呈现器会应用解析后的快照（`html { color-scheme }`、`body[data-ds-dark-theme]`，以及主题的别名 token 内联变量）。该服务先沿用 index 引导中嵌入的 Host 偏好，仅在标记不存在时回退到 `system`。来自回环地址的浏览器随后在后台加载 `ui-theme.preference`，并将每次内置主题选择通过 Host settings API 写入；其本地提供方默认将设置存入 `$DSH_HOME/settings.yaml`。收到推送的 settings 变更时或重连后，浏览器都会重新拉取该设置；连续快速选择会按操作顺序携带 namespace revision 串行写入，最新写入被拒时则重新加载持久化值。远程浏览器无需读取特权 settings API 即可沿用相同的嵌入偏好；后续选择仅保留在进程内。已注册的第三方主题 id 仍是进程内扩展，不会跨越内置 settings schema；移除其中任意一个都绝不会覆盖最后一个持久化的内置偏好。该持久化边界由[Host settings 支撑的偏好决策](../../../.agents/notes/implemented/bug-fix/2026-08-06-host-backed-web-preferences.zh.md)拥有。

当主机组合包含 HTTP 服务器时，主机侧紧接 `<body>` 起始标签注入同步引导代码。每份 index 响应会嵌入已注册的 Host 设置 `ui-theme.preference`，没有 settings provider 时则嵌入 `system`；浏览器按操作系统配色解析 `system`，把原始偏好保存在 documentElement 的 `data-dsh-theme-preference` 中供 ThemeRuntime 接续，随后在外壳加载页面渲染前设置 `color-scheme` 和 `body[data-ds-dark-theme]`。不含 HTTP 服务器的组合不受影响，插件树激活后，ThemeRuntime 与 ui-layout 仍分别是客户端状态和后续 DOM 更新的权威来源。

`src/styles/` 下有六张样式表，由 ui-theme 的动态客户端 entry 依次导入：`base.css`、`design-platform.css`、`fde-evaluation.css`、`scrollbar.css`、`gradient-shadow-text.css` 与 `shiki.css`。客户端 bundle 将其编译并注入为插件持有的全局样式，因此卸载与 HMR 会随 ui-theme 一同移除这些样式，而不会把主题 CSS 留在静态 Web 外壳中。`scrollbar.css` 是 `--dsw-alias-scrollbar-*` token 的唯一消费方，必须排在声明这些 token 的 `design-platform.css` 之后。

`fde-evaluation.css` 将用户确认的第五阶段参考配色限定在 `[data-fde-stage-workbench][data-stage='evaluation']`：不透明浅色表面、亮蓝操作，以及 `--dsw-alias-evaluation-*` 横幅和画布角色。不改其他阶段或外壳；深色模式保留基础表面配色，深色横幅使用显式浅色前景。

同一文件另将第六阶段参考配色限定在 `[data-delivery-workbench][data-stage='pilot']`：不透明浅色卡片、亮蓝控件、深蓝至青蓝横幅和浅色文字。深色模式保留基础表面 token，不改变生产、持续改进阶段或应用外壳的配色。

第七阶段另有 `[data-stage='production']` 交付配色：浅色横幅、深蓝证据统计条、蓝色描边图表与浅紫评审区。深色模式保留基础表面 token，深色统计条使用显式浅色文字。试点与持续改进阶段不消费这些角色。

第八阶段将深蓝插画横幅、白色证据面板、钴蓝导航与橙色人工评审操作限定在 `[data-stage='improvement']`。浅色模式使用不透明画布；应用壳和其他阶段仍使用各自角色。

滚动条重新绑定约定：`scrollbar.css` 在 `body` 上把 `--dsh-scrollbar-thumb` 与 `--dsh-scrollbar-thumb-hover` 绑定到 l1（基础表面）token，两条渲染路径都读取这一组变量。高层级表面（菜单、浮层、对话框）在自己的容器上设置 `--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)` 与 `--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)`；一次重新绑定即可为引擎实际走的那条路径换色。这组变量的另一个合法目标是 `transparent`，即完全不绘制滑块——[ui-sidebar](../ui-sidebar/README.zh.md) 在指针不在栏内时就这样重新绑定自己的列。绑回 l1 那组不算重新绑定，它只是重述基础表面的默认值。`--dsh-scrollbar-width` 镜像 WebKit 滚动条的布局宽度，供需要与占布局宽度的滚动条对齐的表面使用——[ui-conversation](../ui-conversation/README.zh.md) 用它作为覆盖 composer 座位 `right` 偏移——scrollbar-styles 规格把它与镜像规则及消费者配对检查。

两条路径在构造上互斥。`scrollbar-width`／`scrollbar-color` 写在 `@supports not selector(::-webkit-scrollbar)` 之内，因为这两个属性中的任一个只要取非 `auto` 值，Chromium 与 Safari 就会丢弃该元素上的全部 `::-webkit-scrollbar*` 规则，`::-webkit-scrollbar-thumb:hover` 也在其中——若无条件地同时声明，`--dsh-scrollbar-thumb-hover` 在任何引擎上都不会被渲染。因此 Firefox 走标准属性，WebKit 系引擎走伪元素，hover token 只经由伪元素这条路径渲染。相关原理与实测计算值见[滚动条 Agent Note](../../../.agents/notes/implemented/bug-fix/2026-07-28-themed-scrollbars-and-reserved-gutter.zh.md)。

`design-platform.css` 同时拥有 `--dsw-alias-graph-background`、`--dsw-alias-graph-foreground` 与 `--dsw-alias-graph-accent`。知识图谱消费这些黑色、冰白和青色角色，在应用的明暗主题下均保持沉浸式深色画布与可读浮层；不改变其他工作台表面。

## 模型体验

无。主题服务管理浏览器偏好；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **第三方主题是表层，不是产品**：注册主题意味着覆盖同名别名变量；目前不会验证一组覆盖是否完整。
- **token 样式表是颜色值的唯一权威来源**：会有意不补入 cssdesign 中缺失的值（例如设计中的 #4176E6 标签页蓝色）；一律采用最接近的语义 token。设计负责人批准的新增值是例外：须在同一变更中以一个静态尺度层级与一个语义别名的形式进入（`--dsw-static-blue-900` / `--dsw-alias-label-primary-bluish`）。

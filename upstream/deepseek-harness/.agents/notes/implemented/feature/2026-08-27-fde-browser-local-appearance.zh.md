# Agent Note: 基于官方主题运行时的 FDE 浏览器本地界面主题

Status: implemented

[English](2026-08-27-fde-browser-local-appearance.md) | 中文

## Problem

FDE Web Profile 已经继承 Harness 的浅色、深色和跟随系统偏好，但这些选择不包含独立 Studio 应用已有的内置图片皮肤和本地自定义背景。原样复用 Studio 功能会把 Electron preload bridge、软件更新控件和无关视觉模型能力带入普通浏览器 Profile。把个人背景保存到项目数据还会让纯展示偏好进入不需要它的 Workspace、Session、Agent 和观测链路。

皮肤必须在两种官方明暗配色下保持可读，在固定 Origin 的浏览器刷新后继续存在，并在失败时不替换用户当前外观。插件卸载和无图片的官方原版选项也必须只移除本功能自己拥有的样式。

## Decision

`@deepseek-ai/dsh-client-ui-fde-appearance` 是独立的浏览器 Client 插件。它通过 `settings.section` 注册“界面主题”，并创建一个 apply 作用域 `AppearanceController`。控制器统一拥有 `body[data-fde-skin]` 标记、两个 `--fde-background-*` 属性和一层可卸载的 `ctx.theme.overrideTokens('fde-appearance', …)`；组件通过 Slot inject face 获得其 observable 和动作，不访问 ctx，也不自行建立订阅。

官方原版和五张 1920×1080 WebP 背景以稳定身份发布在 `apps/web/public/fde-themes/`：`official`、`whale-maid`、`cloud-cat`、`jiutian-deep-space`、`jiutian-quantum-glass` 和 `jiutian-dawn-horizon`。`whale-maid` 是首次使用与恢复默认的选择。`official` 不含图片并移除 FDE Token 层，其余皮肤提供成对明暗语义 Token，因此切换官方明暗偏好时会保留当前皮肤。AppFrame 保留一层半透明 `--dsw-specific-sidebar-fill`；Slot 系统稳定的 `[data-slot='sidebar']` 地址移除 SidebarRoot 的重复填充并应用背景模糊，因此无需修改任何所有者，背景也能进入导航栏。

卡片、文件、焦点和玻璃层变化在点击“保存并应用”前都只是预览草稿。原图只接受 16 MiB 以内的 PNG、JPEG 和 WebP；浏览器在本地解码、按 cover 裁切为 1920×1080 WebP，并采样四个主题色。完整内置身份或处理后的自定义值序列化到 `fde.appearance.v1`；安全序列化长度在常见 localStorage 配额下保留余量。控制器先写入完整值再应用，因此校验、编码、策略或配额失败都会保留此前的持久快照、DOM 背景和 Token 层。

图片与外观值都不会通过 RPC，不进入 Workspace、Session 日志、Agent 请求或观测数据。清理浏览器站点数据会按预期清除该偏好。插件卸载时恢复接管前的标记和内联属性，并调用当前 Token disposer，其他 DOM 属性和主题层保持不变。

## Alternatives considered

**原样安装 Desktop customization 插件。** 它以 Electron 主进程 `appearance.json` 为持久化权威，通过固定 preload bridge 访问；同一个包还拥有软件更新和视觉增强。这些能力和信任边界不存在于普通 Web Profile。

**把皮肤作为浅色/深色主题注册到 `ui-theme`。** 皮肤和明暗配色是两个独立选择。把每张图片注册为具体主题会产生多组明暗变体、替换用户的跟随系统偏好，并把 FDE 专属资源放入全局主题所有者。

**通过 Host 设置或项目文件保存自定义图片。** Host 持久化会通过 RPC 传输个人图片，项目存储则会让外观进入交付数据和 Agent 可见文件系统。固定浏览器 Origin 不需要这两条路径。

**在每个 FDE 组件中独立应用颜色。** 组件分支会遗漏官方与第三方页面、重复可读性规则，也无法完整卸载。一层 ThemeRuntime Override 可以覆盖全部语义 Token 消费者，并由一个 disposer 管理。

## Consequences

Web Profile 获得与 Studio 相同的六套稳定皮肤和本地图片流程，同时不继承 Desktop 外壳。浅色、深色和跟随系统偏好继续保留既有持久化与语义，FDE 皮肤则是独立的浏览器本地值。图片处理和存储失败真实可见，且不会部分替换当前主题；移除插件即可恢复普通 Harness 外观，不影响任何项目。

自定义图片受浏览器 Canvas 和每个 Origin 的 localStorage 配额限制，也不会跨浏览器或设备同步。五张内置图片使 Web 静态载荷增加约 460 KiB。聚焦控制器、组件和真实 Slot 组合测试固定默认/加载、明确保存、官方原版/恢复默认、成对 Token、无效存储、配额失败和 Effect 卸载；视觉判断仍由人工产品验收完成。

---
document: feature-plan
feature: F016
status: ready
updated: "2026-08-27"
---

# F016 · 工作台界面主题实施计划

## 现有上下文与复用

- 官方 `ui-theme` 已拥有浅色/深色/跟随系统、全局 `--dsw-*` Token、`ThemeRuntime.overrideTokens()` 和 `ui-layout` DOM Presenter；F016 只叠加可卸载的主题 Token，不新建第二套明暗主题系统。
- 官方 `ui-settings-general` 声明 `settings.section`，允许独立插件贡献完整设置页面；F016 使用该入口，不把六张皮肤卡塞入现有三按钮“外观”行。
- 本地 Studio `ui-desktop-customization` 已验证六套主题身份、五张 1920×1080 WebP、预览、焦点、玻璃层、Canvas 裁切和配色提取。F016 复用这些主题资源与交互，移除 Electron bridge、更新和视觉增强代码。
- Web 固定地址使用稳定 Origin。F016 用一个版本化 `localStorage` JSON 保存个人主题；项目、Session 和 Host 持久化不承载外观偏好。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/client/ui-fde-appearance/` | 不存在 | 新增主题定义、图片处理、本地存储控制器、设置页、样式与测试 | AC-F016-001～004 |
| `packages/client/ui-settings-general/` | 设置弹窗从侧栏 Slot 子树直接渲染 | 将弹窗内容 Portal 到 `document.body`，避免主题侧栏模糊层把 fixed 弹窗限制在侧栏宽度 | AC-F016-003 |
| `apps/web/public/fde-themes/` | 不存在 | 机械复制 Studio 五张固定 WebP 资源 | AC-F016-001, AC-F016-003 |
| `packages/bundle/web-app/` | FDE Web 组合 | 注册新 Client 插件并声明依赖 | AC-F016-001～004 |
| `tsconfig.client.json` / workspace lock | Client 聚合与依赖图 | 加入新包并刷新锁文件 | 全部 |
| Client/Bundle README 与 Agent Note | 当前插件与决策合同 | 记录主题生命周期、本地隐私、资源来源和限制 | 全部 |
| F016/Architecture/Verification | 产品、实现和证据 | 同步真实实现、命令、结果和人工验收边界 | 全部 |

## 实现方案

建立独立动态 Client 插件 `@deepseek-ai/dsh-client-ui-fde-appearance`。插件注入 `slots`、`theme` 和 `locale`，注册中文/英文设置文案，并通过 declaration-aware `settings.section` 添加“界面主题”。组件只接收框架绑定的控制器观察 hook 和操作回调，不读取 ctx、不直接订阅外部状态。

`AppearanceController` 在 apply 时启动：保存其将要覆盖的 body 标记和 CSS 属性，从 `fde.appearance.v1` 读取并校验完整 JSON，无有效值时采用 `whale-maid`，然后调用统一 `apply()`。图片皮肤设置 `body[data-fde-skin='active']`、背景 URL/焦点自定义属性，并通过 `ctx.theme.overrideTokens('fde-appearance', tokens)` 提交明暗成对 Token；`official` 和 dispose 路径撤销该插件自己的写入。

设置组件复用 Studio 的卡片、预览、文件选择、焦点和玻璃层交互，并改用 `FF - FDE 交付工作台` 文案。内置选择直接引用 `/fde-themes/*.webp`；自定义文件使用 Object URL 预览，保存时执行 1920×1080 cover 裁切、WebP 编码和配色提取。持久 JSON 在写入前检查编码长度，`localStorage.setItem()` 成功后控制器才应用并发布；失败时不触碰旧快照和 DOM。

CSS Module 同时拥有设置组件样式和 F016 全局背景选择器；组件颜色只消费官方语义 Token，背景叠层和预览特有蒙层保留在主题所有者中。默认大肥鱼拟人、官方原版和五张静态资源的身份、路径、配色固定在一个定义表内。

AppFrame 与 SidebarRoot 会各自使用 `--dsw-specific-sidebar-fill`，同一较高透明度在两层叠加后会近似不透明。F016 把该 Token 收敛为较轻的明暗成对半透明值，并通过 Slot 系统稳定提供的 `[data-slot='sidebar']` 地址只撤去 SidebarRoot 的重复填充、增加轻量背景模糊；AppFrame 仍保留单层侧栏表面和右边界，因此背景进入左栏且文字、选中行与控件继续可辨识，不修改 `ui-layout` 或 `ui-sidebar` 源码。

侧栏内容层的 `backdrop-filter` 会成为 fixed 后代的包含块。设置触发器继续留在 `sidebar.settings`，但打开后的 `SettingsPanel` 通过 React Portal 渲染到当前文档的 `body`；因此蒙层、800px 双栏面板、关闭路径和焦点逻辑继续沿用原合同，同时不再受侧栏宽度和模糊层约束。

## 实施顺序

1. 冻结 F016 产品合同、稳定主题 id、默认、资源来源、本地隐私和失败语义。
2. 建立插件包、主题定义、五张静态资源、本地存储和图片处理控制器。
3. 实现“界面主题”设置区、六张主题卡、自定义图片、预览、焦点、玻璃层、保存与恢复默认。
4. 注册 Bundle/聚合依赖，更新包文档和非平凡 UI Agent Note。
5. 运行控制器、组件、插件挂载、类型和构建的最窄检查；不运行浏览器截图或完整 Web E2E。
6. 重启 3080，记录 HTTP/Boot 可访问证据并交由用户人工检查视觉效果。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| Studio 依赖 Electron bridge | 原代码不能直接装进 Web | 只复用主题/图片算法和 UI，改为独立浏览器控制器与版本化本地 JSON | T002 |
| localStorage 配额因浏览器而异 | 自定义 WebP 可能保存失败 | 原图限 16 MiB，处理值设明确长度上限，先写成功再应用，失败保留旧值 | T002～T004 |
| 全局半透明 Token 影响多个既有页面 | 文字或表面可读性下降 | 使用 Studio 已验证的成对明暗 Token；聚焦组件测试覆盖关键 Token，视觉交给用户人工验收 | T003～T006 |
| AppFrame 与 SidebarRoot 重复侧栏填充 | 背景只在主内容可见，左栏形成不透明色块 | 降低侧栏 Token alpha，并通过官方 Slot anchor 去掉内层重复填充；保留单层表面、边界和模糊 | T007 |
| 侧栏模糊层成为 fixed 包含块 | 设置弹窗被压进左栏，正文逐字换行且无法使用 | 保留设置触发器位置，把弹窗 Portal 到 `document.body`；聚焦测试固定其 DOM 宿主 | T008 |
| 插件卸载或切换 official 留下样式 | 后续主题叠加错误 | 保存先前 DOM 值、ThemeRuntime disposer 和幂等撤销路径 | T002, T005 |
| 静态资源漏入构建 | 卡片可见但背景 404 | Web public 固定目录、构建产物检查和 HTTP 资源检查 | T002, T006 |

## 回退策略

从 Web Bundle 移除 F016 Client row 即恢复官方浅色/深色主题和当前 FDE 功能；插件 dispose 会撤销背景、标记和 Token。删除插件不删除项目、会话或文件。保留在浏览器中的 `fde.appearance.v1` 只是不可达个人偏好，重新启用插件可继续读取；需要彻底清理时由用户清理站点数据。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F016-001 | 六套主题、默认、official 和刷新恢复 | 控制器＋组件聚焦测试 | 主题 id、保存、加载、恢复默认和撤销成立 |
| AC-F016-002 | 自定义图片本地处理与无网络边界 | 图片 helper＋组件测试 | 类型/大小、Canvas、Data URL、焦点/玻璃层与本地保存成立 |
| AC-F016-003 | 明暗模式独立和 Token 可读层 | 控制器 ThemeRuntime 测试 | 同一皮肤保持、成对 Token、品牌与核心语义未被替换 |
| AC-F016-004 | 失败保留旧主题 | 存储失败/无效值测试 | 快照、DOM、Token 和持久值不发生部分切换 |

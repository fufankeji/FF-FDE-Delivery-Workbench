# @deepseek-ai/dsh-client-ui-brand-official

[English](README.md) | 中文

这个下游包会在所有构建 profile 中用 FF-FDE 产品身份填充 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark`。两处标记都使用未经修改的 `/ff-brand/ff-logo.png`，并以相同的 20% 展示圆角呈现；侧边栏名称逐字显示 `FF-FDE工作台`。占用侧边栏名称 slot 后，shell fallback 中的 `DSH Local Build` 和提交徽标自然不再出现，且不改变侧边栏壳。

三个占位者通过嵌套的 `slots.inject()` 作为一组声明感知注册安装。因此无论该包的条目先于还是后于侧边栏和会话声明方激活，它都能工作；任一声明折叠时会撤回全部占位者，HMR 期间不会留下混合品牌。它不保留运行时状态。node 半边是空的 Loader seat；浏览器标题仍属于本包之外的构建环境事项。

## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **本包只提供一组 FF-FDE occupant** —— 其他呈现应由占用相同 slot 的另一个 Cordis 包提供。
- **浏览器标题相互独立** —— `DSH_CLIENT_TITLE` 在构建期选择标题文字，而不经过 UI slot。

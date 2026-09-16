# @deepseek-ai/dsh-client-ui-fde-discovery-lab

[English](README.md) | 中文

通过 `fde.workbench.module.action` 在首页导航和全屏项目中心顶部新增“业务挖掘实验室”，保留原侧栏入口，无需创建或选择项目。完整训练页面提供“返回工作台”。导航只保存在本插件的一个 Store 内，打开和关闭不读取、不修改项目或会话选择。

包的 `bundle` 命令把原 React/Pixi 应用构建到 `lib/app/`，根 Client 构建也包含此步骤。[Host 插件](../../fde/discovery-lab/README.zh.md) 在 `/fde-discovery-lab/` 提供应用。同源 iframe 隔离原应用的 CSS、React 运行时和渲染生命周期，不另起服务或代理。

## Model Experience

外壳不增加提示词、工具或模型调用。内部应用由用户明确发起的访谈、核对与报告操作使用 Host 训练 Agent，可能产生模型费用。

#### KV Cache effect

导航外壳没有影响；原生训练对话及辅助任务用量由 Host 插件负责。

## Known Limitations and Deferred Work

- 保留原应用桌面布局、1000 px 最小宽度以及窄屏横向滚动，不做移动端重设计。
- 原应用风格与工作台皮肤独立。
- 返回会移除 iframe，但不删除后台训练记录、不停止正在进行的访谈；再次打开从 Host 恢复记录。
- 真实模型质量与原像素办公室体验需要人工验收。
- 来源及 private 再分发边界见[来源记录](../../fde/discovery-lab/SOURCE.md)。

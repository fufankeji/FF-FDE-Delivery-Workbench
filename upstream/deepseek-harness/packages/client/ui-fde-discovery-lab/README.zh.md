# @deepseek-ai/dsh-client-ui-fde-discovery-lab

[English](README.md) | 中文

通过 `fde.workbench.lab.page` 提供训练页面，通过 `fde.workbench.lab.summary` 提供总览只读摘要。介绍首页不再提供独立实验室快捷入口。平台导航负责“实验室”入口，同时保留项目侧栏快捷入口，无需创建或选择项目。“返回原工作面”恢复进入前的平台页面，不改变项目或会话选择。

包的 `bundle` 命令把原 React/Pixi 应用构建到 `lib/app/`，根 Client 构建也包含此步骤。[Host 插件](../../fde/discovery-lab/README.zh.md) 在 `/fde-discovery-lab/` 提供应用。同源 iframe 隔离原应用的 CSS、React 运行时和渲染生命周期，不另起服务或代理。

## Model Experience

外壳不增加提示词、工具或模型调用。内部应用由用户明确发起的访谈、核对与报告操作使用 Host 训练 Agent，可能产生模型费用。

#### KV Cache effect

导航外壳没有影响；原生训练对话及辅助任务用量由 Host 插件负责。

## Known Limitations and Deferred Work

- 保留原应用桌面布局、1000 px 最小宽度以及窄屏横向滚动，不做移动端重设计。
- 原应用风格与工作台皮肤独立。
- 首次进入后，模块切换仅隐藏 iframe，保留训练中的临时输入；刷新浏览器、卸载插件或加载失败后显式重试才重建 iframe，持久化记录从 Host 恢复。
- 真实模型质量与原像素办公室体验需要人工验收。
- 来源及 private 再分发边界见[来源记录](../../fde/discovery-lab/SOURCE.md)。

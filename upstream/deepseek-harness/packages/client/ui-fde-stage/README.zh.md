# @deepseek-ai/dsh-client-ui-fde-stage

[English](README.md) | 中文

一个 Workspace 项目的 FDE 六阶段进度浏览器界面。一个 apply 作用域内的 Host-backed observable 由两个 Conversation contribution 共享：空白输入框上方的紧凑提示和已开始会话头部的当前阶段。空白提示读取 Conversation 共享的卡片宽度与两侧 clearance 变量，因此其外边界与输入卡保持对齐，而不是跟随更宽的 Slot 容器。Session 归属只通过 Workspace 列表的 `sessionIds` 解析，禁止使用 cwd 或最近项目回退。全局项目进度页面属于 `ui-fde-project`。

该包不提供完成或推进阶段的动作；Host 读取失败时保留可见重试状态，不使用其他项目缓存兜底。

## 模型体验

无。该包只在浏览器中呈现项目状态，不注册消息、提示词、schema、工具或请求上下文。

#### KV Cache 影响

无；系统不会组装或改变任何提供方请求。

## 已知限制与暂缓事项

- 详细输入、产物、确认、完成条件、阶段变更和实时更新延期到对应阶段与 F005 规格。

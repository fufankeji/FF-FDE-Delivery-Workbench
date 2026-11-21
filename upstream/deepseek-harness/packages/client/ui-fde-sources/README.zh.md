# @deepseek-ai/dsh-client-ui-fde-sources

[English](README.md) | 中文

FDE 项目来源导入界面。它向每个真实项目行贡献一个紧凑的“添加项目资料”动作，把选中的文件作为一个显式指定 Workspace 的批次发送，反馈 Host 的真实保存结果，刷新项目资料视图，并对新保存且受支持的文档启动不调用模型的本地识别。该动作不依赖 Conversation、Session 或 Agent，也绝不会修改输入框草稿。

root 作用域的 `fde.project.resources.upload` Component Factory 接受 `workspaceId` 和 `path`，用同一导入控件呈现带文字的页面入口，不依赖已选 Session 或挂载中的侧栏。页面实例直接打开自己的文件选择器，不监听侧栏的上传打开事件；保存成功继续发出已有项目资料刷新通知。属于项目的 Session 保留原生输入框上传入口。

## 模型体验

无，因为该界面只执行项目持久化，不注册消息、提示词、schema 或工具。

#### KV Cache 影响

无；系统不会组装或改变任何提供方请求。

## 已知限制与暂缓事项

- 项目资料列表、状态和预览由“项目详情”与 Better Sidebar 承担；本包只负责导入和刷新通知。
- 拖拽、删除、来源版本、OCR 和对话引用界面仍然延期。
- 上传始终指向已登记项目；未分组会话桶没有项目资料动作。

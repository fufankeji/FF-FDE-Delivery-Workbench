# Agent Note: 项目资料导入属于项目存储，而不是对话附件

Status: implemented

[English](2026-08-26-project-resource-intake.md) | 中文

## Problem

官方附件链路只接受栅格图片，并会让已提交附件成为 Session 消息的一部分。社区通用文件插件大多延续了这种对话优先姿态：在输入框挂载回形针、按 Session 或 DSH 全局目录保存、向草稿注入路径、按 TTL 过期文件，或者调用模型侧解析器。FDE 产品首先需要的是另一种动作。操作人员可能在要求 Agent 执行任何工作之前，先收到客户需求、会议纪要、系统说明和数据样例。导入这些文件必须建立持久项目事实，不能制造一轮对话，也不能静默授权模型访问。

当前产品已经把一个 FDE 项目映射为一个 Harness Workspace，并允许其下存在多条 Session。按 Session 建上传目录会把同一项目材料拆散到不同对话；全局附件库则会把文件藏在后续 Workspace 文件树和编辑器插件之外。若再次把上传控件放回输入框，也会告诉用户这些文件属于下一条消息，与“只保存这份项目资料”和“在当前对话使用这份资料”的产品区分冲突。

## Decision

`@deepseek-ai/dsh-fde-source` 持有一条只允许本机同源访问的 exact HTTP route。multipart 请求显式指定 Workspace id；Host 通过 `ctx.workspaceRegistry` 解析该 id，绝不回退到当前 Session、最近 Workspace 或调用方提供的路径。完整批次在发布前受到边界约束（默认单文件 25 MiB、每批 20 个文件、文件内容合计 100 MiB），先在项目内部暂存，再链接发布到可见的 `<workspace>/fde-resources/` 目录。文件名消毒会保留可读 Unicode，同时移除路径穿越、控制字符和跨平台非法字符。独占链接发布通过 `-1`、`-2` 等后缀分配新名称，而不是替换已有文件；普通的中途发布失败会取消链接该批次的全部新成员。

`ui-workspace` 声明根作用域 list Slot `sidebar.workspaces.projectActions`，且只在真实项目行内渲染。其 owner props 携带精确 Workspace id、标题和规范路径。`@deepseek-ai/dsh-client-ui-fde-sources` 向该 Slot 贡献“添加项目资料”动作，发送一份 FormData 批次，并通过共享 Toast 报告 Host 结果。它不依赖 Conversation、Session、Input、Agent、解析器或凭据。因此上传成功不会改变草稿、不会追加 `user/message`、不会启动 Agent 轮次，也不会产生外部模型请求。

实现参考了 MIT 许可的 `dsh-local-file-upload@0.1.4` 源码提交 `94118e7cfb0fc96ce7c9854aad0859e8e468e8d9`，尤其是其可读文件名消毒、冲突规避和符号链接拒绝。项目没有安装该外部包：其 Composer 位置、自动插入 `@path`、10 MiB base64 Remote 载体和 Session 到 cwd 寻址，均替换为当前 `0.1.1-rc.2` 的 Slot、Workspace、WebServer 与浏览器信任合同。

## Alternatives considered

- **原样安装 `HongMing-Huang/dsh-file-upload`**——拒绝，因为其存储和客户端状态以 Session 为中心，默认 TTL 可能删除客户材料，当前 UI 仍有未解决的拖拽/引用故障，而且文本模型的图片处理可能把客户图片发送给自动发现的外部视觉端点。
- **原样安装 `dsh-local-file-upload`**——拒绝，因为它的回形针位于输入框，并立即追加 `@.dsh-uploads/...` mention。其存储机制是有价值的基线，但用户意图与只导入项目资料相反。
- **把官方图片附件联合扩展为通用文件**——拒绝，因为普通客户文档并不共享图片链路的验证、模型模态、历史渲染和提供方序列化语义。
- **把原件保存到隐藏的 `.fde/sources/` 目录**——当前切片拒绝，因为后续 VS Code 和文件树插件应当直接看到同一份权威文件，不需要第二套资源目录。隐藏的 FDE 元数据和派生物仍可进入 `.fde/`；客户原件保留在可见的 `fde-resources/`。

## Consequences

同一 Workspace 的每条 Session 都共享同一组普通客户文件；项目目录是权威事实，因此这些文件会跨浏览器刷新和 Host 重启保留。即使从 profile 移除上传能力，也不会删除已经提交的用户文件。Slot 让 FDE 业务行为留在 `ui-workspace` 之外，同时为后续项目动作提供相同的显式 owner currency。

这只是 F002 的第一个切片。当前没有 SourceId/Event、项目资料列表、预览、解析器、OCR、权限记录、版本关系、删除动作、拖拽或对话引用。multipart 解析器会在内存中缓冲一个有界请求体；100 MiB 文件内容上限加 1 MiB 信封余量是当前驻留上界。在出现带认证的远程项目上传前，该 route 继续只允许本机访问。未来对话附件路径可以复用已保存资源，但只有显式发送消息后，该资源才能对模型可见。

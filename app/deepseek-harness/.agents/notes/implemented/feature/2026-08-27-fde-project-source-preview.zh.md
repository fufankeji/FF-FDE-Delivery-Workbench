# Agent Note：FDE 项目来源在项目进度与项目交付中共享同一身份

状态：已实现

[English](2026-08-27-fde-project-source-preview.md) | 中文

## 问题

第一版 FDE 来源切片只能把普通文件保存到 `fde-resources/`，没有稳定的 Source 身份、处理投影和只读审阅路径。“项目进度”还以半透明 shell overlay 呈现，底层对话与输入框仍然可见。如果分别给项目进度和 Better Sidebar 实现预览，会形成两套格式矩阵与两套文件身份；如果把项目导入接到输入框，又会错误暗示需要触发 Agent。

## 决策

`@deepseek-ai/dsh-fde-source` 现在会为每份原件在 `.fde/sources/` 发布稳定记录。早于索引存在的文件会在项目首次列出时获得确定性的 SourceId。同源 list、file、parse 接口都必须携带明确的 WorkspaceId 与 SourceId；原件读取会再次校验项目边界，不接受任意绝对路径。本地转换使用 `@jiaoqsh/dsh-document@0.1.1`，把可替换的 Markdown 写入 `.fde/derived/`，并记录原件大小、修改时间和解析器版本。原件变化会让旧派生变为过期；解析失败或需要 OCR 只更新 Source 状态，不删除原件。

`@deepseek-ai/dsh-client-ui-fde-document-preview` 提供唯一的只读渲染组件。它通过 Better Sidebar 公开的 `registerFileViewer` 服务注册 Apache-2.0 Flyfish File Viewer 的 Word、Spreadsheet、Presentation Renderer，同时占用 FDE 项目页面声明的 `fde.project.source.preview` Slot。项目详情中的 PDF、图片和文本也使用同一封装；Better Sidebar 则继续保留其既有 PDF、图片和文本预览。由于 Harness 动态 Client Loader 无法解析包内相对分块，Renderer 代码会输出为一个 module-table 工件。

项目进度继续把 `shell.overlay` 仅作为官方 root 扩展点。页面打开时会标记当前页面状态，隐藏并禁用已经挂载的中央/详情工作区，隐藏 Better Sidebar Portal，并在常驻项目/会话左侧栏旁渲染完整、适配主题的页面。项目卡现在先进入只读“项目详情”。详情列出该项目的 Source 与真实保存/预览/解析状态，承载共享预览，允许重试本地解析，并提供明确的“进入项目交付”动作。关闭页面会恢复此前挂载的工作区，不改变项目、Session 或阶段。

项目行上传仍然不依赖 Conversation 或 Agent。原件持久发布后只广播一次项目级刷新通知，并仅对新保存且受支持的文件启动本地转换。Better Sidebar 消费该通知的唯一作用是清除当前可见文件树缓存。

## 考虑过的替代方案

**复制社区 Better Sidebar Office viewer。** 其当前包采用 AGPL-3.0，并包含较大的预构建适配；复制会改变分发义务，也会重复实现项目详情预览。

**原样安装通用文件上传插件。** 它的 Composer/Session 集成与已经确认的“项目持久化和明确对话意图分离”相冲突。

**只保存目录路径，并按文件名推断身份。** 文件名无法区分重名、改名或不同项目中的同名文件，两个页面会逐渐产生不同事实。

**替换应用路由器。** Harness 当前没有路由级页面 API。既有 root Slot 仍是最小兼容扩展点；本次把它的产品行为从透明覆盖层改成完整页面。

## 结果

项目现在能在来源导入、项目详情、Better Sidebar 和未来显式 Agent 引用之间保留唯一原件与唯一 Source 身份。DOCX、XLSX、PPTX、PDF、CSV、Markdown 和文本转换由测试运行时生成的样本覆盖，因此不会提交二进制 fixture。OCR、删除、权限/有效性、版本关系和对话引用仍属于独立的后续切片。

Office 浏览器模块会比普通 UI 插件更大，但只包含当前需要的三个 Renderer 家族，并作为单一的懒加载 Client 插件工件输出。打开项目进度时只隐藏、不卸载 Conversation 与 Details 树，既能保留原状态，也能确保独立页面不会透出或操作底层项目交付界面。

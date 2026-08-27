# @deepseek-ai/dsh-client-ui-fde-document-preview

[English](README.md) | 中文

FDE 项目详情页和 Better Sidebar 共用的只读项目资料预览。Office 渲染使用 Apache-2.0 的 File Viewer 包；插件不编辑原件、不创建消息，也不调用 Agent。

## 模型体验

无，因为本浏览器插件只渲染同源项目文件，不注册任何模型可见输入。

#### KV Cache 影响

无。

## 已知限制与延期工作

- 第一版渲染 Word OpenXML、表格和 PowerPoint OpenXML 家族；旧版 Word/PowerPoint、OCR 和音频不属于当前预览承诺。
- Office Renderer 是较大的懒加载 Client 工件，并按需包含其表格依赖所需的浏览器 process/buffer/stream shim。
- 预览保持只读；来源编辑、删除、版本关系、权限和 Agent 引用不属于本包范围。

# @deepseek-ai/dsh-client-ui-fde-document-preview

[English](README.md) | 中文

FDE 项目输入、固定阶段产出和 Better Sidebar 文件共用的只读预览。Office 渲染使用 Apache-2.0 的 File Viewer 包；插件不编辑原件、不创建消息，也不调用 Agent。

Office 文档固定使用 File Viewer 的浅色文档主题。即使操作系统或外围工作台使用深色主题，也保留原件常见的白色页面、浅色表格和深色文字对比。

File Viewer 按存储文件名扩展名选择 Renderer。HTTP MIME 继续作为响应和页面元数据；本插件不会把 `application/vnd...` 或 `text/csv; charset=utf-8` 等值传入 File Viewer 的扩展名覆盖字段。

PowerPoint OpenXML 渲染使用同源 `/vendor/pptx/pptx.worker.js` 中锁定版本的 File Viewer ES module Worker。Web 构建从依赖中复制该文件到 `dist`；生成的 Worker 不纳入源码版本管理。

## 模型体验

无，因为本浏览器插件只渲染同源项目文件，不注册任何模型可见输入。

#### KV Cache 影响

无。

## 已知限制与延期工作

- 第一版渲染 Word OpenXML、表格和 PowerPoint OpenXML 家族；旧版 Word/PowerPoint、OCR 和音频不属于当前预览承诺。
- Office Renderer 是较大的懒加载 Client 工件，并按需包含其表格依赖所需的浏览器 process/buffer/stream shim。
- 嵌入本 Client 插件的 Web 壳必须在 `/vendor/pptx/pptx.worker.js` 发布锁定版本的 Worker；资源缺失或返回非 JavaScript 内容时无法渲染幻灯片。
- 预览保持只读；来源编辑、删除、版本关系、权限和 Agent 引用不属于本包范围。

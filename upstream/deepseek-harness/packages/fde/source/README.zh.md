# @deepseek-ai/dsh-fde-source

[English](README.md) | 中文

FDE 项目来源的 Host 端能力。仅限本机同源的 multipart 请求会显式指定 Harness Workspace，在完整批次校验成功后，把原件发布到 `fde-resources/`，并在 `.fde/sources/` 建立稳定 Source 记录。独立的同源接口负责列出来源、读取一份经过校验的原件，以及在本地把文档转换为 `.fde/derived/` 中的 Markdown。

文件名、冲突处理和文件系统安全姿态参考了 MIT 许可的 [`dsh-local-file-upload`](https://github.com/zhangbo1201/dsh-file-upload) 源码提交 `94118e7cfb0fc96ce7c9854aad0859e8e468e8d9`；本包针对锁定的 Harness `0.1.1-rc.2` Workspace 与 WebServer 合同重新实现，不安装该外部插件。

## 模型体验

无，因为上传、列表、预览读取和本地转换都不会创建消息、工具、提示词、Agent 轮次或模型请求。

#### KV Cache 影响

无；系统不会组装或改变任何提供方请求。

## 已知限制与暂缓事项

- 当前默认限制为单文件 25 MiB、每批 20 个文件、每批文件内容合计 100 MiB。
- 本地转换已用运行时生成的 DOCX、XLSX、PPTX、PDF、CSV、Markdown 和文本样本验证。OCR、音频转写、来源权限、版本关系、删除和对话引用仍然延期。
- 原件变化后旧派生会标记过期；本地转换失败不会删除原件。
- 在产品建立带认证的远程上传边界前，该独立路由刻意只允许本机访问。

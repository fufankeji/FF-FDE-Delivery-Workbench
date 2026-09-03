---
document: feature-plan
feature: F002
status: ready
updated: "2026-08-27"
---

# F002 · 项目原始来源实施计划

## 现有上下文与复用

- `packages/fde/source` 已完成明确 WorkspaceId、安全批次保存和 `fde-resources/` 原件持久化。
- `packages/client/ui-fde-sources` 已提供项目行入口，且不依赖 Composer、Session 或 Agent。
- `dsh-better-sidebar@0.16.1` 已提供右侧 Files/Editor 及公开 `registerFileViewer` 扩展点；内置能力覆盖图片、PDF、Markdown、HTML 和代码，Office 需要补充 viewer。
- Office 浏览器预览采用 Apache-2.0 的 `@file-viewer/react` 与 Word/Spreadsheet/Presentation 三个按需 Renderer；PDF 沿用现有浏览器/Better Sidebar 预览，不复制 AGPL 社区 Office 插件源码，也不把完整 Office preset 的无关格式打进首版。
- 本地识别采用 MIT 的 `@jiaoqsh/dsh-document` 转换能力，并由 FDE Host 管理 SourceId、派生文件和状态；不默认注册模型工具。
- F011 项目详情声明只读资料预览 Slot；同一预览组件同时适配 Better Sidebar 文件查看器。

## 影响范围

| 路径/模块 | 计划变化 | 对应 AC |
|---|---|---|
| `packages/fde/source` | 增加 Source 记录、旧文件补索引、list/file/parse API、派生存储和版本校验 | 001～006 |
| `packages/client/ui-fde-sources` | 上传后刷新资料并启动本地识别；分别反馈保存和识别结果 | 001, 002, 004, 006 |
| `packages/client/ui-fde-document-preview` | 新增共享只读预览插件，注册 Office viewer 与项目详情 Slot | 002, 005 |
| `packages/client/ui-fde-project` | 只读项目详情、资料清单、识别状态/重试和预览宿主 | 005, 006 |
| `apps/web` | 随 Web 构建发布锁定版本的 PPTX Worker 静态资源 | 005 |
| `dsh-better-sidebar` 组合 | 用公开 viewer 服务打开 Office 原件，保留现有 PDF/文本/图片能力 | 005 |
| Bundle/类型/第三方记录 | 锁定依赖、组合 Host/Client package 与许可证 | 全部 |

## 实现方案

Host 在 `.fde/sources/` 保存每 Source 一份 JSON 记录，在 `.fde/derived/` 保存可再生成的 Markdown 与元数据。上传完成后原件与 Source 记录共同发布；列表时只扫描当前 Workspace 的 `fde-resources/`，为历史原件补建确定性记录。所有文件读取以 WorkspaceId＋SourceId 定位并再次校验规范路径，不接受绝对路径或外部 URL。

解析 API 对受支持文件执行本地转换，先写临时派生再原子替换；记录原件大小、修改时间和解析器版本。提取为空且格式可能为扫描件时返回“需要 OCR”，不调用模型。原件改变后列表把派生标记为过期。

新增独立 Client Package `ui-fde-document-preview`，内部封装 Flyfish file-viewer。它通过 Better Sidebar 的 `registerFileViewer` 注册 DOCX/XLSX/PPTX 查看器，同时占用 F011 的项目资料预览 Slot，因此两个页面不会复制格式判断或 Office 渲染逻辑。F011 只负责选中 Source 与状态；预览插件只负责只读渲染。

Office 原件保留自身常见的白纸/浅色表格视觉语义。共享预览器显式使用 File Viewer 的 `light` theme，不读取系统深色偏好；因此 Word、Spreadsheet 和 Presentation 三个 Renderer 使用同一可读模式，而工作台外围仍由 Harness/F016 主题控制。File Viewer 的 `type` 参数表示扩展名而不是 MIME；共享预览器提供带扩展名的存储文件名并让 Viewer 自行解析格式，不用 Host MIME 覆盖该结果。原件响应、字符集和下载内容保持不变。

Presentation Renderer 通过 ES module Worker 解析 PPTX。Harness 的动态 Client bundle 不能依赖第三方包中基于 `import.meta.url` 的相对 Worker 定位，因此 Web 构建从锁定依赖复制 Worker 到同源 `/vendor/pptx/pptx.worker.js`，共享预览器显式传入该 URL 和 `module` 类型。Worker 不纳入源码目录或 Git 历史，只作为可再生成的 Web `dist` 产物发布。

## 实施顺序

1. 更新 PRD、Product Spec、Feature Map、Architecture 与 F002/F011 三件套。
2. 锁定并验证预览、解析依赖与许可证。
3. 实现 Source 记录、历史文件补索引、受控读取、派生存储与解析状态。
4. 实现共享预览 Client Plugin 和 Better Sidebar Office viewer。
5. 在 F011 项目详情中接入资料清单、状态、预览和重试；上传后刷新并本地识别。
6. 用运行时生成的 DOCX/XLSX/PPTX/PDF/Markdown/TXT/CSV/图片样本完成聚焦测试、构建和人工验收交接。

## 依赖与风险

| 风险 | 应对 | 验证 |
|---|---|---|
| Office/PDF 文件不可信或结构异常 | 限制原件大小；浏览器只读沙箱式渲染；Host 本地有界解析；错误不影响原件 | 多格式/损坏样本测试 |
| 预览包体较大 | Viewer 组件按格式动态加载；不阻塞工作台首屏 | Client build |
| 解析器与当前 DSH 版本不一致 | 只复用独立转换 API，不启用其 Agent tool；锁定版本并用当前 monorepo 构建 | Host 类型检查/测试 |
| 历史文件没有 Source 记录 | 当前项目列表时补建确定性记录，不复制文件 | 旧目录迁移测试 |
| 文件树缓存不刷新 | 上传成功发布项目资料变更事件；Better Sidebar 刷新或重新列出 | Client 聚焦测试＋人工验证 |
| 原件被工程工具修改 | 每次列出/解析比较 size＋mtime，旧派生标记过期 | Host 版本测试 |
| Office Renderer 跟随系统深色但未完整反转原件颜色 | 共享预览器固定使用 `light`，保持原件深色文字与浅色页面的常见对比 | 组件聚焦测试＋人工真实文件复验 |
| 项目详情把 MIME 误传为 File Viewer 扩展名，导致 Office/CSV/TSV 均无法命中 Renderer | Viewer 按存储文件名扩展名分发；MIME 只用于响应与页面元数据 | 组件聚焦测试＋人工真实文件复验 |
| PPTX Renderer 已命中但 Worker 未随 Harness Web 发布，页面只显示工具栏和空白正文 | Web 构建复制锁定版本 Worker；预览器使用明确的同源 URL 和 module Worker | 组件聚焦测试＋构建产物/HTTP 资源检查＋人工真实 PPTX 复验 |

## 回退策略

预览插件和解析路由均可从 Bundle 独立移除；原件和 Source 记录仍保留。派生目录是可再生成数据，可安全忽略但不在运行回退中主动删除。任何回退都不得删除 `fde-resources/` 用户原件。

## 验收映射

| AC | 最窄验证方法 |
|---|---|
| AC-F002-001, AC-F002-003, AC-F002-004 | Source/上传 Host 聚焦测试 |
| AC-F002-002 | Client 注册与无 Agent 依赖测试 |
| AC-F002-005 | 共享 viewer 注册＋项目详情组件测试 |
| AC-F002-006 | 运行时生成多格式样本的解析/过期/失败测试 |

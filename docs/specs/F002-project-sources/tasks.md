---
document: feature-tasks
feature: F002
status: in-progress
updated: "2026-08-27"
---

# F002 · 项目原始来源任务

## 任务规则

- 原件、预览、识别与 Agent 使用分别验收。
- 测试文件在测试运行时生成，不把 Office/PDF 二进制样本提交到 Git。
- 只有真实证据和最窄验证通过后才勾选。

## 任务清单

- [x] T001 冻结项目资料导入与对话引用边界
  - 来源：REQ-008, REQ-010, REQ-016, NFR-001, NFR-002, NFR-005, NFR-007, NFR-008, PSC-003, PSC-005, PSC-011, PSC-012, PSC-016, PSC-018, PSC-024, AC-F002-001～AC-F002-006
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F002/F011 三件套
  - 完成证据：保存、来源身份、双入口预览、本地识别和 Agent 边界已冻结
  - 验证：PRD、Product Spec 与 Feature Spec 校验器

- [x] T002 建立项目级安全批次存储
  - 来源：REQ-008, NFR-001, NFR-007, PSC-003, PSC-011, PSC-012, AC-F002-001, AC-F002-003, AC-F002-004
  - 依赖：T001
  - 修改：`packages/fde/source` 上传与存储
  - 完成证据：明确 WorkspaceId 的批次无覆盖发布到 `fde-resources/`
  - 验证：FDE Source Host 聚焦测试

- [x] T003 为项目行提供可组合资料动作
  - 来源：REQ-008, NFR-005, PSC-016, AC-F002-001, AC-F002-002
  - 依赖：T001
  - 修改：`ui-workspace` 项目 action Slot
  - 完成证据：真实项目行可组合资料动作，原项目/会话入口不变
  - 验证：ui-workspace 聚焦组件测试

- [x] T004 实现不触发 Agent 的添加项目资料入口
  - 来源：REQ-008, REQ-010, NFR-002, PSC-005, PSC-016, AC-F002-001, AC-F002-002, AC-F002-004
  - 依赖：T002, T003
  - 修改：`packages/client/ui-fde-sources`
  - 完成证据：可多选上传并反馈成功/失败，组件不访问 Composer/Agent
  - 验证：ui-fde-sources 聚焦测试

- [x] T005 组合 FDE Source 能力并保持上游可构建
  - 来源：REQ-008, NFR-007, PSC-012, AC-F002-001～AC-F002-004
  - 依赖：T002, T004
  - 修改：Web Bundle、TypeScript 聚合与包文档
  - 完成证据：Host/Client 插件在 Web Profile 启用
  - 验证：Cordis 配置与目标构建

- [x] T006 构建、重启并交付首个存储切片人工验收
  - 来源：REQ-008, NFR-007, PSC-011, PSC-012, AC-F002-001～AC-F002-004
  - 依赖：T005
  - 修改：验证记录与运行服务
  - 完成证据：首个存储切片聚焦测试、构建和 3080 启动通过
  - 验证：聚焦测试＋官方构建＋HTTP

- [x] T007 建立稳定来源记录和受控读取
  - 来源：REQ-008, REQ-016, NFR-001, NFR-007, NFR-008, PSC-003, PSC-011, PSC-012, PSC-018, PSC-024, AC-F002-001, AC-F002-003, AC-F002-004, AC-F002-005
  - 依赖：T002
  - 修改：Source 记录、旧文件补索引、list/file API、安全路径测试
  - 完成证据：新旧原件均可按稳定 SourceId 列出和受控读取
  - 验证：FDE Source Host 聚焦测试

- [x] T008 建立本地识别与派生存储
  - 来源：REQ-008, REQ-010, NFR-001, NFR-002, NFR-007, NFR-008, PSC-003, PSC-005, PSC-011, PSC-012, PSC-016, PSC-024, AC-F002-002, AC-F002-006
  - 依赖：T007
  - 修改：parse API、解析器适配、`.fde/derived/`、过期/失败/需要 OCR 状态
  - 完成证据：受支持格式生成带版本的派生 Markdown，失败保留原件
  - 验证：多格式转换与版本测试

- [x] T009 建立双入口共享只读预览
  - 来源：REQ-008, REQ-016, NFR-002, NFR-005, NFR-007, NFR-008, PSC-012, PSC-016, PSC-018, PSC-024, AC-F002-002, AC-F002-005
  - 依赖：T007
  - 修改：`ui-fde-document-preview`、Better Sidebar Office viewer、项目详情预览 Slot
  - 完成证据：两个入口使用同一只读 Office/PDF/文本预览合同
  - 验证：viewer 注册和组件聚焦测试

- [x] T010 接通项目资料状态和刷新
  - 来源：REQ-008, REQ-016, NFR-005, NFR-007, PSC-003, PSC-018, PSC-024, AC-F002-001, AC-F002-005, AC-F002-006
  - 依赖：T007, T008, T009
  - 修改：上传返回 SourceId、资料刷新事件、项目详情列表、识别状态与重试
  - 完成证据：上传、资料列表、识别和重试在两个页面状态一致
  - 验证：F002/F011 Client 聚焦测试

- [x] T011 生成多格式样本并完成交付验证
  - 来源：REQ-008, REQ-010, REQ-016, NFR-001, NFR-002, NFR-005, NFR-007, NFR-008, PSC-003, PSC-005, PSC-011, PSC-012, PSC-016, PSC-018, PSC-024, AC-F002-001～AC-F002-006
  - 依赖：T008, T009, T010
  - 修改：运行时样本构造、许可证记录、Bundle、验证记录和运行服务
  - 完成证据：多格式样本、聚焦测试、构建和 3080 运行均通过
  - 验证：聚焦测试＋官方构建＋HTTP/Boot；不执行浏览器截图自动化

- [x] T012 固定 Office 浅色预览并恢复文字可读性
  - 来源：REQ-008, REQ-016, NFR-005, AC-F002-005
  - 依赖：T009
  - 修改：共享 `DocumentPreview` 的 File Viewer theme、组件回归测试、验证记录
  - 完成证据：DOCX/XLSX/PPTX 在系统深色模式下仍使用浅色文档画布，深色正文和单元格内容可见；工作台主题与原件保持不变
  - 验证：预览组件聚焦测试、TypeScript、Lint、目标 bundle 与 Web 构建；真实文件效果由用户人工复验

- [x] T013 修复项目详情的 Office 与表格格式分发
  - 来源：REQ-008, REQ-016, NFR-005, AC-F002-005
  - 依赖：T009
  - 修改：项目详情到共享 `DocumentPreview` 的格式输入、组件回归测试、包文档和验证记录
  - 完成证据：项目详情不再把 MIME 传入 File Viewer 的扩展名字段，DOCX/XLSX/PPTX/CSV/TSV 均按存储文件名扩展名选择 Renderer；原件响应和下载内容保持不变
  - 验证：预览组件聚焦测试、TypeScript、Lint、目标 bundle 与 Web 构建；真实 Office/CSV/TSV 效果由用户人工复验

- [x] T014 发布 PPTX Renderer 所需的同源 Worker
  - 来源：REQ-008, REQ-016, NFR-005, AC-F002-005
  - 依赖：T009, T013
  - 修改：Web 构建中的 PPTX Worker 资源、共享 `DocumentPreview` 的 Worker URL、组件回归测试和验证记录
  - 完成证据：锁定版本的 `pptx.worker.js` 随 Web `dist` 发布并可由 3080 同源读取；PPTX Viewer 使用该 module Worker，不再停留在只有工具栏的空白正文
  - 验证：预览组件聚焦测试、目标 bundle、Web 构建产物与 Worker HTTP 检查；真实 PPTX 内容由用户人工复验

## Task 数量复核

- 任务总数：14
- 本轮新增 5 个交付能力结果，并依据真实文件人工验收增加 3 个共享预览兼容性修复任务。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 剩余项 |
|---|---|---|---|
| 2026-08-26 | storage-slice-complete | T001～T006 完成，原件可安全保存且不触发 Agent | 来源列表、预览和识别未完成 |
| 2026-08-27 | in-progress | 用户确认共享原件、双入口预览和本地识别方案并授权开发 | T007～T011 待完成 |
| 2026-08-27 | current-slice-complete | T007～T011 完成：稳定 SourceId、历史原件补索引、同源 list/file/parse、本地派生、项目详情/Better Sidebar 共享预览、上传/文件树刷新和运行时多格式样本均已实现；25 项聚焦测试、完整构建、文档同步和 3080 启动通过 | OCR、权限/有效性、版本/删除和对话显式引用仍按上游合同延期；视觉效果等待用户人工验收 |
| 2026-08-27 | in-progress | 用户用真实 DOCX/XLSX 复验发现系统深色预览使 Office 页面变黑，XLSX 深色文字与背景重叠不可读，新增 T012 | 固定共享 Office 预览为浅色文档模式，不修改文件或全局工作台主题 |
| 2026-08-27 | implementation-ready-for-manual-review | T012 已完成：共享 Office Viewer 从 `system` 固定为 `light`；组件测试、TypeScript、Lint、目标 bundle、Web 构建与 3080 HTTP 检查通过 | 不运行浏览器截图；等待用户复验真实 DOCX/XLSX/PPTX 的颜色与文字可读性 |
| 2026-08-27 | in-progress | 用户用真实 CSV 复验发现 `text/csv; charset=utf-8` 被 Office Viewer 误判为不支持，新增 T013 | 标准化共享预览器的 MIME 分发，不修改原件响应与文件内容 |
| 2026-08-27 | manual-review-failed | 用户复验确认项目详情中的 DOCX/XLSX/PPTX/CSV 仍被判定为不支持；源码核对发现 File Viewer 的 `type` 参数表示扩展名而不是 MIME | 纠正 T013：项目详情按存储文件名扩展名分发，不再把 MIME 传给 Viewer `type` |
| 2026-08-27 | implementation-ready-for-manual-review | T013 已按真实 File Viewer 合同完成：项目详情移除 MIME 覆盖并保留存储文件名；DOCX/XLSX/PPTX/CSV/TSV 回归、类型、Lint、目标 bundle、Web 构建与 3080 HTTP 检查通过 | 不运行浏览器截图；等待用户复验项目详情中的真实 Office/CSV/TSV |
| 2026-08-27 | manual-review-failed | 用户复验确认 PPTX 已命中 Presentation Renderer 并显示工具栏，但正文保持空白；锁定依赖源码与运行资源检查确认 Renderer 必需的 module Worker 未随 Web 发布，`/vendor/pptx/pptx.worker.js` 返回 404 | 执行 T014；不修改 PPTX 原件、来源索引或其他格式 Renderer |
| 2026-08-27 | implementation-ready-for-manual-review | T014 已完成：共享预览器显式使用同源 module Worker；Web 构建从锁定依赖生成 577,289 bytes Worker，构建产物与依赖字节一致；组件 7 项测试、目标类型检查、Lint、bundle、336 modules Web 构建通过，运行资源返回 HTTP 200 `text/javascript` 且字节一致 | 不运行浏览器截图；等待用户刷新并复验真实 PPTX 幻灯片内容 |

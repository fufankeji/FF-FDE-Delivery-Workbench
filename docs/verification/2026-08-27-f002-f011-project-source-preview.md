# F002/F011 项目资料识别、双入口预览与独立项目进度验证

日期：2026-08-27  
运行地址：<http://127.0.0.1:3080>

## 本轮结果

- 项目原件继续只保存于 `fde-resources/`，每份原件在 `.fde/sources/` 建立稳定 SourceId；早于索引存在的原件在首次列出时补建确定性记录，不复制原件。
- 新增同源 `list`、`file`、`parse` 路由。原件读取必须使用明确 WorkspaceId/SourceId，并再次校验真实路径与项目边界。
- 本地识别使用锁定的 `@jiaoqsh/dsh-document@0.1.1`，派生 Markdown 保存到 `.fde/derived/`；原件改变后旧派生标记过期，失败/需要 OCR 不删除原件，也不调用模型。
- 新增共享只读预览 Client Plugin。项目详情与 Better Sidebar 使用同一 Office 渲染封装；Word、Spreadsheet、Presentation Renderer 按需打包，PDF/图片/文本复用现有或浏览器能力。
- 项目进度仍使用官方 root Slot 作为挂载点，但产品上已改为完整页面：打开时底层对话、输入框、Details 与 Better Sidebar 被隐藏并禁用；关闭后恢复原挂载状态。
- 项目卡先打开只读项目详情，展示项目资料、格式、大小、预览/识别状态、识别重试与“进入项目交付”。
- 上传成功后刷新项目详情和当前项目文件树，并仅对新保存且可识别的资料启动本地转换；不修改草稿、不创建消息、不触发 Agent。

## 自动验证

| 验证 | 结果 | 证据 |
|---|---|---|
| PRD 校验 | 通过 | confirmed；20 REQ、10 NFR、19 AC |
| Product Spec 校验 | 通过 | confirmed；24 PSC |
| Feature 校验 | 本轮 F002/F011 通过 | 剩余错误仅为既有 F003～F007 未建目录与 F012～F015 旧状态名，本轮未扩大范围处理 |
| F002/F011/预览聚焦测试 | 通过 | 12 个测试文件、25 项测试全部通过 |
| 多格式本地识别 | 通过 | 测试运行时生成 DOCX、XLSX、PPTX、PDF、CSV、Markdown、TXT；均生成包含预期内容的派生 Markdown，不提交二进制 fixture |
| 来源安全与恢复 | 通过 | 稳定 ID、历史原件补索引、跨项目 Source 拒绝、重名不覆盖、派生过期、损坏 Office 保留原件均有测试 |
| Client/Host 类型与完整构建 | 通过 | `pnpm run build` 完成 Host、Client、Web；记录 216 个 Client 工件 |
| 文档同步 | 通过 | 导出 JSDoc、Client/Config/Module/Third-party 目录刷新；`doc-sync` 全部门完成 |
| 运行组合 | 通过 | PID 23800 监听 `127.0.0.1:3080`；根页面 HTTP 200；Source list 路由对未知项目返回真实 404；Boot 清单包含 project、sources、document-preview 三个 Client Plugin；共享预览工件 HTTP 200、4,275,225 bytes |
| Office 浅色预览修复 | 通过 | `DocumentPreview` 显式使用 `theme: 'light'`；新增组件测试确认 Office Viewer 不再继承系统深色偏好；TypeScript、定向 Lint、目标 bundle 和 336 modules Web 构建通过 |
| 修复后运行服务 | 通过 | PID 38670 监听 `127.0.0.1:3080`，根页面 HTTP 200；真实 DOCX/XLSX/PPTX 视觉效果待用户人工复验 |
| 首次 CSV MIME 修复 | 人工验收未通过 | 仅把 `text/csv; charset=utf-8` 标准化为 `text/csv` 仍不符合 File Viewer 合同；其 `type` 参数表示文件扩展名，项目详情中的 DOCX/XLSX/PPTX/CSV 均继续显示不支持 |
| 首次修复后运行服务 | 通过 | PID 39961 监听 `127.0.0.1:3080`，根页面 HTTP 200；运行可用，但真实格式预览人工验收未通过 |
| Office/表格扩展名分发修复 | 通过 | 项目详情不再把 Source MIME 传给 File Viewer `type`，Viewer 从 `storedName` 推断扩展名；File Viewer 2.4.0 `normalizeSource` 实测依次得到 `docx,xlsx,pptx,csv,tsv`；组件回归覆盖五种格式，预览包共 2 个测试文件、7 项测试通过；TypeScript、定向 Lint、目标 bundle 和 336 modules Web 构建通过 |
| 扩展名修复后运行服务 | 通过 | PID 41690 监听 `127.0.0.1:3080`，根页面 HTTP 200；真实 Office/CSV/TSV 效果待用户人工复验 |
| PPTX Worker 人工复验 | 未通过 | 真实 PPTX 已显示 Presentation 工具栏但正文空白；样本 ZIP 结构完整，锁定 Renderer 2.4.0 明确通过 module Worker 解析，而运行中的 `/vendor/pptx/pptx.worker.js` 返回 HTTP 404；进入 T014 修复 |
| PPTX Worker 发布修复 | 通过 | `DocumentPreview` 显式配置同源 `/vendor/pptx/pptx.worker.js` 与 `workerType: module`；组件 2 个测试文件、7 项测试通过，目标包 `tsc --noEmit`、定向 Lint、4.28 MB Client bundle 和 336 modules Web 构建通过 |
| PPTX Worker 构建与运行资源 | 通过 | `dist/vendor/pptx/pptx.worker.js` 为 577,289 bytes，与 `@file-viewer/pptx@2.4.0` 源 Worker 逐字节一致；PID 43892 的 3080 服务返回 HTTP 200、`content-type: text/javascript; charset=utf-8`，下载字节与 `dist` 一致；根页面 HTTP 200 |
| 工作区聚合 TypeScript build | 非本轮阻塞 | `tsc -b packages/client/ui-fde-document-preview/tsconfig.json` 被并行未完成的 `ui-fde-project/RequirementWikiPanel.tsx:53-54` 两项 `snapshot possibly undefined` 挡住；本轮未修改该文件，目标预览包独立 `tsc --noEmit` 已通过 |

## 依赖与分发边界

- `@jiaoqsh/dsh-document@0.1.1`：MIT；只复用本地转换接口，不注册其模型工具。
- `@file-viewer/react@2.4.0` 与 Word/Spreadsheet/Presentation Renderer：Apache-2.0；Client 工件关闭代码分块，以适配 Harness module-table Loader。
- 未复制 AGPL 社区 Office viewer 源码。
- Better Sidebar 本地补丁增加项目资料变更后的文件树刷新监听；补丁已重新生成并写入锁文件。

## 人工验收范围

按协同开发规则，本轮没有运行浏览器自动截图、视觉对比或完整 E2E。请在当前 3080 页面手动检查：

1. “项目进度”是否成为不透出底层会话的完整页面。
2. 点击“查看项目”后，项目资料列表、状态和预览布局是否清晰。
3. 上传真实 DOCX/XLSX/PPTX/PDF/CSV 后，项目详情与右侧文件树是否及时出现，Office 文件能否打开，带 UTF-8 字符集参数的 CSV 能否显示表格内容。
4. 真实 PPTX 是否在工具栏下显示幻灯片正文，而不是停留在空白区域。
5. 关闭项目进度或点击“进入项目交付”后，原会话与右侧开发工作区是否正常恢复。

## 人工反馈修复

- 用户首次打开项目详情时，项目资料列表显示 `Failed to execute 'fetch' on 'Window': Illegal invocation`。原因是 Source 控制器把浏览器原生 `fetch` 保存为实例成员后以控制器对象作为接收者调用。
- 控制器现于创建时把请求实现绑定到浏览器全局对象；新增接收者回归测试，项目资料加载与既有加载、识别、上传事件刷新测试共 1 个测试文件、2 项测试通过。
- `@deepseek-ai/dsh-client-ui-fde-project` Client Plugin 已重新构建，Web 已重新启动于 <http://127.0.0.1:3080>；未执行浏览器截图自动化，等待用户刷新页面人工确认。
- 用户继续复验确认项目详情中的 DOCX/XLSX/PPTX/CSV 均显示不支持，而图片和 PDF 正常。File Viewer 源码确认其 `type` 参数表示扩展名；项目详情把 MIME 传入该字段覆盖了文件名推断，首次只去除 MIME 参数的修复因此无效。T013 已纠正为按存储文件名扩展名分发。
- 项目详情现只把受控 Source URL、`storedName`、字节和预览类别交给共享预览器；File Viewer 从 `storedName` 解析扩展名。右侧文件树继续使用相同文件名推断方式，Host MIME、字符集、原件和下载内容均未改变。
- 用户复验后 PPTX 已进入 Presentation Renderer，但只显示工具栏和空白正文。真实文件通过 ZIP 完整性检查且包含 10 张幻灯片；源码核对确认 `@file-viewer/pptx@2.4.0` 必须启动 ES module Worker，而 Harness 动态 Client bundle 中第三方 `import.meta.url` 被转写后不能定位包内 Worker，运行服务也未发布默认 `/vendor/pptx/pptx.worker.js`。T014 只补齐同源 Worker 构建和明确 URL，不改原件或其他 Renderer。
- Web 构建现把锁定依赖的 Worker 复制到 `dist/vendor/pptx/pptx.worker.js`，共享预览器显式使用该同源 module Worker。生成文件不进入源码或 Git；运行中的 Worker URL 已验证为 JavaScript 且字节匹配。未运行浏览器自动化，真实幻灯片渲染等待用户刷新后人工确认。

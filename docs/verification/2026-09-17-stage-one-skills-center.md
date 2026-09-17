# 第一阶段技能中心实现与验证

日期：2026-09-17。对应 REQ-034、PSC-028、F026。状态：已实现但存在验收缺口（IMPLEMENTED_WITH_GAPS）；人工视觉与实际下载体验待用户确认。

后续人工检查发现前端 ZIP 依赖导入失败；已在主分支修复并补充构建包导入检查，当前入口改为主目录 3080。下方 3084 记录保留为当时证据，不代表完整插件启动已通过；修复、合并与清理结果见[后续记录](2026-09-17-skills-import-main-cleanup.md)。

## 本轮范围

- 按用户确认的 1117 × 704 内容区截图实现标题、雪山装饰、七张彩色卡片、搜索、查看和下载；保留原平台侧栏，不把裁剪图当作移除侧栏的授权。
- 只展示第一阶段七个真实 Skill，不增加其他阶段占位或安装、运行、编辑入口。详情使用独立阅读页面，首次打开 `SKILL.md`，左侧仅列出当前包实际提供的四个文件。
- 复用 Host 已注册目录和正文，每个适配包包含 `SKILL.md`、`README.md`、`LICENSE`、`NOTICE.md`。阅读、单文件下载和整包 ZIP 使用同一内容对象，不读取或导出客户项目文件。
- README 明确保留工作台路径与辅助方法依赖；外部参考文件不虚构为包内文件，也不宣称在其他 Agent 中开箱即用。
- 总览中的技能入口同步由“待接入”改为“第一阶段”；项目中心、实验室、设置和原项目阶段方法入口不替换。

## 定向验证

| 项目 | 方法与结果 | 证据范围 |
|---|---|---|
| 七个适配包 | `skills-center-data.client.spec.ts`，4 项通过 | 真实 Host 目录、正文与 frontmatter、许可证、七包 ZIP 解压逐文件字节一致、搜索与无效目录拒绝 |
| 浏览与下载交互 | `skills-center.client.spec.tsx`，3 项通过 | 默认卡片、目录与可见用途搜索、Markdown 与文件切换、返回后查询/滚动/焦点恢复、空结果、读取重试、整包/单文件下载调用和下载失败提示 |
| 既有导航直接影响面 | `workbench-navigation.client.spec.tsx`，5 项通过 | 四个平级入口、设置/主页路径、技能入口文案、总览不额外读取技能目录 |
| 产品规格链 | PRD、Product Spec、F026 就绪预检通过 | 34 个需求、14 个非功能要求、31 个项目验收项、28 个全局合同；F026 保留人工任务未完成 |
| 完整构建 | `corepack pnpm run build`，退出码 0 | Host 与 Client 类型检查及 Client Bundle 构建；构建中发现的测试文件分类/未使用导入问题已修复 |
| 上游文档配对 | `verify-translation-pairing` 指定 README 与本轮实现记录，2 对通过 | 仅遵循上游既有双语记录合同；产品规格仍为简体中文单一来源 |

测试合计 12 个不同用例。最终源码影响的两个新测试文件已通过；随后只改动的组件测试也已定向复跑通过。不重复运行无关测试，不以组件测试代替浏览器视觉验收。

## 3084 在线构建与隔离

- 启动目录：`FDEDeliveryWorkbench/.worktrees/platform-navigation/upstream/deepseek-harness`。
- 启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3084`。
- 本轮监听 PID：`7384`；进程工作目录和显式 `DSH_HOME` 均符合当前 worktree 隔离规则。主工作树 3080 未重启。
- 本地鉴权交换返回 303，携 Cookie 的首页返回 200；首页真实 Boot Manifest 包含 62 个 Client 条目。
- 在线项目 Bundle：`/plugins/??@deepseek-ai/dsh-client-ui-fde-project/client.js&rev=dd271d96fac1437b-37`，返回 200，包含技能中心、`SKILL.md`、`NOTICE.md` 和第七个 Skill 标识。SHA-256：`7aeea4185b7f3b26bebb786a806a80fe47cd8fbcbc881f41c32f4eab0858eacf`。
- 在线主题 Bundle：`/plugins/??@deepseek-ai/dsh-client-ui-theme/client.js&rev=dd271d96fac1437b-8`，返回 200，包含本轮技能主题别名。SHA-256：`3220b1964b4b4277dc1c5174fb3e315db4747a710ca724cb82490a0ace45c2f3`。
- `/api/fde-stage/skills` 返回 200；`requirements` 阶段实际返回已确认的七个方法。
- 十个 `/fde-skills/` 静态资产全部返回 200，在线字节与源码资产一致，合计 41,570 字节。
- 隔离 `workspace.json` 中三个 Workspace 均指向当前 worktree 的 `.runtime/workspaces/`。没有修改或导出事实源项目数据。

## 视觉验收边界

本轮使用 `ui-fidelity-replication` 做内容区基准与资产预检；已使用真实 DOM 实现文字、布局和交互，仅从授权图片提取不含文字/控件的装饰纹理。详情页没有用户确认的像素参考，只承接已确认的阅读合同。

按项目人工优先规则，本轮未打开自动化浏览器、未截图、未做像素差异测量。参考截图的字体、DPR 和页面缩放缺少精确元数据，现以估计值实现。构建、资源响应和测试不能证明 1:1 视觉通过；F026-T004 保持未完成。

用户验收入口：打开 `http://127.0.0.1:3084`，进入“技能中心”，确认默认卡片观感、搜索、查看后的文件阅读和返回，再试下载整包与当前文件。根据反馈仅调整本轮内容区。

## 资产与临时状态

- 正式小型 UI 资产位于 `upstream/deepseek-harness/apps/web/public/fde-skills/`，十个 WebP 共约 41 KB；它们是页面运行依赖，随源码保留。
- 本轮临时预检、提取脚本和构建/预览日志位于 `/tmp/codex-ui-fidelity-stage-one-ROXFsp`，交付时约 424 KB。事实源是用户定稿图与当前源码，可由预检、提取和构建重新生成；人工验收完成且 3084 预览进程停止后可清理。预览日志包含本地鉴权启动链接，不应提交或对外分享。
- 复用已有 worktree、依赖和隔离运行区；没有新建持久备份、复制项目、提交或推送。

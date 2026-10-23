# 平台 Skill 原版完整展示与下载验证

本记录对应标准化前的原版快照方案，现已被同日“平台专属中文标准 Skill”方案替代；以下保留当时的验证事实，不代表当前运行结构。

## 已确认范围

用户指出原“平台内置”只是精简适配正文，明确要求完整展示与完整下载。本轮替代 F026 原四文件适配包方案，仍保留七个条目、课程原版、来源筛选、阅读弹窗和原有项目入口；不替换 Agent 运行适配方法，不安装或执行原版内容。

## 固定原件与内容源

两个已有研究仓库均保持干净：davidahmann/fde-guide 固定在 `060ef0f3b67743b2e1fc3705763d423eae980236`，rpraharaj/forward-deployed-engineer 固定在 `ee045a66db5242617ccea9e5e33139a2980ab55e`。源目录为项目根 `.references/fde-skills/`，没有新建 checkout 或改写原件。

`upstream/deepseek-harness/packages/client/ui-fde-project/src/client/platform-skills/originals.json` 是随平台交付的原版资源源码，3,037,556 字节（约 2.9 MiB）。它按来源去重保存 240 + 11 个文件；两个方法型 Skill 的引用网络相连，因此各自下载均包含这套完整配套资料。其他引用中的 Skill 只是原版资料，不新增平台卡片或 Agent 注册。原始正文、元数据、模板、Schema、示例、图片、PDF 和实际许可均不改写；脚本不会执行这些文件。

| 条目 | 下载文件数（含配套资料与许可） |
|---|---:|
| qualify-ai-workflow | 240 |
| fde-orient | 4 |
| knowledge-interview | 4 |
| ownership-map | 2 |
| repo-recon | 5 |
| stakeholder-brief | 3 |
| reframe-ai-engagement | 240 |

原仓库相对路径保留，默认打开实际入口 SKILL.md 并展开祖先目录。用户提供的 fde-business-diagnosis 六文件快照不变。快照无需外部研究目录在线；维护脚本以固定源重新生成补丁，默认模式只做完整性比较。它是本次明确要求交付的原始资源，不是构建缓存；不能按缓存清理。没有另存 ZIP 或重复原文目录。

## 验证结果

命令 cwd 为 `upstream/deepseek-harness/`。

- `node packages/client/ui-fde-project/scripts/import-platform-skills.mjs`：通过；快照与干净固定原件完全一致，包含行内、引用式 Markdown、本地文件引用和 Schema 引用的配套文件。
- 定向 Vitest 按受影响项分批运行：数据/ZIP 8 项、阅读器组件 9 项，共 17 项通过。每个 ZIP 条目的 SHA-256 与原件登记一致，文件路径一致；覆盖原版入口、元数据、模板/共享资料跳转、图片/PDF 原件下载、来源筛选、错误恢复、目录收起、焦点、放大、关闭恢复和课程保持。
- 大包下载检查暴露 TextEncoder 与 fflate 的 Uint8Array 运行环境差异；ZIP 编码前统一为当前环境字节数组后，整包按钮检查通过。调试中的未完成测试进程已停止，临时日志语句已移除。
- `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json`：退出 0。
- `scripts/run-oxlint.ts` 定向检查本轮五个 TypeScript/TSX 文件：退出 0；`findUiI18nViolations` 检查阅读器零违规。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`：退出 0；共享 Markdown 未修改，无须重建 Web 静态外壳。已有跨平台包提示保留，未做全仓发布构建。
- PRD、Product Spec 与 F026 校验通过；包 README 按既有中英合同更新并校验配对。

## 在线与数据隔离

最终服务 PID `83324`，cwd 为主仓 `upstream/deepseek-harness/`，显式 DSH_HOME 为项目根 `.runtime/dsh-home`，沿用已授权的 `--lan --port 3080`。本机及 `http://192.168.110.19:3080` 首页 HTTP 200；目录接口 HTTP 200，第一阶段仍为七个适配运行方法；局域网地址的 WebSocket 握手为 101。局域网检查来自本机地址访问，不冒充另一台物理设备验收。

Boot revision 为 `7faf14eee007`，在线项目包 revision 为 `b8c3cf0259573b0d-37`，8,696,320 字节，SHA-256 为 `85231eb576d8345db10f7867285d5076f1c569c089260e3761fc5e358969faa1`。在线包与本地可执行字节一致，仅服务端分隔符及 source map 尾注不同；完整原版资源和新说明已进入实际加载包。

重启前后 Workspace 登记 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`。未读取凭据、调用模型、编辑课程原件、修改 Agent 注册、提交或推送 GitHub。原部署手册草稿、README 部署入口和旧构建记录保持本地原状。

## 留存与人工确认

没有自动浏览器点击、截图或录屏；真实观感、浏览器原生 PDF 预览和手动下载仍由用户确认，T004 保持未完成。构建复用被忽略的 `ui-fde-project/lib`，本轮 Client JS 与 source map 合计约 17.1 MB；停止预览后可按原构建流程清理并重建，不得连带清理 `.runtime/dsh-home` 用户数据。新增资源源码快照保留用于随平台交付。

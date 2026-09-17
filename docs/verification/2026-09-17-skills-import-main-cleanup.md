# 技能插件导入修复与主工作树收口

日期：2026-09-17。范围：修复第一阶段技能中心导致的项目插件导入失败，将现存 worktree 的应保留改动收回 `main`，删除重复 checkout；不改客户项目、模型配置或主运行数据。

## 故障与修复

用户截图显示 `@deepseek-ai/dsh-client-ui-fde-project` 在 Web 启动时导入失败。实际 3084 Bundle 包含 `fflate/esm/index.mjs` 和 `require("module")`；生产 `ClientModuleSystem` 在浏览器模块表中找不到该 Node 内置模块。原先的源码单测、构建和 HTTP 响应没有覆盖构建产物的浏览器导入，这是此前验证的缺口。

`skills-center-data.ts` 改为显式导入 `fflate/browser`。没有调整整个仓库的打包平台，也没有变更 ZIP 文件内容、技能目录、页面交互或运行数据。增加 `apps/web/tests/fde-project-import.expected.e2e.ts`，用真实平台静态模块与生产模块加载器导入完整构建包；该检查使用 jsdom，不启动浏览器、不截图、不调用模型。

## 验证结果

- `corepack pnpm install --offline --frozen-lockfile --ignore-scripts`：成功，复用本机依赖，没有下载新的运行时。
- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/skills-center-data.client.spec.ts`：4 项通过，七个 ZIP 的文件字节与阅读对象一致。
- `corepack pnpm run build`：成功，记录 280 个 Client 产物。新增测试的跨项目相对导入导致的类型检查错误已改为包入口导入。
- `corepack pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/fde-project-import.expected.e2e.ts`：1 项通过，构建包成功导入并产生预期插件样式，不请求 Node `module`。测试的文件定位已使用解析后的本地路径。
- `corepack pnpm exec tsc -b apps/web/tsconfig.json`：最终测试代码类型检查通过。
- README 英中配对定向检查：1 对通过。产品规格与本记录保持简体中文单一来源。
- 人工视觉验收仍待用户确认；本轮不把模块导入检查等同于完整 UI 或 1:1 像素验收。

## 主目录运行状态

当前唯一工作树：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench`，分支 `main`。启动目录为其 `upstream/deepseek-harness`，命令显式使用主目录运行数据：

```bash
DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

- 本轮监听 PID：`15949`。进程 cwd 与 `DSH_HOME` 都指向主工作树，而非已删除 worktree 或全局默认目录。
- 本地登录交换 303，带 Cookie 的首页 200；Boot revision 为 `15a3f9f7b3a1`，含 62 个 Client 条目。
- 实际项目 Bundle：`/plugins/??@deepseek-ai/dsh-client-ui-fde-project/client.js&rev=a8e9364aeb7a8cc4-37`。SHA-256：`326287ac8fd163fe76eedc4dd373bf892cfc476ab0164edab4a0fc758095cb88`。
- 在线可执行代码与通过导入测试的本地构建产物相同；Host 只在尾部增加分号并重写 `sourceMappingURL`。在线代码使用 `fflate/esm/browser.js`，不存在失败的 `require("module")`。
- 技能目录接口返回第一阶段七个方法。
- 主运行区仍登记原来的三个项目路径：`/Users/muyu/test/ai-analysis`、`/Users/muyu/llm-wiki/llm-wiki`、`/Users/muyu/FDE-Agent/fde-agent`。没有用旧 worktree 副本覆盖它们或主 Session 数据。

## 合并与清理

| 原 worktree | 删除前 HEAD | 收口结果 |
|---|---|---|
| `frontend-polish` | `75cc649771f76219705d73f2d585e9ba2b8a2699` | 原提交已在 main；工作树与对应本地分支已删除 |
| `harness-016` | `205dcd8c276a3f4c575c14cb3c3cb73423e93d4e` | 原提交已在 main；工作树与对应本地分支已删除 |
| `platform-navigation` | `5bf7af109d32278eec7bdc41b9eed90af9540f72` | 先保存技能中心未提交源码和设计文本，再连同既有导航提交快进合并到 main；工作树与对应本地分支已删除 |

每个工作树删除前均确认 Git 已跟踪和未跟踪状态干净，且 HEAD 是 `main` 的祖先。两个本地分支因远端跟踪分支较旧而被 `branch -d` 拒绝；再次确认全部提交已在 main 后，仅删除这两个本地引用，没有改动或删除远端分支。源码可从 main 历史恢复，依赖和构建产物可以重建。

主工作树原有的 README 部署链接通过临时 stash 保存、合并后原样恢复，stash 已移除；`DEPLOYMENT_AGENT.md` 和 `docs/verification/2026-09-16-source-build-fix.md` 保持原有未跟踪状态，不纳入本轮提交。

清理前三个工作树目录合计约 5.2 GB。删除重复目录后，文件系统可用空间从约 8.1 GiB 增至约 9.5 GiB，实测净增加约 1.4 GiB；目录统计包含共享/去重的依赖块，不能作为实际释放量。没有清理全局 pnpm 缓存或其他项目。

## 保留内容与生命周期

- 原三个 `.runtime/` 曾以同文件系统移动方式集中至主目录 `.runtime/retired-worktrees/`，合计约 330 MB，没有制造第二份副本。用户随后明确要求不保留这些旧副本；核对当前服务使用主目录 `dsh-home` 且旧目录没有进程占用后，已永久删除该目录及内容。旧副本未纳入 Git，不能从 Git 恢复；当前主运行数据和设计稿未删除，3080 进程保持运行。
- 第二、三轮 UI 抽图的 `attempts/`、`candidates/` 移回主目录 `source-materials/ui-exploration/`，保留原件且继续忽略，不把生成大图提交到 Git；约 7.2 MB，后续设计不再需要时可清理未采用候选。
- 两个 worktree 中的实验室 `.assets/` 各 248 个文件与主目录逐文件 SHA-256 相同，删除的是重复副本；主目录素材保留。
- 构建与启动日志分别为 `.runtime/main-skills-fix-build.log`、`.runtime/main-skills-fix-web.log`，用于本轮验证，停服且不再需要排查后可清理。启动日志可能包含本地鉴权链接，不提交或分享。
- 项目 `AGENTS.md` 已取消强制每个 Feature 新建 worktree 的旧规则；默认直接在主分支，只有用户明确要求才创建。

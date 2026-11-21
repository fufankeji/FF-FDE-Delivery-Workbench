# F034 · 页面操作与 Harness rc.5 验证

## 范围与结论

2026-11-21，按用户授权先写 F034 规格，再修复项目详情裁切/入口、阶段输入框遮挡，并整合官方 `dsh-v0.2.2-rc.5`（`9c2670d3bce5275e0d1610272958121af87787bb`）。旧本地检查点为 `2e9abf4b547ac735a7ab286b12d4db2ddd567b01`。没有创建 worktree、写入真实项目运行区、读取凭据库、调用付费模型或重打桌面 ZIP。

实现及代码/加载检查已完成；实际窗口与多行输入的视觉体验仍待用户人工确认，没有自动打开浏览器或用静态测试冒充视觉验收。

## 验证证据

命令在 `upstream/deepseek-harness` 执行，除非另有说明。原始日志仅保留在根 `.runtime/harness-0225-upgrade/`，不进入 Git。

| 检查 | 实际结果 |
|---|---|
| PRD、Product Spec、F034 规格链校验 | 通过；修复在现有需求/产品合同内，未扩展生命周期语义 |
| `pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts` | 通过；本机 SheetJS CDN 慢，临时使用仅匹配该 URL 的 pnpm 官方 resolver/fetcher 扩展，将已下载的原始归档送入正常缓存。SHA-512 与已提交锁文件完全相同，远端 URL/版本/校验值没有替换 |
| `node <pnpm@11.28.5>/bin/pnpm.mjs install --frozen-lockfile` | 退出 0，10.3 秒；不携带临时扩展，证明提交的锁文件可按标准安装路径使用。没有跳过安装脚本或供应链校验 |
| 详情、上传、装配、Sidebar 面板、Workspace Factory 定向 Vitest | 最初发现权限变量、测试 fixture 和上游文案预期交叠，修复后对应文件通过；重试日志为 48 成功、1 个快照断言失败，该剩余断言随后单独修正并通过全部 6 项 Sidebar 快照测试。没有恢复 FDE 有意移除的全局 New Session 按钮 |
| `node node_modules/typescript/bin/tsc -b packages/client/ui-fde-project/tsconfig.json packages/client/ui-fde-sources/tsconfig.json --pretty false` | 退出 0 |
| `node node_modules/vitest/vitest.mjs run packages/experimental/deepseek-chat-import/tests/upload.host.spec.ts packages/web/web-search-deepseek/tests/settings.spec.ts packages/web/web-search-deepseek/tests/deepseek.spec.ts packages/client/ui-fde-project/tests/project-layout-regression.client.spec.ts` | 4 文件、104 项通过；不调用真实模型 API |
| `corepack pnpm run build` | 退出 0；11 个 gate 全通过、0 跳过，371.89 秒。包含 Host/Client 编译及聚合类型检查、桌面/浏览器 bundle、原生模块和 FDE 固定插件适配；生成 424 个 client artifact |
| `verify-translation-pairing.ts` 指定 ui-fde-project、ui-fde-sources、ui-sidebar、ui-workspace README | 4 组中英合同一致；新产品规格只写中文 |
| 独立运行加载 | `DSH_HOME=<根>/.runtime/harness-0225-upgrade/runtime-sample/dsh-home node --import tsx/esm apps/cli/src/bin.ts web --no-open --host 127.0.0.1 --port 3084`，监听进程 cwd/DSH_HOME 已核对 |
| 在线 Boot Manifest 和静态资源 | 发布号 rc.5；匿名首页 401、授权首页 200；实际在线 FDE bundle 包含上传 Factory、阶段入口、容器重排和 `40dvh` 输入限制。File Review、Better Sidebar、上下文洞察资源均返回 200 |
| 公开样例与数据隔离 | 用 `source-materials/fde-agent/load.mjs` 创建一次性样例；1 个 Workspace、192 文件、35 份来源，路径全部落在本轮隔离区，没有复制会话或凭证 |
| 原入口加载 | 中文挑战、实验室案例、Skills、项目 snapshot 四条路由匿名 403、owner 200；不等于全功能点击或全历史数据迁移验收 |

## 文档总检查边界

运行了 `corepack pnpm run doc-sync`，**未通过**。它报告既有 FDE 元数据服务 JSDoc/投影目录未登记、历史笔记双语 sidecar 格式、目录链接、文档预算和文档标准等存量问题；本轮冲突合并留下的 ui-workspace 段落空行已修正，受影响四组文档的定向配对检查通过。CLI help 子检查在同机并发下被超时终止；最后剩余 package README model experience 长扫描由本轮主动停止，聚合退出 130。没有降低门禁、删除历史文档或把总检查报告为绿色。

构建及本轮行为证据与这些存量文档整治分开记录，不为此次三项修复扩大到全库文档治理。Windows/macOS 安装器矩阵、真实模型 API、所有历史会话迁移及用户截图尺寸下的人工体验均未验证。

定向 staged 配置 lint 也报告已有 FDE 大文件的行宽、缩进及旧非空断言，未宣称整个文件 lint 通过。把诊断逐项映射到本轮新增行后，仅有两个测试箭头括号和一处 fixture 行宽，已修正；未格式化无关旧代码。发布安全扫描没有秘密或超限文件问题；它的 docs 排除规则与用户/项目要求冲突，因此明确保留 docs，而非修改扫描器或删除文档。根许可证未选择，未擅自新增。

## 发布与本地状态

目标仅为 `origin/main`：`https://github.com/fufankeji/FF-FDE-Delivery-Workbench`。推送前 fetch 后 ahead/behind 为 0/0；不使用 force、不修改保护设置。保留仓库原有受控 `docs/`，遵循用户“docs 也提交”及项目合同，不套用通用发布模板删除它们。

源码提交 `0e849a8600b31a448c80add7954dfaadf8b1e9f4` 已普通推送至 origin/main，`git ls-remote origin refs/heads/main` 返回同一 SHA。GitHub 对当前账户的普通推送提示 `Bypassed rule violations / Cannot update this protected ref` 后接受更新；未添加绕过参数、强推或修改仓库保护规则。该 SHA 的 Actions 查询返回 0 个运行，不声称远端 CI 通过。此记录随后以独立文档提交同步。

已有未跟踪 `.agents/`、`lefthook.yml`、`docs/verification/2026-10-30-student-source-package.md` 未纳入提交。发布安全扫描没有未解冲突、秘密或超限文件 blocker；剩余 docs 排除提示按前述明确项目合同处理。

依赖仍复用原 `upstream/deepseek-harness/node_modules`（约 2.9 GiB，可重新安装）；本轮 `.runtime/harness-0225-upgrade` 总计约 6.6 MiB，其中一次性公开样例运行区约 2.4 MiB。样例服务保留在 127.0.0.1:3084，启动授权链接仅保存在本机 `web.log`，未提交。该目录仅用于本轮验收，停止 3084 实例后可清理；用户一旦在其中新增资料，应先另行保存。原 `.runtime/harness-022-validation` 和桌面旧源码包未改动。

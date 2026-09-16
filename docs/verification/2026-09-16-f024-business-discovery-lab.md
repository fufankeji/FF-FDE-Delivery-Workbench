# F024 独立业务挖掘实验室验证记录

日期：2026-09-16。状态：实现与无密钥验证完成，待人工确认。所有命令在 `upstream/deepseek-harness/` 执行，除另有说明外退出码为 0。

## 授权与范围

用户确认独立模块、保留完整体验、不影响原阶段链路，并授权先提交已有改动、继续在当前分支开发。已有改动已提交为 `12cb80f0bc`（`chore(fde): checkpoint usage analysis and LAN access changes`）；该提交未推送。提交时钩子提示找不到 lefthook，不能将其视为钩子验证通过。本 Feature 新改动留在 `main` 工作区，不另建 worktree。

PRD、Product Spec 和 Feature 三件套分别通过对应 Skill 校验器。保持原有项目中心、阶段、会话、资料、主题和局域网组合，仅追加两个插件及独立 API。固定宿主版本不变。

## 素材与源码

`python3 packages/fde/discovery-lab/scripts/import-assets.py <用户提供的完整交付 ZIP>` 成功。固定运行包 SHA-256 为 `2c68c7b2ef51f6e92c1cb00e796dbbdb249362eb249821152a9f26128e057678`；五案例、234 份授权原件校验匹配，共 248 文件、36,654,779 字节。没有导入源码归档中的教师/未来事件材料、作者会话或凭据。

原业务/UI 共 23 文件导入前适配摘要及来源见[来源记录](../../upstream/deepseek-harness/packages/fde/discovery-lab/SOURCE.md)。JavaScript 原模块保持原语言，在新 Host 的 allowJs 边界内编译；新增 Host/Client 外壳使用现有严格 TypeScript 合同。

## 最窄验证

| 项目 | 实际检查 | 结果及边界 |
|---|---|---|
| 原业务规则 | `node --test packages/fde/discovery-lab/tests/*.test.mjs`（当时为原 domain、finance_versioning、five_cases 三文件） | 46 项通过；包含权限、证据、报告引用与数字、重开、升级、并发与恢复 |
| 当前原生适配 | `corepack pnpm exec vitest run packages/fde/discovery-lab/tests/loader-composition.spec.ts` | 1 项真实 Loader 组合通过；只有 LLM 被脚本化，Agent Loop、Session、JSONL、Tools、HTTP 均真实 |
| 适配后相关回归 | `node --test --test-name-pattern='Native|Resuming|Restart|Repeated|Concurrent|Late|Evaluation|Recovery' packages/fde/discovery-lab/tests/domain.test.mjs` | 12 项通过；只复跑受原生会话/退出适配影响的项目 |
| 原件计算与导出 | `node --test packages/fde/discovery-lab/tests/calculations-and-export.test.mjs` | 1 项通过，包含五案例共 18 个 Python 计算、缺资料拒绝、MD 原文及 PDF 字节导出；资料授权由明确的离线夹具写入，不声称真人完成训练 |
| 入口和返回 | `corepack pnpm exec vitest run packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx`（与组合测试同次初始运行） | 2 项通过；入口/返回不读取或写入项目与会话选择，原 Slot occupant 保留，卸载仅移除本插件入口 |
| 目标编译 | `corepack pnpm exec tsc -b packages/fde/discovery-lab packages/client/ui-fde-discovery-lab` | 通过；最后 Client 样式调整后再次编译其目标 |
| 目标构建 | `corepack pnpm --filter @deepseek-ai/dsh-fde-discovery-lab bundle`、`corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-discovery-lab bundle` | 通过；原 React/Pixi 应用随 Client 包构建，不依赖原交付已编译包 |
| 工作区卫生 | `git diff --check`、忽略目录检查 | 受控差异无空白错误；素材、SQLite、构建和依赖未列入受控源码 |

组合验证发现并处理了两个真实版本差异：`sessionPersistence.flush()` 改为 `sessions.flush(session)`；当前 JSONL 不会为只点选、从未提问的岗位写入空记录，因此用精确记录存在性决定新建/恢复。还验证岗位试图调用全局工具不执行、不能发放其他岗位原件、工作区合成提示不进入访谈，而普通 Agent 仍保留其全局工具和提示。

未启动 Playwright、系统 Chrome、自动截图或录屏。未读取凭据保险库，未调用真实模型，未改变普通项目的模型配置。

## 在线运行与旧链路

使用 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080` 启动。最后 Client bundle 完成后重启当前任务自己的 Host。监听 PID `51848`，cwd 为本仓库 `upstream/deepseek-harness/`，进程显式携带上述 `DSH_HOME`。未停止既有 `frontend-polish` worktree 的 3081 服务。

- 工作台 <http://127.0.0.1:3080> 返回 200。
- Boot Manifest 含实验室以及原项目、阶段、资料、外观四个 Client 包；实际实验室 URL 为 `/plugins/@deepseek-ai/dsh-client-ui-fde-discovery-lab/client.js?rev=4aea1c1dd576`。
- 线上 Bundle 与本地构建字节一致，SHA-256 为 `0518fc146013a71ed30383c654817cbff2aa1e65cd2e3b650cbb21c5817aa06a`，包含新入口与返回行为。
- 实验室 HTML、JS、CSS 均为 200；JS 为 892047 字节，CSS 为 47405 字节，API 前缀指向独立命名空间。
- `GET /api/fde-discovery-lab/cases` 返回五案例：财务 1.1.0，其余四例 1.0.0；没有为真实运行区创建训练轮次或发送消息。
- 旧项目资料列表按既有 `POST /api/fde-project-resources/list` 合同返回 200。最初将该只读接口误作 GET，得到预期的 405；改正检查方法后通过，未修改旧接口。
- 启动前后 `storages/workspace.json` 与现有 8 份 `.fde/stages/*.json` 摘要一致；3 个已登记项目及其会话映射不变。

HTTP 和在线 Bundle 检查证明服务与当前构建可访问，不代表浏览器渲染或用户体验已验收。

## 本地产物与清理

| 路径（相对仓库根） | 用途与本次大小 | 保留/安全清理条件 |
|---|---|---|
| `upstream/deepseek-harness/packages/fde/discovery-lab/.assets/` | 授权素材、Python 与字体，约 36 MB | 可从精确原 ZIP 重建；删除会令实验室不可用，不影响项目数据 |
| 两个新包的 `lib/` | Host 约 508 KB；Client 约 1.1 MB | 可由目标编译与 bundle 重建；运行服务依赖它们 |
| `.runtime/dsh-home/fde-discovery-lab/` | SQLite、WAL 和工作目录，初始约 780 KB | 是训练事实源，不作为缓存删除；需要保留训练时同时保留宿主原生 Session 日志 |
| 原有 `node_modules/` | 新增 55 个依赖包及 workspace 链接，沿用既有依赖树 | 依赖可按锁文件重装；没有创建重复 checkout、独立运行库或额外持久浏览器目录 |

完整交付 ZIP 仍在用户原位置，没有复制到 Git，也未发布或上传。

## 待人工确认

1. 从首页右上角或项目中心顶部“业务挖掘实验室”进入，五案例大厅、背景、像素办公室和资料预览呈现符合原交付体验；项目工作面保留侧栏入口。
2. 使用已配置 Provider 手动进行真实岗位访谈、提示、取证和核对，确认回答质量与等待/失败反馈。
3. 在真实必需项完成后生成报告并检查内容、MD/PDF 排版；离线导出检查不等同于该模型旅程完成。
4. 返回工作台继续原项目；确认原项目中心和八阶段操作符合预期。

训练共享每案例一个当前轮次；未增加账号隔离、报告回流或自动项目/阶段联动。人工确认前 Feature Map 保留 `in-progress`。

## 人工反馈修正：全屏页入口不可达

用户截图证明项目中心全屏页遮住侧栏，初次只在 `sidebar.footer.action` 注册入口并不能满足独立可达要求。初次两个导航测试没有覆盖真实全屏页面，此限制已由人工反馈暴露，不能以先前测试通过视为入口体验验收。

补充由 `ui-fde-project` 声明的 root 列表槽 `fde.workbench.module.action`，在首页导航与项目中心顶部渲染；实验室注册同名可见按钮，和旧侧栏入口、训练页面共享自身 Store，不传递项目状态。首页既有“进入工作台”、项目中心新建/查看/返回路径均保留，不改变初始页面策略。

修正后的检查：

- `corepack pnpm exec vitest run packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx packages/client/ui-fde-project/tests/apply.client.spec.ts packages/client/ui-fde-project/tests/project-center-navigation.client.spec.tsx`：3 文件、9 项通过。新增测试将真实全屏首页/项目中心组件与实验室入口、页面组合，验证零项目下打开/返回及旧项目入口保留；注册测试覆盖延迟声明槽位、卸载和三个入口共享 Store。补强 Store 身份断言后只重跑实验室 3 项，全部通过。
- `corepack pnpm exec tsc -b packages/client/ui-fde-project packages/client/ui-fde-discovery-lab`：首次提示 `renderSlot` 需要 owner 参数，补 `{}` 后通过。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project --filter @deepseek-ai/dsh-client-ui-fde-discovery-lab bundle`：两个包通过。新增的仅一个 workspace 类型依赖，离线安装没有下载或升级外部包。
- 两包 README 与本 Feature Agent Note 的 3 个既有双语契约通过指定文档配对检查；`git diff --check` 通过。
- 目标包构建后重启当前任务的 3080 服务，当前 PID `55074`，cwd 为本仓库 `upstream/deepseek-harness`，`DSH_HOME=../../.runtime/dsh-home`。首页 200，Boot revision `6b7e628653d1`。
- 从 Boot 获取项目包 `client.js?rev=ef9e2204a82c` 和实验室包 `client.js?rev=6c86b73ebd81`，线上字节均与本地构建完全相等，均含新增模块槽。项目包 SHA-256 `dd48d119ab350504fe8e87fb8e9ec70478fb3b4f80eaac5bfaebbe792d24d83b`，实验室包 SHA-256 `40d9da5c63a16ddf2332574a7504419d2576bf0d780fa7bc0e310b0a8d13feaa`。
- 重启前后 Workspace 登记文件 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，未改变已登记项目或会话映射。

本轮仍未运行浏览器自动化或调用模型；可见布局和真实访谈继续由用户手动确认。沿用原构建目录，无新增持久运行目录、素材副本或备份；没有提交或推送修正。

## 人工反馈修正：页头透出下层按钮

用户第二张截图显示“返回工作台”与下层首页按钮重叠。源码确认外观插件 `themeTokens()` 将 `--dsw-alias-bg-base` 覆盖为半透明 RGBA，实验室全页和页头直接使用该色，导致下层页面透出；不是入口顺序或需要调高 z-index。

仅将实验室 `.page` 背景改为从原主题色提取 RGB、强制 alpha 为 1 的不透明色，并提供 `Canvas` 回退。主题配色保留，透明页头现在叠加在自身不透明底面上。原首页、项目中心、导航与训练状态未修改。

- `corepack pnpm exec vitest run packages/client/ui-fde-discovery-lab/tests/page-surface.spec.ts`：1 项样式合同回归通过，断言不透明底色及回退；不声称像素或浏览器渲染已验证。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-discovery-lab bundle`：通过。
- 重启后 PID `56309`、显式隔离 `DSH_HOME` 和 cwd 正确；首页 200，Boot revision `3f08664e56a6`，实验室包 URL revision `2d91789a05fc`，线上字节与本地一致且含不透明背景，SHA-256 `1c021401c0ea8991d1678042a5929d68c7912c367f282bc736d4ca898d54f0bd`。
- Workspace 登记文件摘要仍为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`。本轮不调用模型、不运行浏览器自动化，刷新后的实际观感交用户确认。

## 私有仓库提交授权与预检

用户确认当前结果后要求提交 GitHub，并明确要求先把仓库改为私有。已对精确目标 `fufankeji/FF-FDE-Delivery-Workbench` 执行可见性变更，GitHub API 确认为 `PRIVATE`、默认分支 `main`；未操作官方 `upstream` 仓库。

`git fetch origin` 后本地仅领先已有检查点 `12cb80f0bc` 一个提交，远端没有新增或分叉。`change-scope --base origin/main` 已覆盖该检查点及本次集成；复用前述真实测试、目标构建与在线证据，不为提交重复运行通过的检查。

发布预检扫描 8749 个候选文件，没有凭证、敏感文件名或超限大文件告警。脚本总状态为 `NOT READY`，仅有 3 个根 `docs/` 排除策略项（未忽略、已跟踪、README 引用）；这些不适用于本项目明确的文档与源码同仓管理合同，保留现有文档与链接，不删除或取消跟踪。完整交付包、`.assets/`、构建产物、依赖和运行数据继续被忽略。

# F029 中文场景挑战接入验证

日期：2026-11-02。目标仓库：`FDEDeliveryWorkbench` 当前主工作树。用户授权：先按项目规范完成 Spec，再接入实验室，题目与业务规则使用中文。没有提交或推送 GitHub。

## 文档先行

实现前已增量更新 PRD 的 REQ-038～REQ-040、AC-035～AC-038，总 Spec 的 PSC-032、Feature Map 的 F029，并创建 [Spec](../specs/F029-chinese-scenario-challenge/spec.md)、[Plan](../specs/F029-chinese-scenario-challenge/plan.md)、[Tasks](../specs/F029-chinese-scenario-challenge/tasks.md)。三个 Skill 校验器均退出 0。PRD/总 Spec 的数量提醒属于既有大型合同的结构提示，没有缺失追踪项。

## 已实现范围

- 实验室并列原业务挖掘和中文场景挑战；原 iframe 首次显式进入后保活，跨模块保留未发送输入。
- 十道平台自编中文情境题，五方向各两题；所有选项均有中文解释，交卷前不向 Client 返回答案键。
- 服务端 300 秒绝对截止时间，保存、恢复和提交共用截止判定；重复开始/交卷、旧页面修订冲突、实际文件失败和损坏恢复均有明确行为。
- 每轮保留题目快照，展示答对、答错、未答、用时、方向答对数和练习建议；本机运行区共享一个进行中轮次和最近 20 次结果。
- 无模型、外部题库或账号依赖；不使用第三方原题和代码，不新增职业认证、排行、项目阶段写入或访谈自动执行。

## 定向测试

在 `upstream/deepseek-harness/` 执行 `corepack pnpm exec vitest run <下列直接相关测试>`。共 29 项独立用例通过；失败后只重跑受修正输入影响的文件，没有执行全仓浏览器或模型回放。

| 测试文件 | 通过数 | 可观察证据 |
|---|---:|---|
| `packages/fde/scenario-challenge/tests/store.spec.ts` | 9 | 中文与五方向覆盖、快照评分、刷新/重启恢复、精确截止、错题与未答区分、并发旧修订拒绝、最近 20 轮、损坏原件保留、写失败不提交 |
| `packages/fde/scenario-challenge/tests/loader-composition.spec.ts` | 1 | 真实 Loader/Connection/WebServer 组合、未授权与跨站拒绝、实际 HTTP 开始/选答/交卷、无模型与业务素材、插件卸载移除路由；仅凭据持久化使用隔离内存替身 |
| `packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx` | 5 | 双模块入口、原 iframe/草稿保留、返回、显式失败重试、统计与案例读取错误 |
| `packages/client/ui-fde-scenario-challenge/tests/challenge.client.spec.tsx` | 5 | 中文规则、继续答题、交卷确认、统一解析、写失败反馈、到时禁答、历史只读 |
| `packages/client/ui-fde-scenario-challenge/tests/resource.client.spec.ts` | 3 | 资源读取/刷新/取消、畸形响应不能冒充空成功、失败写入无隐式重试；首次执行时文件名为 `resource.spec.ts`，之后仅按编译面规则更名 |
| `packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx` | 5 | 入口更名后的平台导航、保活槽和总览行为 |
| `packages/client/ui-fde-discovery-lab/tests/page-surface.spec.ts` | 1 | 实验室页面不透明底板保留 |

测试临时目录由各用例的清理流程移除；没有对真实运行区创建答题或训练记录。

## 构建与中文文案

- `corepack pnpm gen-tsconfig-paths`：通过；两个新包使用手写的领域名称别名，与既有 FDE 包相同，生成区域未被手工修改。
- `corepack pnpm exec tsc -b packages/fde/scenario-challenge packages/client/ui-fde-scenario-challenge`：通过。
- 对 `dsh-fde-scenario-challenge`、`dsh-client-ui-fde-scenario-challenge`、`dsh-client-ui-fde-discovery-lab`、`dsh-client-ui-fde-project` 分别执行 `corepack pnpm --filter <包名> run bundle`：四项通过。
- `corepack pnpm run build:check`：Host 与 Client 两项聚合类型检查通过，最终退出 0。首次检查定位并修正了本次资源测试的编译面文件命名与一个测试返回值类型。
- 使用仓库 `findUiI18nViolations` 检查新挑战的五个 Client 源文件和 `LabPage.tsx`：6 文件、0 违规。
- 包 README 按仓库契约同步中英并使用既有 `verify-translation-pairing.ts --write` 重录四个对应包；产品 PRD/Spec/Plan/Tasks 仅维护中文。
- `git diff --check`：通过。

## 在线与桌面交付

正常退出原桌面端后，通过 `corepack pnpm start:desktop` 启动当前已构建源码，显式保持：

- `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/harness-021-validation/dsh-home`
- `DSH_DESKTOP_USER_DATA_DIR=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/harness-021-validation/desktop-user-data`
- `DSH_DESKTOP_OPEN_DEVTOOLS=0`

运行日志在 `.runtime/harness-021-upgrade/f029-desktop-20261102.log`，其中本机启动授权入口不复制到文档。组件下载复用已准备的缓存和系统代理，没有新工作树或重复仓库。

一次在线检查结果：桌面 Host 授权首页 HTTP 200；启动清单包含新挑战和原实验室 Client；读取清单里的实际插件 Bundle URL 返回 200，包含“FDE 场景判断”“开始 5 分钟挑战”“返回实验室”“个训练模块”；挑战 GET 接口 HTTP 200、无进行中轮次、历史 0 条。启动日志没有插件失败记录。正常跳过可选账号配置并将桌面端置前，没有填写或读取模型密钥。

新增构建文件约 472 KiB，分别位于新 Host 包与 Client 包的 `lib/`，均被 Git 忽略；关闭应用后可删除并由目标构建重建。答题运行数据位于 `DSH_HOME/fde-scenario-challenge/`，不是构建缓存，用户开始答题后不可随清理构建一并删除。

## 未通过的全仓检查与非阻塞事项

- 全仓 `verify-client-ui-i18n.ts` 报告 2750 条既有硬编码文案，主要位于未改动的 FDE 阶段、工程辅助页面等；没有扩展为全仓文案重构，本次新增界面及改变的实验室组件检查通过。
- 初次离线安装因已有 Eval 插件归档不在下载缓存而失败；后续正常 pnpm 工作区准备完成，新依赖复用已有安装内容，锁文件只增加本次两个包及其引用。没有升级依赖版本。
- 对四包同时运行 bundle 的任务排序触发现有工作区循环，改为逐包调用后全部通过；未修改依赖调度策略或绕过编译。
- 构建仍提示既有 tsconfig 的重复 FDE 路径键；本轮新增的四个路径键没有重复，不清理无关配置。

## 待用户人工确认

入口：桌面左侧“实验室” → “FDE 场景判断 · 5 分钟挑战”。请确认题目难度、中文语义、选项是否存在歧义、明暗主题可读性及桌面交互。没有进行自动浏览器截图、完整录屏、全量 Web E2E 或真实模型验收；F029 保持 `in-progress`，T007 待人工确认，不把构建或 HTTP 可用等同于体验通过。

## 人工反馈修复：桌面无法读取挑战

用户截图报告“暂时无法读取挑战”。在实际 Electron 渲染器中复现：直接 `fetch('/api/fde-scenario-challenge')` 返回 200、revision 0、无进行中轮次和历史；将同一原生函数作为对象成员调用则抛出 `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`。原 `ChallengeClient` 用 `this.request(...)` 调用存储的原生函数，接收者变成客户端实例；已有 Node 请求替身未限制接收者，初次 Host/Bundle 检查没有覆盖这一浏览器行为。

修复仅在同一调用处先取出请求函数，再作普通函数调用；读取和写入共同修复，不改变地址、认证、记录或计时。增加原生接收者约束回归：修复前稳定失败，修复后 GET/POST 均通过。该资源测试文件 4 项全部通过，目标 TypeScript 编译与 Client Bundle 构建通过。

重新加载当前桌面页面后，沿实际“返回项目中心 → 实验室 → 进入场景挑战”进入；页面自身发出的挑战请求返回 200，真实 DOM 显示可点击的“开始 5 分钟挑战”、无可见错误提示及“还没有已完成的挑战”。没有用注入数据替代接口，没有开始挑战、访谈或模型请求，也没有清除任何记录。此处是针对用户报错的定向桌面验证，不代替整套人工体验。窗口保留在正常的挑战介绍页。

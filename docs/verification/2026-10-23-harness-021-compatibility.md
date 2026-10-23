# 2026-10-23 · Harness 0.2.1-rc.2 兼容验证

状态：人工反馈的 Review 启动阻塞已修复，Chrome 155 实际启动通过；其他产品体验继续等待用户确认。此前在线 HTTP 和资源检查通过，不等于浏览器插件已激活。预览地址为 `http://127.0.0.1:3082`，首次使用本地启动日志中的授权链接；不在报告中记录令牌。没有切换原运行区、提交或推送，没有调用真实模型。

## 人工反馈后的启动修复

- 用户截图显示 `dsh-file-review-tab: failed`；Chrome 155.0.8059.85 复现同样页面。补上生产槽位声明后，定向测试明确报 `list slot "conversation.chat.turnTail" requires options.id`。
- 原测试只验证模块、协议和未声明槽位时的注册，`slots.inject` 回调没有执行，因此不足以证明 Client 能完成启动。这一遗漏现已修正，不再以 HTTP 200 或 Bundle 存在代替激活验证。
- 固定插件补丁增加 list 的唯一 id/order，通过模块级组件筛选当前 Turn 并显式传递 matched；空结果不显示卡片。并按 Session v4 的 message.isError 排除失败工具，避免生成错误审查项。没有禁用插件或回退官方槽位。
- `review-list-regression.log`：两种加载顺序均通过；实际渲染空、成功和失败结果，核对审查按钮、精确 Session 的 status RPC 以及卸载清理。
- `install-review-list.log`：锁文件与补丁安装成功。`review-list-build.log`：10 个构建/聚合检查全部通过，24.23 秒。
- `chrome-boot-review-fix.json`：使用系统安装的 Chrome 155，以临时隔离浏览器上下文执行单次启动检查；出现“进入平台”，没有 Failed to load plugins，捕获的启动错误为 0。浏览器上下文已关闭，无持久自动化 profile。随后用授权链接在用户 Chrome 中重新打开入口；未点击业务执行动作或调用模型。
- 本节取代此前 Review Client 单项注册测试及旧 Review Bundle 摘要作为“启动成功”的证据；其余未变化的历史、授权和资料检查沿用，不重复。

## 版本与恢复来源

- 唯一源码：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench` 的 main 工作树；HEAD 仍为 `1c4767f8f4c3af6beb251ac51a36a9f49bf9d6fd`，主 Git index 未暂存本轮变更。
- 官方基线从 `0a15e36e7f82b6ed45af6fa9759f29b40dcd965d` / `dsh-v0.1.6-alpha.1` 更新到 `687f282e8625c6b8d11ff58211a90524be2e4317` / `dsh-v0.2.1-rc.2`；版本锁、README、AGENTS 和部署说明已同步。工具链为 Node 24.16.0、pnpm 11.28.5。
- 升级前源码树 `4c607ba0700af259d77eb4cb14f5d86f84bb02e5` 包含原有未提交 Skills、部署与录制改动；独立 index 不影响主 index。旧映射树 `fc376b6a441556f96ee41ad544f5969482cfa1be`、新映射树 `5c7b992b8d3fe002b71b43acea413aa0ef92f46f`、初始合并树 `289239947c2787454c42e29856f9b9c62ffe2d2d`。
- merge-tree 初始 93 个冲突已处理；采用精确三方合并，没有覆盖下游或修改官方 Agent Loop。旧主题 Host 测试由新配置测试承接；移除了上游已退役且无运行引用的桌面 patch，以及已被正式配置和 FDE 预览替代的 Sidebar 0.19.1 补丁。它们均可从升级前树恢复。
- 桌面原源码快照 `FDEDeliveryWorkbench-源码快照-20261023-112326.zip` 保留，37,993,465 字节，SHA-256 `2cd7855bd793a2d59509dab751970bc7d606b36ec72274eb5a2b8cb4c88df175`；不含运行数据与凭据。

## 先文档、后实现

1. 用户确认具体 LAN IP＋浏览器授权后，先记录 REQ-035、AC-032、PSC-029，再移除免授权入口。
2. 用户确认“只读运行输出＋独立手动终端”后，先记录 REQ-036、AC-033、PSC-030 和 AC-F027-007，再实现。其余阶段、人工门和 V1/V2 区分不变。
3. PRD 校验为 36 REQ、14 NFR、33 AC；总规格 30 PSC；F027 ready 校验通过。Tasks 仅勾选已有证据的 T001–T007；T008 留待用户确认。
4. Harness 的受影响包说明、CLI 和终端升级指南已同步；两种语言配对通过。旧免授权 LAN 决策三件套按归档规范保留并封存，新决策解释授权、终端分工和 Review 兼容策略。没有扩大成全仓文档审计。

## 关键适配

- 退役 11 个 FDE 包空的 invariant companion，保留真实领域校验；适配新版叶子 tsconfig、Client bundle 和依赖声明，保留本地 OpenAPI 包、PPTX Worker 与固定 Eval。
- FDE HTTP 复用 Connection admission，只接受 owner；`--lan` 在监听前给出迁移错误，`--host` 指定具体地址并要求浏览器授权。
- WorkspaceBrowser 保留 FDE 项目创建、企业/周期、排序和阶段侧栏，适配主视图引用、Session 状态与正式 Slot。项目跳转使用 `uiWorkspace.openSession`，文件流增加路径参数；原视图选择、Hero、Markdown 文件链接与设置入口保留。
- “运行输出”只读项目运行记录绑定的 Session 与精确同名 Agent PTY，有界读取，隐藏后释放请求；缺失不创建替代终端。手动终端复用官方用户终端，提示共享文件、端口和重新核验责任。启动使用 `terminal_open` 等官方工具，停止临时持有原 Session 引用，不因切换会话失去控制路径。
- Better Sidebar 0.28.0 移除了旧 Web browser，FDE 专用预览只接受平台签发的 nonce `.localhost` 地址。Observe 0.2.25、会话遥测和产品分析保持禁用。
- File Review 0.5.0 实测旧严格 codec 缺少 `create()`，Host/Client 均已通过固定补丁适配，包兼容声明只指向已验证的 0.2.1-rc.2。不使用版本豁免或关闭全局检查。三个第三方插件的 DSH peers 全部解析到当前 workspace，避免重复运行时身份。
- Session v4 工具结果不再嵌套于 `tool-result` block。实验室资料授权与固定 Eval collector 已适配一级工具消息，保留旧代 Eval 读取；原生训练角色隔离和恢复保持。

## 构建、定向检查与文档证据

以下日志均在根 `.runtime/harness-021-upgrade/`。失败记录保留；失败后的修正结果单独标明，不把初次失败记作通过。

| 检查 | 结果 | 证据 |
|---|---|---|
| 冻结安装与包补丁 | 退出 0 | `install.log`、`install-shared-peers.log`、`install-review-patch.log`；Eval Git/codeload 固定同一 SHA，精确 allowBuilds |
| 最新制品构建 | 8 个制品门通过 | `build-final.log`；该次 Host 聚合仅因新测试 Loader fixture 类型失败，随后修复；生产制品均通过 |
| 修复后的聚合检查 | Host、Client 均通过，退出 0，10.29 秒 | `build-check-final.log`，在最新制品之后运行 |
| 授权、CLI、七项平台 Skills | 直接用例通过 | `focused-auth.log`、`focused-adapters.log`；旧 fixture teardown 修正后通过 |
| 文件刷新、预览地址与代理 | 通过 | `focused-adapters.log`；认证与 project-origin 边界分层验证 |
| 项目浏览器、树数据、项目用量及主题 | 通过 | `focused-workspace.log`、`focused-label.log`，以及此前对应定向批次；不重复等价检查 |
| Skills 中心与项目中心导航 | 3 文件、18 用例通过 | `focused-project.log`；同批旧 apply fixture 另行修正 |
| 运行输出、页头与注册 | 首批 4 文件、12 用例通过 | `runtime-output-tests.log` |
| 最新阶段与运行动作组合 | 2 文件、55 用例通过 | `runtime-final-tests.log`；覆盖跨会话停止的引用释放、新工具名、查看输出/手动终端不排队模型指令 |
| Review Host 与归档规则 | 2 文件、18 用例通过 | `final-host-tests.log`；真实 Loader 挂载，diff 状态、撤销、重做、目录限制 |
| Review Client | 1 文件通过 | `file-review-client-final.log`；实际分发 factory、当前 Conversation/Slots/Remote 与严格 codec 注册和卸载 |
| 升级指南 | 通过 | `upgrade-guides.log` |
| 包说明与新决策配对 | 14 个命名 pair 通过 | 命名 `verify-translation-pairing` 命令；工具/配置目录与项目说明另有 3 对检查通过 |
| 生成目录 | 完成 | `catalogs.log`：config、client slots、tool catalog；补齐 FDE 声明注释及中文工具条目，不改生成英文内容 |
| 冻结归档 | 3 个新文件封存，2775 个文件检查通过 | `doc-pairs.log`；嵌入式 checkout 的 Git 基线读取改用相对路径，原封印未变 |

不宣称全套测试、全仓 lint/doc-sync、全量浏览器回放、真实模型质量或视觉验收通过；本轮只使用范围相关的构建和行为检查。

## 真实数据隔离与迁移

- 原数据事实源仍为 `.runtime/dsh-home` 与 `/Users/muyu/FDE-Agent/fde-agent`。验证区只登记“连锁门店设备故障智能分诊项目”，Workspace ID `c4247945-6e07-498b-8bf4-f95bee3a7133`，未混入另外两个原项目。
- `.runtime/harness-021-validation/workspaces/fde-agent` 保存 247 个项目文件，复制用 ditto 并核对内容和高精度 `mtimeMs`。除源码与资料外，显式保留非秘密业务数据库 `.runtime/maintenance/state.json`（14,743 字节）；其余临时目录按白名单排除。没有复制模型密钥、凭据库或旧浏览器令牌。
- 三条 Session 副本仅重写独立首 header frame 的 cwd；后续事件 frames 原样保留，路径使用官方编码规则。原 v0/v3 文件通过官方相邻迁移发布 v4，旧代副本不变。
- `history-validation.json`：两条空会话及一条真实会话迁移成功。真实会话保留 31 轮、235 次工具调用、1347 个事件，助手正文 SHA-256 `4d319e85cd39f81d9d6afd5fafbf8e8817ae8616ab384a7c746790a50822ee94`；只读迁移与发布后读取完全一致。
- 原运行区 27 个文件核对 0 变化；原项目先前 246 个文件核对 0 变化，新增业务数据库复制也逐字节和 mtime 核对通过。没有让新版本打开原运行区。

## 在线验收

服务由 `DSH_HOME=../../.runtime/harness-021-validation/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3082` 启动，不自动打开浏览器。

`running-verification.json` 的实际结果：

- 未授权首页 401；启动令牌交换 303；Cookie 授权后的首页 200，FF 产品标题正确。
- 认证 WebSocket `/api/remote.mux` 升级成功。
- Boot Manifest 明确为 0.2.1-rc.2，FDE project、Sidebar、Review 三个在线 Bundle 均 200；FDE 资源含“运行输出”“手动终端”和新工具名，没有旧 `terminal_create`/`terminal_wait_for`；Review 资源包含 codec 工厂补丁。
- 项目快照和 35 份资料正常返回，新增 stale 数为 0。
- 三条会话用量均 ready；真实会话显示 31 轮、228 步，uncached input 1,085,583、cache read 40,427,776、output 185,142。
- 错误项目的输出接口 404、跨来源 403；旧 Host 的 PTY 缺失返回 missing，没有伪造输出或启动替代进程。

没有启动示例业务系统或请求真实模型；独立验证区的模型配置需要用户自行确认。实际另一台 LAN 设备的访问、浏览器视觉和真实交互由用户手动验收，不能由本机 HTTP 或单元测试代替。

## 存储与交接

- 没有新 worktree、分支或重复源码 checkout。
- `.runtime/harness-021-upgrade/` 约 28 MiB：源码树记录、哈希、审查输入和验证日志。`server.log` 包含本次私有启动授权链接，不上传、不提交。
- `.runtime/harness-021-validation/` 约 22 MiB：运行中的隔离项目、迁移后 Session 和本地配置。验收及回退窗口结束后，先停止 3082，再清理两个目录；用户在验证区产生的新成果须先保留。
- Harness `node_modules/` 当前总占用约 2.4 GiB，不是本轮净新增；可按 frozen-lockfile 重建，运行和构建期间保留。
- 原桌面 ZIP 与原运行数据继续保留。T001–T007、T009 完成，T008 人工确认未完成；未提交、未推送 GitHub。

## 人工反馈：取消自动首次使用弹窗

用户明确要求不自动显示“预览版说明”和“开始使用”。先更新 AC-029、PSC-027、AC-F027-002 与 T009，再修改代码。FDE Web 组合将 `welcomeNotice`、`credentialOnboarding` 设为 false；预览步骤不注册，凭证步骤保留显式入口但自动返回空内容。账号和模型设置插件继续加载，不写入虚假的声明确认或凭证状态，Connection 授权未变。上游专门测试自动引导的 Web 场景改为显式测试 overlay 开启，不改变工作台发布默认值。

- PRD、Product Spec 与 F027 `--require-ready` 校验退出 0。
- `corepack pnpm exec vitest run packages/client/ui-settings-models/tests/apply.client.spec.ts packages/client/ui-settings-models/tests/onboarding-dialog.client.spec.tsx packages/bundle/web-app/tests/onboarding-defaults.spec.ts`：3 文件、29 项通过（`onboarding-tests.log`）。覆盖默认配置、关闭预览、保留模型/账号扩展槽、卸载、自动不读写凭证、显式编辑可用。
- `corepack pnpm run build`：8 项制品通过；两个新增测试类型导致聚合检查失败（`onboarding-build.log`）。修正 Host 测试跨编译面引用和泛型 slot mock 类型后，`corepack pnpm run build:check` 两项通过、退出 0（`onboarding-build-check.log`）；生产源码与制品未再变化。受影响的组件与组合两个测试文件重验 14 项通过（`onboarding-revised-tests.log`）。
- `gen-config-catalog` 更新两个生成目录；Models 包说明与配置目录的命名双语检查 2 对通过。修改范围 `git diff --check` 通过。
- 使用显式隔离 DSH_HOME 重启 3082；认证后首页 200，版本 0.2.1-rc.2，`__DSH_MODELS_ONBOARDING__` 两项均为 false。实际 Models Bundle 含 `configured.welcomeNotice`、`configured.credentialOnboarding` 与 `if (!automatic && !explicit) return null`，211535 字节，SHA-256 `ca5ca6c09adc04b9f909b3e3c160aef3c4d22608bb1a2588cb5b971fc7cc6f79`。在线资源与本地文件直接逐字节比较未通过（资源服务会转换内容），未以该比较宣称一致；验收依据为在线实际代码条件和初始化配置。
- Workspace 登记仍只有隔离的连锁门店项目及原三条会话。未调用模型、未访问真实凭证、未新增运行副本；未运行浏览器自动验收或全套 Web E2E。当前 Chrome 页面刷新后的体验由用户确认，T008 保留未完成。

---
document: feature-plan
feature: F027
status: ready
updated: "2026-10-23"
---

# F027 · 官方 0.2.1-rc.2 兼容计划

## 现有上下文与复用

- 当前主仓库 `/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench`；HEAD `1c4767f8f4c3af6beb251ac51a36a9f49bf9d6fd`，工作树含已确认的 Skills、部署说明和录制脚本改动，全部保留。
- 旧官方 `0a15e36e7f82b6ed45af6fa9759f29b40dcd965d` / `dsh-v0.1.6-alpha.1`；目标 `687f282e8625c6b8d11ff58211a90524be2e4317` / `dsh-v0.2.1-rc.2`，不滚动跟随 master。
- 复用官方 Agent Loop、Session 迁移、Host/Client 扩展与现有 11 个 FDE 包，不重写执行引擎。
- 保留 PSC-001、PSC-008、PSC-009、PSC-010、PSC-026、PSC-027、PSC-028；除用户明确确认的 PSC-029 授权访问、PSC-030 终端分工外，PRD 与总规格语义保持。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| upstream/deepseek-harness、lock | 锁定基座与源码 | 精确三方合并并更新构建组合 | AC-F027-001 |
| packages/fde、packages/client/ui-fde-* | 领域与 UI 扩展 | 适配已变化接口，移除上游退役的 invariant 注册 | AC-F027-002, AC-F027-004, AC-F027-005, AC-F027-006 |
| connection、ui-conversation、ui-workspace、ui-sidebar、ui-theme | 本地最小扩展 | 合并上游与原下游语义，优先使用已有公开入口 | AC-F027-002, AC-F027-004 |
| bundle/web-app、pnpm 配置、patches、build-fde-integrations | 组合与第三方能力 | 校验 Sidebar/Review/Observe/Eval，保持 OpenAPI 本地包与默认不外发 | AC-F027-001, AC-F027-003 |
| 隔离 DSH_HOME 与项目副本 | 数据验证 | 验证会话 v3→v4，不改原文件及阶段 | AC-F027-003, AC-F027-006 |
| README、AGENTS、架构、Agent Note、verification | 操作与维护事实 | 按已完成结果同步，不预写通过 | 全部 |

## 实现方案

### 源码合并

使用独立临时 Git index 生成包含当前 tracked/untracked 非忽略源码的树，保存树 ID 和修改清单，不修改主索引、不提交本地工作。旧、新官方树映射到唯一的 `upstream/deepseek-harness/` 路径，再通过 `git merge-tree` 三方计算。无冲突文件机械应用，冲突逐项用 apply_patch 处理；禁止整体覆盖 FDE 包或只保留一侧。实际文件清单、冲突原因和取舍记入验证记录。源码恢复优先使用保存的树和桌面 ZIP，禁止 reset --hard。

### 已知适配

1. 上游删除 dsh-invariants：11 个 FDE 包的 companion、导出、依赖和构建引用随新架构清理；不删除真实领域校验。
2. Connection 鉴权与网关调整：保留所有 FDE 路由的 Host/Origin/Fetch-Metadata、浏览器身份和 Workspace 范围检查；优先接入新版 authenticated route 能力，不能保留绕过鉴权的独立路由。
   - 用户已确认 PSC-029：使用官方 `--host <具体本机IP>` 与浏览器授权，不再提供全网卡免登录。旧 `--lan` 仅返回清晰迁移错误，不启动监听；本机默认 loopback 保留。FDE 自定义 HTTP 路由必须检查当前连接身份，仅接受 owner 浏览器/身份，不把有限权限 API Peer 视为全权用户。
3. 项目 Hero、项目上下文侧栏、会话视图 selectView 与文件刷新：对照新版 Slot/Store，保留空白与已存在会话两条进入路径及远程子会话刷新。
   - 实际合并发现 WorkspaceBrowser 含 32 处交叠，旧文件承载 FDE 项目创建、企业/周期、默认目录、项目级操作和阶段侧栏；最新版同文件重做通用 Workspace 树。保留当前 FDE 浏览器及项目行呈现作为产品实现基准，逐一适配新版 Session/状态/Slot 类型；不把官方新通用树替换成产品设计决定，不回退新版模型、协议或鉴权层。其余共享类型、菜单注册和 Store 按需要合并，既有用例验证 FDE 行为。
4. Session v4：使用官方相邻迁移，不重写历史事件；用量与 Eval 读取器按新事件合同适配，训练保留原 native-session 创建、恢复、flush 与错误结果。
5. 工具链：目标官方 pnpm 11.28.5，先验证它与本组合的安装；若再次复现既有 peer 解析问题，依据错误选择可用版本并记录，不无证据改锁或全量降级。
6. 第三方只做兼容所需更新。OpenAPI 固定源码包保持；Sidebar 补丁只保留未被新版替代的预览、默认布局与刷新语义。观测与官方会话遥测仍默认不外发。
   - 发布包实查：Better Sidebar 0.28.0 对应官方 0.2.1，但 Web browser 内置标签已删除，终端改用宿主能力。采用该兼容版本，原项目预览由 FDE 注册仅接受本平台已分配项目代理地址的标签承接，不引入 URL 导航或通用浏览器；原启动/停止与来源隔离合同不变。默认禁用自动子代理/Jobs 打开，配置改用新版正式 Config，而非继续修改旧编译包默认值。
   - Observe 使用已声明支持 0.2.1 的 0.2.25，仍默认禁用。File Review 维持当前最新 0.5.0；只在本组合中把其 DSH peer 定位到当前 workspace，必须补齐实际接口适配和运行检查后才视为兼容，不以 peer 覆盖作为验收。
   - 终端方案已确认：在 Web 组合挂载官方 Agent PTY registry、shell 后端和工具。模型使用 `terminal_open(type, name)`、`terminal_send/read/signal/list/close`，不再提示不存在的 `terminal_create`、`terminal_wait_for`。FDE 只读 HTTP 接口按 Workspace 的运行记录解析 Session 和终端名，通过公开 `agents.get` 与 `terminals.list/read` 获取有界输出；不接受客户端提供终端 ID、命令或其他项目路径，不激活缺失 Agent。Client 观察器在标签可见期间读取，离开即取消；缺失输出明确显示，不新建终端。独立手动终端复用官方 sidebarRight 的 terminal 页签，不与 Agent PTY 混接。界面解释共享文件/端口及重新核验要求。
7. 实验室和固定 Eval collector 按 Session v4 的一级 `role: tool` 消息读取结果，不再从 `content` 中寻找已退役的 `tool-result` 嵌套块。实验室仍以真实工具调用与成功结果关联资料授权；Eval 保留旧代日志读取分支。此适配由真实 Loader＋脚本模型的资料授权、错误工具结果和恢复用例证明，不调用外部模型。

### 人工验收反馈：Review 阻断 Web 启动

用户截图暴露 `dsh-file-review-tab` 激活失败。新版 `conversation.chat.turnTail` 是 list，旧插件仍以 chain 的 select/priority 注册，缺少 list 的 id；原测试没有声明这个槽位，回调未执行而误判注册完成。修复维持既有文件审查能力：固定插件补丁使用唯一 id/order，模块级组件自行筛选当前 Turn 的文件并显式传递 matched，无文件返回 null；不回退官方槽位或禁用插件。同时按 v4 message.isError 判定失败工具，避免失败变更进入审查卡。回归覆盖声明先于/晚于插件、真实槽位渲染、空结果和失败结果，再做一次 Chrome 启动确认，不扩大为全量浏览器回放。

### 人工验收反馈：取消自动首次使用弹窗

复用 `ui-settings-models` 已有 `credentialOnboarding: false`，保留 `deepseek-official` 步骤供显式 API Key 编辑。仅在该包已有公开初始化配置中增加默认开启的 `welcomeNotice`，关闭时不注册预览说明；FDE Web 组合明确关闭这两个选项。账号插件、模型设置、凭证读写和 Connection 授权不改，不使用 CSS 隐藏、浏览器缓存或伪造确认状态。定向验证 Host 初始化配置、实际槽位注册与释放、无凭证自动不展示及显式编辑仍可打开；构建后核对 3082 在线初始化配置和 Client Bundle，交回用户手动刷新验收。

### 数据保护与预览

主 `.runtime/dsh-home` 与 `/Users/muyu/FDE-Agent/fde-agent` 为原数据事实源。新版首次运行使用 `.runtime/harness-021-validation/dsh-home` 与同目录下的项目副本，端口 3082。只复制验证所需的 Workspace 登记、非秘密领域状态和会话原件，不读取或复制凭据、.env、浏览器令牌或受保护凭据库；不调用真实模型。复制项目文件保留高精度 mtime 并核对哈希，改写副本路径时保留 Zstandard 首 header 独立 frame。原运行区继续留存，用户人工确认前不让新版写入。

## 实施顺序

1. 本 Feature 文档、架构方案与验证记录先落盘并通过局部规格校验。
2. 记录当前源码树与运行数据基线；停止确属本项目的旧服务后进行源码合并，避免 HMR 混用两个版本。
3. 完成注册、请求、会话、UI 与第三方适配；每次只修本升级引入的错误。
4. 安装与构建，再执行直接受影响的无密钥定向测试。
5. 在隔离数据中验证历史会话与项目投影，启动 3082，核对认证后首页、实际 Boot Bundle 及 Workspace。
6. 同步当前文档并交用户人工体验。未经追加授权，不推送、不执行全量浏览器回放、不调用模型、不切换原运行区。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 155 个已改官方文件中 141 个也被新版修改 | 文本合并成功不代表交互保持 | 逐项复核真正的语义冲突 | 合并与定向检查 |
| 旧 Session 与新版写入格式不同 | 回退代码不能回退数据 | 先在副本迁移，原件不变 | 运行前 |
| 既有未提交改动 | 简单 git checkout 会丢失工作 | 临时 index 树与桌面完整 ZIP | 合并前 |
| 第三方插件耦合预发布 API | 构建或运行不兼容 | 检查公开版本与真实类型，仅适配受影响链 | 安装、构建 |
| 新默认功能带外发或权限变化 | 数据与行为越界 | 明确保持禁用，不用默认值代替既有决定 | Bundle/HTTP 检查 |

## 回退策略

原源码 ZIP 为桌面 `FDEDeliveryWorkbench-源码快照-20261023-112326.zip`，包含本地未提交源码但不含运行数据。另保存本轮当前源码树 ID，仅按明确升级文件恢复，不覆盖用户后续变化。停止新版验证进程后，恢复原源码与依赖版本，并使用一直保留的原 `.runtime/dsh-home`；不得以旧代码打开新版验证目录。验证目录、临时 index 和构建日志在人工验收及回退窗口结束后可清理，不创建另一份 Git checkout/worktree。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F027-001 | 固定目标、完整安装构建 | frozen-lockfile 安装与项目 build | 退出码和版本 |
| AC-F027-002 | 原入口与状态关系保留 | 受影响 Client/项目定向测试，随后用户手动体验 | 入口、归属与阶段断言 |
| AC-F027-003 | 数据恢复、迁移、用量 | 一次隔离历史会话恢复与源哈希比较 | 旧代原件不变、新代可读、投影一致 |
| AC-F027-004 | 请求授权与项目隔离 | FDE 路由和 Connection 的定向测试 | 不可信拒绝、可信可用 |
| AC-F027-005 | 原生 Skill 同源 | 现有 platform-skills 与 skills-center 定向检查 | 七项加载/引用/下载保持 |
| AC-F027-006 | 训练与项目隔离 | native-session 与实验室定向检查 | 身份、恢复与错误分支保持 |
| AC-F027-007 | 只读输出与独立手动终端 | 输出路由、标签呈现、启动停止指令定向检查 | 身份归属、只读、缺失及新工具名 |

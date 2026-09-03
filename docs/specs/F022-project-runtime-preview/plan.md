---
document: feature-plan
feature: F022
status: ready
updated: "2026-08-27"
---

# F022 · 项目运行与内嵌预览实施计划

## 现有上下文与复用

- 当前项目阶段由 `fde-stage` 按 WorkspaceId 持久化，`ui-fde-stage` 已在 Session 页头显示阶段；F022 在同一页头工具槽增加运行动作，并从项目开发阶段开始出现。
- `fde-project` 已提供 Workspace 级项目快照、架构/OpenAPI 工具和可信同源路由，适合增加 `.fde/project-runtime.json` 读写、操作版本和 Agent 报告工具。
- 锁定的 `dsh-better-sidebar@0.16.1` 已具备 Agent 持久终端工具、Terminal Tab、Browser Tab、loopback 精确允许列表和 iframe 限制说明。F022 复用这些能力，不另造终端、后台进程或通用浏览器。
- 当前“API 文档”按阶段出现并读取 `.fde/api-docs.json`。本 Feature 将其收紧为“阶段＋运行中＋真实 OpenAPI”三个条件，并在显式配置缺失时读取当前运行报告。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/fde/project/` | 项目级产物、快照、OpenAPI 与 Agent 工具 | 增加运行记录解析/原子写入、start/stop 请求、operationId 校验、`project_runtime_report` 工具和运行态 OpenAPI 来源 | AC-F022-002～005 |
| `packages/client/ui-fde-project/` | 项目进度与项目交付 View | 增加阶段感知页头运行控件、Agent 启停提示、运行轮询、终端/Browser 打开、Host 重启后的终端恢复和 API View 动态可见条件 | AC-F022-001～006 |
| Better Sidebar 受控设置 | 右侧 Files/Editor/Git/Review | 在运行动作中开启 Agent Terminal、Terminal/Browser Tab，并只允许当前预览精确 loopback authority | AC-F022-002, AC-F022-004 |
| F012 API 文档合同 | 显式项目配置和 OpenAPI 工具 | 接受运行记录作为非覆盖式来源；停止/阻塞时不显示运行态 API View | AC-F022-005 |
| README、Architecture、Agent Note、验证记录 | 组合和持久合同 | 同步状态文件、提示词、终端边界、API 可见规则和最窄验证 | 全部 |

## 实现方案

Host 在项目 `.fde/project-runtime.json` 保存有界记录：`schemaVersion`、`revision`、`operationId`、`action`、`status`、时间、说明，以及可选 `previewUrl/docsUrl/openapiSource/baseUrl`。浏览器的 start/stop 路由只创建 `starting/stopping` 操作并返回项目快照；只有当前项目 Agent 的 `project_runtime_report` 工具能以精确 operationId 提交成功、阻塞或停止结果。启动 `blocked` 保留当前 operationId 与发起 Session，允许同一 Session 在补齐条件并提交已验证 previewUrl 后恢复为 `running`；停止阻塞和其他终态不放宽。写入使用项目内锁和原子替换，过期报告不能覆盖新操作。

Client 页头控件从 Session membership 解析 WorkspaceId，同时订阅阶段与项目快照。点击启动后先把当前 Session 选择为 `chat` View，再通过 Better Sidebar 的同源 settings 路由开启 Agent Terminal、Terminal 和 Browser；Client 把 Host 返回的偏好同步到当前 Sidebar service，然后用带项目路径的内容 Tab 展开右栏。之后向当前 Session 排队一条业务可见提示：读取 `AGENTS.md`、使用 terminal 工具启动/验证、调用 `project_runtime_report`，并在当前对话用简短中文说明结果和下一步。提示发送失败时调用 abandon 路由把 `starting` 改为 `blocked`，避免永久加载；页头始终只是状态摘要，不接管中央内容。

Client 在 `starting/stopping` 期间以短间隔刷新，在启动 `blocked` 期间以较低频率继续刷新同一项目快照。首次观察到同一 operationId 从 `starting` 或启动 `blocked` 进入 `running` 后，把预览 URL 的精确 `hostname:port` 合并进 Better Sidebar loopback 允许列表，并在当前 Session 自动打开一次 Browser Tab；同一 running 快照重新渲染不重复打开。停止提示只查找当前项目运行终端，发送 `SIGINT`、等待退出并报告；不关闭 Terminal Tab。

查看终端时，Client 始终先打开运行记录绑定的 Session，并等待 Better Sidebar 的活动 Session 与其一致。终端查找优先匹配 `terminalTitle`：先 Agent Tab，再当前 Session 中用户已经可见的同名普通 Terminal Tab，最后才回退到该 Session 最近的 Agent Tab；短暂等待终端推送后仍不存在，说明 Host 已丢失旧 PTY。此时 Client 选择原项目对话并排队一条恢复提示，要求 Agent 先列举终端、必要时只创建空的“项目运行”终端并核验既有预览，不重复启动/停止、不调用无 operationId 的报告，也不冒充旧输出可恢复。

API Docs 读取顺序为：显式 `.fde/api-docs.json` 优先；缺失时可使用 `running` 记录中的 `openapiSource/docsUrl/baseUrl`。Conversation View 只有当前阶段至少 development、运行状态为 `running` 且 API 快照为 configured 并含 `openapiSource` 时注册。OpenAPI 工具继续每次从 calling Agent Workspace 解析配置，不接收浏览器任意地址。

## 实施顺序

1. 冻结 F022 状态、运行入口、Agent/终端和 API 可见合同，并同步 PRD、Product Spec、Feature Map、F012 与 Architecture。
2. 实现项目运行记录、Host start/stop/abandon 路由和 `project_runtime_report`，覆盖 operationId、URL、状态迁移与项目隔离测试。
3. 实现页头控件、启动时自动选择当前对话、启动阻塞低频刷新、运行 Controller、Agent 正常回复提示和阶段可见规则。
4. 接入 Better Sidebar 终端/Browser 与精确 loopback 允许列表，首次恢复 running 后自动打开一次并保留终端输出。
5. 让 API 文档/OpenAPI 读取当前运行来源并按真实运行状态注册 View。
6. 覆盖当前/原运行 Session、同名普通 Terminal Tab、终端推送等待和 Host 重启后恢复提示。
7. 运行 Host/Client 聚焦测试、目标 bundle/typecheck/build 和一次 3080 HTTP 启动检查，记录证据后交给用户手动验证，不执行浏览器截图或完整 E2E。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| Agent 可能未按提示报告终态或只更新工具状态 | 页头可能停留在 starting/stopping，或用户只看到状态而看不到解释 | operationId 持久化、启动先选择对话、提示明确要求报告后正常回复；提示派发失败立即 abandon；FDE 可重试 | Host/Client 测试与人工流程 |
| Agent 先报告 blocked 后继续修复并启动成功 | 服务真实运行但页头、API 与预览仍停留在阻塞 | 仅允许当前 operationId 与发起 Session 的启动阻塞恢复 running；Client 对启动阻塞低频刷新，并对首次 running 自动打开一次 | Host 状态测试＋Client 组件测试＋人工流程 |
| 用户已有 Better Sidebar 偏好禁用终端/浏览器 | 运行按钮无法打开可见执行面 | 仅在明确启动动作中通过受信任 settings 路由合并必要能力，不改其他 Tab/Viewer 偏好 | Client 聚焦测试 |
| loopback iframe 需要 same-origin 能力 | Vite/HMR 或 API fetch 可能失效 | 只把本次预览精确 host:port 加入允许列表，不全局放开 localhost 所有端口 | URL/偏好测试与人工页面 |
| 服务禁止 iframe | 内嵌页面不可见 | 复用 Better Sidebar 的响应头探测、真实原因和外部打开备选；不取消 sandbox | 人工页面 |
| 停止命令范围过宽 | 可能误伤其他项目服务 | 提示只操作当前项目 Agent 终端 UUID，禁止 `pkill/killall`，停止后保留证据 | 提示词测试 |
| Host 重启后进程事实可能漂移 | 文件显示 running 但服务已退出 | 状态明确是最后一次 Agent 报告；重新打开/启动前由 Agent核验，不以端口扫描自动改事实 | 恢复测试/文档说明 |
| Host 重启后 Agent PTY 与旧输出丢失 | 页头仍有“查看终端”，但旧终端无法激活 | 先匹配当前 Session 可见同名 Tab；没有时通过原项目 Agent 只恢复观察终端并核验既有服务，明确不恢复旧日志、不重复启动 | Client 终端定位与恢复提示测试 |

## 回退策略

F022 的状态文件、Host 工具和 Client 控件均位于独立 FDE 插件。移除页头注册和 Host 路由即可回到原有对话/文件开发流程；`.fde/project-runtime.json` 可保留为无害历史记录。Better Sidebar 只合并用户偏好，不删除其他 Tab 或终端数据。F012 的显式 `.fde/api-docs.json` 仍可独立恢复，回退不修改项目源码或 Session。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F022-001 | development 起持续页头运行入口 | Client Slot/可见性组件测试 | 早期阶段不显示，开发及后续阶段状态一致 |
| AC-F022-002 | 当前对话可见、终端启动、精确运行报告和内嵌预览 | Host 状态/工具测试＋Client 提示/Sidebar 合同测试 | 启动先选择 chat，operationId 正确，Agent 正常回复，终端可查，running 后打开真实 URL |
| AC-F022-003 | 不可启动真实阻塞且可在同一协作中恢复 | Host blocked→running 守卫＋Client 低频轮询/自动打开测试 | 只接受当前操作与 Session 的真实恢复，页头/API 自动更新，Browser 只打开一次 |
| AC-F022-004 | 安全停止并保留终端 | Client 停止提示合同＋Host 状态测试 | SIGINT/等待/报告，不关闭终端，停止失败不伪装 |
| AC-F022-005 | API View 随运行 OpenAPI 出现 | Host 配置优先级＋动态 View 注册测试 | running＋OpenAPI 才出现，停止/无 OpenAPI 时收起 |
| AC-F022-006 | Host 重启后“查看终端”不进入死路 | Client 终端定位/等待测试＋恢复提示合同测试 | 同名终端直接激活；终端不存在时回到原 Session 并排队安全恢复，不重复启动或伪造旧日志 |

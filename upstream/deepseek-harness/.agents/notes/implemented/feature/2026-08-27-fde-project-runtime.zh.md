# Agent Note: Agent 驱动的 FDE 项目运行与内置预览

Status: implemented

[English](2026-08-27-fde-project-runtime.md) | 中文

## Problem

[项目开发文档](2026-08-27-fde-project-development-docs.zh.md)让实施工作变得可见，但不会运行已开发产品。否则 FDE 必须离开工作台、猜测命令、寻找端口、管理进程，并记住哪个浏览器页面和终端属于哪个项目。通用“运行”命令并不真实，因为不同项目使用不同技术栈，项目唯一可信的启动说明可能只存在于 `AGENTS.md` 及其引用文件中。

“API 文档”也有相同边界。进入项目开发阶段并不能证明服务正在运行，也不能证明存在真实 OpenAPI 来源。提前显示页面会把计划能力伪装成运行事实。本记录部分收紧[项目交付页面](2026-08-26-project-delivery-pages.zh.md)原有的纯阶段可见性，但不会把项目生命周期所有权转移给 Better Sidebar。

## Decision

`@deepseek-ai/dsh-fde-project` 为每个已注册 Workspace 持有一份有界 `.fde/project-runtime.json` 记录。可信同源启动或停止 route 创建精确 `runtime_<uuid>` 操作，包含单调 revision、发起 Session、动作和过渡状态。只有该 Session 能通过稳定工具 `project_runtime_report` 结束操作。Host 拒绝过期 operation id、无效迁移、跨 Session 报告、带凭据或非 loopback URL，以及越过已注册项目的 OpenAPI 路径。

`@deepseek-ai/dsh-client-ui-fde-project` 从项目开发阶段开始，在现有 Session 顶部增加紧凑运行控制。启动时先选择当前 Session 的“对话”，再通过锁定版本 Better Sidebar 的持久设置 route 启用终端与 Browser，但不启用 Side Chat、Subagent 或底部工作台；随后创建 Host 操作，并向当前项目 Session 排队一条可见用户指令。该指令要求 Agent 读取项目 `AGENTS.md`、只遵循真实引用的运行说明、使用持久终端工具、验证就绪、报告已验证事实或具体阻塞，并在正常对话中说明结果与下一步。页头只承担状态摘要和恢复动作，不拥有或替换中央内容。可见指令排队失败时会结束待处理 Host 操作，不留下虚假的永久启动中状态。

启动侧的 `blocked` 报告是可恢复状态，不再是永久终态。同一发起 Session 在补齐缺失条件并验证有效 loopback 预览后，可以把同一当前操作恢复为 `running`；过期 operation id、其他 Session、停止阻塞和无效 URL 仍会被拒绝。页头会快速刷新过渡状态，并以较低频率刷新启动阻塞。首次观察到当前操作从 `starting` 或 `blocked` 进入 `running` 时，页面只自动打开一次内置项目 Browser。同一快照还会重新计算“API 文档”可见性，因此真实 OpenAPI 来源无需第二次启动或刷新页面即可出现。

页头注册会捕获 `ctx.inject(['betterSidebar'], ...)` 提供的作用域 Context 中的 Better Sidebar 实例。运行回调不会再从插件外层 Context 延迟读取该服务；后者虽然能成功注册界面，但会在用户点击“启动项目”时才失败。

Agent 创建或复用名为“项目运行”的持久终端。启动中、运行中、停止中、阻塞和曾经停止等状态会在有意义时提供该保留终端。停止操作发给原运行 Session，使用 `terminal_signal(SIGINT)` 加终端观察，并明确禁止无范围 `pkill`、`killall` 和 `terminal_close`。确认停止后会清除预览与 API 运行事实，但在当前 Host 生命周期内保留终端标题和输出。停止结果不明确时保持阻塞，只能重试停止，不能重复启动服务。

“查看终端”始终先打开运行记录绑定的 Session，并等待 Better Sidebar 采用该 Session 后再读取其布局。查找顺序依次为同名 Agent 终端、该 Session 中已经可见的同名普通终端、最近的 Agent 终端。Harness Host 重启会真实销毁内存 Agent PTY 及其输出，即使最后一份运行记录仍为 `running`。短暂等待后仍无终端时，动作会返回原项目对话并排队一次可见恢复指令：先列举终端，必要时只创建一个空的替代观察终端，再按照项目说明核验已记录预览；明确禁止重复启动或停止服务、在没有当前 operationId 时报告，或声称恢复了旧日志。

“打开项目”使用 Better Sidebar 公共 `openTab` Browser 表层。打开前，客户端只把已验证预览的精确 loopback `host:port` authority 加入 `browserAllowedLoopback`，绝不启动操作系统浏览器。“API 文档”仍以项目开发阶段为最低门槛，但只有当前快照为 `running`、API 文档已配置且存在 OpenAPI 来源时才注册。显式 `.fde/api-docs.json` 继续有效；运行 Agent 报告也可以提供已验证 OpenAPI URL 或项目相对来源。

## Verification

[`project-runtime.spec.ts`](../../../../packages/fde/project/tests/project-runtime.spec.ts)覆盖精确操作归属、loopback 限制、OpenAPI 投影、终端身份保留、启动阻塞恢复、停止阻塞重试、防止重复启动和指令排队失败恢复。[`project-runtime-header.client.spec.tsx`](../../../../packages/client/ui-fde-project/tests/project-runtime-header.client.spec.tsx)覆盖可见启动动作、启动阻塞刷新、一次性自动打开 Browser 与停止未决控制。Apply 集成测试通过已注册页头注入对象直接执行“启动项目”，并证明作用域 Better Sidebar 实例会在 Agent 指令排队前打开项目文件树。Controller 与 View 可见性套件固定同源 route 请求体，以及“运行中且有 OpenAPI”这一 API 文档门槛。

Apply 集成测试还固定了阻塞路径的展示合同：“启动项目”会在排队可见指令前选择“对话”并打开当前 Session，且提示明确要求 Agent 在运行报告后正常使用中文回复。[`project-runtime-sidebar.client.spec.ts`](../../../../packages/client/ui-fde-project/tests/project-runtime-sidebar.client.spec.ts)覆盖同名普通终端兼容、延迟到达的 Agent 终端、可恢复的终端缺失结果，以及不得重复启动的恢复指令。限定范围的 Host 与 Client TypeScript 项目均通过 `--noEmit` 编译，客户端包可以 bundle，直接受影响的测试均通过。本切片按协同开发约定不做浏览器自动化；手工使用仍需验证目标项目自己的 `AGENTS.md`、原生 PTY 可用性、真实命令、就绪 URL 和渲染后的应用。

## Alternatives considered

**在工作台中硬编码包管理命令与端口。** 拒绝，因为工作台面向通用项目，不能把一个样例技术栈变成虚假产品合同。

**让按钮直接调用 shell route。** 拒绝，因为通用 Host route 无法理解项目说明、处理常见启动失败，也无法通过现有可见 Agent 协作解释尚不可启动的项目。

**使用普通 Bash 后台任务。** 拒绝，因为用户无法在工作台中可靠观察、中断或再次查看。锁定终端工具已经提供 Session 归属、保留输出、信号控制和可见页签。

**在操作系统浏览器中打开预览。** 拒绝，因为这会打断一体化交付流程并丢失项目／Session 关联；内置 Browser 已经提供 loopback 白名单。

**项目开发一开始就显示 API 文档。** 拒绝，因为阶段状态只证明工作流位置，不证明运行状态或 OpenAPI 可用性。

## Consequences

FDE 可以在项目交付表层内启动、观察、打开和停止真实项目，同时命令与端口仍由项目自身说明持有。项目无法启动时仍停留在普通 Agent 对话中，不再出现中央空白，FDE 可以直接继续协作开发。运行成功成为明确、可恢复的 Workspace 事实，而不是从 Agent 回复中推断；同一事实也避免 API 文档在可用前出现。

该流程依赖锁定版本 Better Sidebar Host 具备原生 PTY 支持并挂载设置服务。运行记录不会在 Harness 崩溃后监管进程、探测任意远程部署、推断 Docker 拓扑，也不保证服务在最后一次验证后持续健康。这些情况保持阻塞或陈旧，必须由明确新操作处理，而不是隐藏重试。

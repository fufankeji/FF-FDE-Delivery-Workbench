---
document: feature-spec
feature: F022
status: ready
updated: "2026-08-27"
---

# F022 · 项目运行与内嵌预览规格

## 目标与可观察结果

项目进入开发阶段后，FDE 可以从项目交付页头启动或停止当前项目。点击启动会先打开当前项目 Session 的对话，再由 Agent 读取项目 `AGENTS.md` 及其引用的真实运行说明，并使用右侧工作区中的持久终端启动服务；无论成功还是阻塞，Agent 都在当前对话正常说明结果与下一步。成功后在同一右侧工作区打开项目页面。只有项目正在运行且 Agent 已报告真实 OpenAPI 来源时，“API 文档”才出现。项目尚不能启动时，正常对话保持可见，页头只显示状态摘要和恢复动作。

## 来源与范围

- 来源需求：REQ-017, REQ-025, NFR-001, NFR-003, NFR-005, NFR-007, NFR-008, NFR-010
- 来源总规格：PSC-004, PSC-008, PSC-009, PSC-011, PSC-012, PSC-017, PSC-019, PSC-029
- 对应 PRD 验收：AC-016, AC-024
- 本 Feature 包含：项目开发及后续阶段的常驻运行入口；项目级运行状态；由 Agent 读取 `AGENTS.md` 并使用 Better Sidebar 持久终端启动/停止；同一 Host 生命周期内的终端输出保留；Host 重启后的终端入口安全恢复；成功后的内嵌项目预览；Agent 报告预览/OpenAPI 地址；运行状态驱动 API 文档入口；失败和恢复。
- 本 Feature 不包含：进程管理平台、任意命令配置表、自动修复所有启动错误、生产部署、端口扫描、浏览器自动测试、在项目进度页直接启动项目。

## 业务对象

| 对象 | 身份与归属 | 关键内容 | 约束 |
|---|---|---|---|
| 项目运行记录 | WorkspaceId | revision、operationId、动作、状态、时间、说明、预览地址、可选 API 地址 | 保存于当前项目 `.fde/project-runtime.json`；不得按最近项目或端口猜测 |
| 项目运行终端 | SessionId＋当前项目目录 | Agent 创建的持久终端、标题和输出 | 只在当前项目范围执行；同一 Host 生命周期内停止后保留输出；Host 重启后旧 PTY 与旧输出不可伪造恢复 |
| 项目预览 | 当前运行记录＋预览 URL | Better Sidebar Browser 中的真实页面 | 只接受 Agent 验证并报告的 loopback HTTP(S) 地址；按精确 host:port 放行 |
| API 运行来源 | 当前运行记录 | docsUrl、openapiSource、baseUrl | 只有运行中且 OpenAPI 来源存在时开放 API 文档；停止后不继续显示为可用 |

## 用户旅程与状态

| 当前状态 | 用户动作/系统事实 | 下一状态 | 可观察结果 |
|---|---|---|---|
| `stopped` | FDE 点击“启动项目” | `starting` | 当前 Session 切换到对话，页头显示“正在启动”，右侧终端展开，Agent 收到一次启动指令 |
| `starting` | Agent 验证项目页面并报告成功 | `running` | 页头显示“运行中”，右侧打开项目预览；若有 OpenAPI，API 文档入口出现 |
| `starting` | 缺少 `AGENTS.md`、项目尚不可运行或启动失败 | `blocked` | 当前对话保持可见，Agent 正常说明原因和下一步；页头显示简短原因及“继续开发/查看终端”，不伪造地址或 API 文档 |
| `blocked`（启动失败） | FDE 在同一项目对话补齐条件，原发起 Session 随后验证真实页面并以当前 operationId 报告成功 | `running` | Client 低频刷新后更新页头、自动打开一次右侧项目预览；若报告真实 OpenAPI，API 文档入口同步出现 |
| `running` | FDE 点击“停止项目” | `stopping` | Agent 只停止本项目运行终端中的服务，页面显示“正在停止” |
| `stopping` | Agent 报告停止成功 | `stopped` | 项目预览/API 文档入口收起；终端标签和历史输出保留 |
| `stopping` | Agent 无法确认停止 | `running` 或 `blocked` | 保留真实状态和原因，不显示已停止假成功 |
| `blocked`（启动失败） | FDE 明确点击“重试启动” | `starting` | 新 operationId 取代旧启动操作，旧错误仍留在对话和终端证据中；适用于原操作未继续恢复的情况 |
| `blocked`（停止失败） | FDE 查看项目/终端或重试停止 | `stopping` | 保留原预览和运行终端，不允许再次启动出第二份服务；新 operationId 只重试停止 |
| `running` | FDE 在 Host 重启后点击“查看终端” | `running` | 优先激活当前运行 Session 中标题匹配的终端；若不存在，返回原项目对话并让 Agent 只恢复一个新的可观察终端、核验既有服务，不重复启动，也不声称恢复了旧日志 |

## 功能行为

### 运行入口

1. 运行入口位于项目交付页头右侧，和阶段状态、Session Log 同层；它不是左侧全局项目入口，也不在“项目进度”页面执行启动。
2. 当前阶段早于“项目开发”时不显示运行入口；从项目开发开始，在对话、架构、评估等项目交付 View 间切换时入口持续存在。
3. `stopped` 提供“启动项目”；启动失败的 `blocked` 提供“继续开发/重试启动”并保持低频状态刷新，使同一项目协作恢复成功后无需重复启动；停止失败的 `blocked` 提供“打开项目/查看终端/重试停止”，不得再次启动出第二份服务；`starting/stopping` 禁止重复提交，`running` 提供“打开项目”和“停止项目”。
4. 点击启动先选择当前 Session 的“对话”，再创建一次 Host 运行操作并排队一条可见指令；不在浏览器中直接执行 Shell，也不要求用户再点一次“继续开发”才能看到 Agent 回复。

### Agent 启动与停止

1. 启动指令要求 Agent 先读取当前项目根 `AGENTS.md`；存在引用的 README、运行手册或脚本时按项目真实说明执行，不猜测固定技术栈、端口或 `/docs`。
2. `AGENTS.md` 不存在、说明不足或源码尚不能启动时，Agent 调用项目运行报告工具写入 `blocked` 和具体原因，随后必须在当前对话用简短中文说明结果和下一步仍需开发的内容；不能只更新页头状态或只调用工具。FDE 在同一对话明确补齐条件后，原发起 Session 可以使用同一 operationId 重新报告已验证的 `running`；Host 仍校验 Session、operationId 和 URL。
3. 长运行服务必须使用 Better Sidebar 的 `terminal_create/list/read/wait_for/signal` 工具；成功前要检查真实页面是否可达，再通过 `project_runtime_report` 提交当前 operationId、预览地址和可选 API 地址。
4. 停止动作仅针对本项目运行终端。优先向该终端发送 `SIGINT` 并确认服务退出，不调用 `terminal_close`，不使用无范围的 `pkill/killall`；终端输出在停止后继续可查。

### 查看终端与 Host 重启恢复

1. “查看终端”始终定位运行记录绑定的 Session，并等待 Better Sidebar 切换到该 Session 后再查找终端，避免从其他会话或尚未切换完成的布局读取。
2. 查找时优先选择标题与运行记录 `terminalTitle` 精确一致的 Agent 终端；为兼容用户已可见的同名 Terminal Tab，也允许激活当前 Session 中标题精确一致的普通终端；仅在没有同名 Tab 时才回退到该 Session 最近的 Agent 终端，不回退到其他项目或其他 Session。
3. Host 重启会丢失 Better Sidebar 内存中的 Agent PTY。当前 Session 中确实没有可打开终端时，Client 不显示“终端尚未出现”的死路提示，而是切回原项目对话并排队一次可见恢复指令：Agent 先 `terminal_list`，不存在时只创建标题为“项目运行”的空终端，再按项目说明核验已记录的预览地址；不得重复启动、停止或修改服务，不调用无当前 operationId 的运行报告，也不得宣称旧终端输出已经恢复。

### 内嵌项目与 API 文档

1. Client 首次观察到当前启动 operationId 从 `starting` 或启动 `blocked` 进入 `running` 后，启用 Better Sidebar 的 Terminal/Browser 能力，把预览 URL 的精确 loopback `host:port` 加入允许列表，并在当前 Session 的右侧工作区自动打开一次“项目预览”；刷新、重新挂载或重复读取同一 running 快照不重复打开。
2. 不打开系统默认浏览器；若目标服务明确禁止 iframe，Better Sidebar 显示真实限制和已有外部打开备选，不把空白页当成功。
3. “API 文档”入口同时满足三项条件才出现：当前阶段至少为项目开发、项目运行状态为 `running`、存在已验证的 `openapiSource`。只有 `docsUrl` 而没有 OpenAPI 来源时可在项目预览中查看文档，但不开放项目 API 工具页签。
4. 显式 `.fde/api-docs.json` 继续是用户可维护配置；本次运行报告只在显式配置缺失时提供当前运行来源，不覆盖用户文件。

## 异常与恢复

| 情况 | 用户可见状态 | 系统行为 | 恢复方式 |
|---|---|---|---|
| 当前 Session 不属于项目 | 不显示或提示当前会话不可运行 | 不回退到最近 Workspace | 进入真实项目会话 |
| 阶段早于项目开发 | 不显示运行入口 | 不创建运行记录、不发提示词 | 完成前一阶段人工门 |
| `AGENTS.md` 缺失 | 当前对话中的 Agent 说明＋页头 `blocked` 摘要 | 不猜测启动命令，不替换或清空中央对话；Client 对启动阻塞保持低频刷新 | 在同一对话补齐说明并由原 Session 验证成功后恢复 running，或明确点击重试创建新操作 |
| Better Sidebar 终端依赖不可用 | 启动失败并保留原因 | 不退回不可观察的后台进程 | 修复终端依赖后重试 |
| 停止失败或无法确认退出 | `blocked`＋停止失败原因，原预览与终端仍可进入 | 不宣称已停止，不开放新的启动操作 | 查看终端处理残留服务后重试停止 |
| Agent 未报告 operationId 或报告过期操作 | 当前操作不变并显示版本冲突 | 拒绝旧操作覆盖新运行 | 以当前页头动作重新执行 |
| 预览可用但无 OpenAPI | 项目可打开，API 文档不出现 | 不猜测 `/openapi.json` 或 `/docs` | 项目实现/暴露 OpenAPI 后重新启动或报告 |
| 页面刷新 | 从 `.fde/project-runtime.json` 恢复最后状态并重新连接当前 Host 中仍存活的终端 | 不根据页面缓存改变运行事实 | 查看终端或由 Agent 核验 |
| Host 重启后旧 Agent 终端不存在 | 保留最后运行状态；点击“查看终端”进入原项目对话并恢复新的可观察终端 | 不重复启动服务，不伪造旧 PTY 或历史输出，不根据残留端口自动改变运行状态 | Agent 核验既有预览；若服务已失效，由 FDE 再明确启动或停止 |

## 验收标准

### AC-F022-001 · 项目开发阶段提供持续运行入口

- 来源：REQ-025, NFR-005, NFR-010, PSC-029
- 对应 PRD 验收：AC-024
- Given 当前 Session 属于已进入项目开发的项目
- When FDE 在对话或任一已开放项目 View 间切换
- Then 页头持续显示同一项目运行状态与相应动作；需求调研和方案设计阶段不显示该入口

### AC-F022-002 · Agent 按项目说明在可见终端启动并真实报告

- 来源：REQ-025, NFR-001, NFR-003, NFR-007, NFR-008, PSC-004, PSC-008, PSC-011, PSC-017, PSC-029
- 对应 PRD 验收：AC-024
- Given 项目包含可执行的 `AGENTS.md` 运行说明
- When FDE 点击“启动项目”
- Then 当前 Session 先切换到对话并收到一次启动指令，Agent 使用右侧持久终端启动并验证真实页面，Host 只接受当前 operationId 的运行报告；Agent 在对话说明结果和下一步，页面可查看终端输出和内嵌项目

### AC-F022-003 · 不可启动时真实阻塞且可继续开发

- 来源：REQ-025, NFR-005, NFR-007, NFR-008, PSC-012, PSC-029
- 对应 PRD 验收：AC-024
- Given 项目缺少运行说明、服务尚未实现或启动失败
- When Agent 先报告阻塞，随后 FDE 在同一项目对话补齐条件并由原发起 Session 真实验证项目
- Then 当前 operationId 可从 `blocked` 恢复为 `running`；Client 自动刷新页头并只打开一次右侧项目预览，真实 OpenAPI 同步开放 API 文档；若仍未恢复则继续显示具体原因，不产生中央白屏、假 URL、假 API 文档或后台残留成功

### AC-F022-004 · 停止项目保留证据并关闭运行入口

- 来源：REQ-025, NFR-005, NFR-007, PSC-009, PSC-029
- 对应 PRD 验收：AC-024
- Given 当前项目处于 `running`
- When FDE 点击“停止项目”且 Agent 确认服务退出
- Then 状态回到 `stopped`，项目预览与运行态 API 文档入口收起，原终端及其输出仍可打开；停止失败时保留真实状态和原因

### AC-F022-005 · API 文档只随真实运行 OpenAPI 开放

- 来源：REQ-017, REQ-025, NFR-001, NFR-002, NFR-008, PSC-019, PSC-029
- 对应 PRD 验收：AC-016, AC-024
- Given 项目已进入开发阶段
- When 项目启动成功并报告或未报告真实 OpenAPI 来源
- Then 只有 `running` 且 `openapiSource` 有效时显示“API 文档”；停止、阻塞或只有预览地址时不显示，OpenAPI 工具继续绑定当前 Workspace 和受控方法

### AC-F022-006 · 查看终端在 Host 重启后可安全恢复

- 来源：REQ-025, NFR-005, NFR-007, NFR-008, PSC-008, PSC-012, PSC-029
- 对应 PRD 验收：AC-024
- Given 项目运行记录为 `running`，但 Host 重启使原 Agent 终端不再存在
- When FDE 点击“查看终端”
- Then Client 先定位并等待运行记录绑定的 Session；有同名终端时直接激活，没有时返回该项目对话并只排队一次恢复终端与核验既有服务的指令，不显示死路错误、不重复启动项目、不伪造旧日志

## 开放问题

- 无。本 Feature 只交付本地开发/交付阶段的项目运行与预览；生产部署、进程托管和多服务编排在部署试运行阶段另行确认。

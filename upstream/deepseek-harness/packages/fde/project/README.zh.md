# @deepseek-ai/dsh-fde-project

[English](README.md) | 中文

FDE 项目交付页面使用的可信 Host 支持。它只解析显式 Harness WorkspaceId，只读取该项目的 `.fde/project-runtime.json`、`.fde/api-docs.json`、`.fde/architecture.json`、`.fde/evaluations/`、固定的需求／方案／验证产物、标准项目开发文档和需求 Wiki 状态，校验有界结构后，通过同源接口返回一个浏览器快照。阶段产物读取器只报告已有、缺失或读取失败，不创建文件，也不把文件存在当成确认；已有的 Markdown 产物会获得有大小限制的同源只读预览地址，Host 按已索引产物标识选择文件，不接受浏览器传入路径。它还适配锁定版本 `dsh-openapi` 的解析和 HTTP 实现，使标准 OpenAPI 工具按调用 Agent 所属的已注册 Workspace 解析配置，而不是使用进程级共享 API 清单。

## 项目开发文档

只读研发投影扫描 `docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md`，以及最多 100 个规范 `docs/specs/FNNN-slug/{spec,plan,tasks}.md` Feature 目录。可选 frontmatter 提供标题、状态、计划日期、里程碑和阻塞；Markdown 未勾选/已勾选任务是唯一任务数量来源。缺少日期时保持未知，重复 Feature ID 会被报告，浏览器没有反写任务 API。同一投影还报告 `fde-deliverables/03-project-development/` 下三份收口文件。Host 提供字节前会重新索引每个预览 ID，并用 realpath 检查文件仍位于已登记 Workspace 内。

## 项目运行

一次明确的启动或停止请求会在 `.fde/project-runtime.json` 中创建一个精确操作，并绑定必须执行它的 Session。可见 Agent 读取项目自己的 `AGENTS.md`，使用 Better Sidebar 持久终端工具，验证真实 loopback 项目地址，再通过 `project_runtime_report` 结束该操作。启动阻塞后，如果同一 Session 在同一操作中补齐条件并验证了真实预览地址，可以恢复为运行中；Host 仍会拒绝过期 operation id、其他 Session 的报告、非 loopback 或带凭据的 URL、越过项目的 OpenAPI 路径和其他无效状态迁移。停止项目时，只有 Agent 如实报告服务已经退出后，才清除项目预览与 API 运行事实，同时保留终端标题和可回看的输出。停止结果不明确时必须先重试停止，不能再次启动。

## 验证合同

验证投影会有界解析 schema v2 的 `.fde/evaluations/validation.json`，包括候选版本、环境、项目适用数据、指标、结果和问题。每个指标都必须引用一份或多份此前阶段的真实项目文档，并给出文档内编号；PASS／WARN 证据也必须解析到已登记 Workspace 内真实文件。验证计划存在且所有来源可读取后，同源精确方案操作会把 FDE 确认原子写入 `.fde/evaluations/validation-plan-approval.json`。其 SHA-256 摘要覆盖候选、环境、数据和指标定义，但不包含执行结果、证据和问题状态：修改方案会使旧确认失效，正常写回结果则不会。必需指标 NOT_RUN／FAIL、证据缺失、未接受 WARN、未关闭 critical／high 问题、固定产物缺失，以及方案尚未确认或确认已失效，都会保持为明确阻塞项。同一快照还索引 `fde-deliverables/04-validation/{validation-plan,validation-report,validation-baseline}.md`，供页面有界预览；它不会运行验证或推进交付阶段。

## 需求 Wiki

可信启动 route 接受既有 FDE Source 目录中的 1～30 个明确 SourceId。每个 Source 必须在 `.fde/derived/` 下拥有当前有效的 `ready` 派生文件；构建会冻结原件字节数与修改时间、解析器身份与版本、派生路径、完整 Source 目录指纹和预期 Wiki revision。发布会重新检查每项冻结事实，并拒绝发生变化、被移除、新增、来自其他项目、仍待解析或被重新解析的资料。

`requirement_wiki_get` 只公开精确的活动构建，并把它标记为运行中。`requirement_wiki_publish` 校验一份完整候选，最多允许 120 个知识页、360 条关系、80 个冲突和 80 个未知项；每一项都必须引用构建中的 SourceId，页面 Markdown 不能包含可执行 HTML。成功发布会创建不可变的 `.fde/requirement-wiki/versions/RNNNNNN/` 目录，并原子替换 `current.json`。失败或取消只更新 `build.json`，不会改变上一份当前 revision。项目 Source 目录变化会把当前 revision 标记为 stale，但绝不会自动启动重建。

## 模型体验

### 项目 OpenAPI 与系统架构工具

#### 模型看到什么

五个稳定工具 Schema：`openapi_list`、`openapi_describe`、`openapi_call`、`architecture_get` 和 `architecture_set`。执行时，每个工具通过 Workspace 注册表解析 `exec.agent.session.header.cwd`。OpenAPI 结果只包含当前项目的接口元数据或有界 HTTP 响应；凭据保持为环境变量引用，不进入工具参数或结果。系统架构写入要求精确当前 revision，并原子替换一份完整候选。

#### Token 影响

能看到全局工具注册表的 Agent，其每次请求会增加五个固定 Schema 的输入 Token。项目接口目录和系统架构文件只在工具被调用后加载，并且只通过该次有界结果进入上下文。

#### KV 缓存影响

Schema 在不同项目和请求之间保持一致，因此修改当前项目 OpenAPI 文件不会改变可缓存的工具 Schema 前缀。工具结果只改变普通对话后缀。

### 需求 Wiki 工具

#### 模型看到什么

两个稳定工具 Schema：[`requirement_wiki_get`](../../../docs/tool-catalog.zh.md#requirement_wiki_get) 和 [`requirement_wiki_publish`](../../../docs/tool-catalog.zh.md#requirement_wiki_publish)。前者返回精确 BuildId 对应的固定 Source 元数据、预期 revision 和可选的当前 Wiki；后者接受一份完整且可追溯的候选。两个工具都不会发现用户确认构建之外的 Source。

#### Token 影响

能看到全局工具注册表的 Agent，其每次请求会增加两个固定 Schema 的输入 Token。构建元数据和当前 Wiki 只在调用 `requirement_wiki_get` 后进入上下文；选定的派生内容只在 Agent 读取返回的项目路径后进入上下文；已发布候选则通过有界的 `requirement_wiki_publish` 结果进入上下文。

#### KV 缓存影响

Schema 在不同项目和构建之间保持一致，因此 Source 或 Wiki 变化不会改变可缓存的工具 Schema 前缀。工具调用和依赖数据的结果会扩展普通对话后缀。

### 项目运行报告工具

#### 模型看到什么

一个稳定的 `project_runtime_report` Schema。可见的启动或停止指令提供精确 operation id；工具按调用 Session 解析已注册 Workspace，并只接受该操作对应的状态和已验证运行事实。

#### Token 影响

能看到全局工具注册表的请求会增加该固定 Schema 的输入 Token。操作专属 id、URL、终端标题和失败原因只通过可见用户指令与有界工具结果进入上下文。

#### KV 缓存影响

Schema 在不同项目之间保持稳定；每次操作只改变普通对话后缀。

## 已知限制与延期工作

- 本包不会自行执行服务命令、运行评估或创建系统架构产物；启动和停止工作由可见项目 Agent 通过持久终端完成。
- 本包不会根据 Git 历史、文件时间、Agent 回复或对话内容推断日期、任务完成和 Feature 状态，也不会编辑项目 docs。
- API 文档必须来自项目显式文件或已验证的运行中项目报告；没有 OpenAPI 时保持未配置状态。
- 评估报告当前只读；损坏报告会被排除，不会自动修复。
- 适配层刻意复用锁定插件的解析和请求模块，因为上游插件的进程级静态 API 清单本身无法提供 Workspace 隔离。
- 系统架构历史以文件形式保存在 `.fde/architecture-history/`；浏览器当前只展示最新版本。
- 需求 Wiki 历史以文件形式保存在 `.fde/requirement-wiki/versions/`；Host 快照只展示完整的当前 revision 和最近构建。
- 本包不会上传或解析 Source、编辑 Wiki 页面、运行自动重建，也不会把候选知识提升为需求基线或交付阶段。

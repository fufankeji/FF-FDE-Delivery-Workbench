# @deepseek-ai/dsh-fde-project

[English](README.md) | 中文

FDE 项目交付页面使用的可信 Host 支持。它只解析显式 Harness WorkspaceId，只读取该项目的 `.fde/api-docs.json`、`.fde/architecture.json`、`.fde/evaluations/` 与需求 Wiki 状态，校验有界结构后，通过同源接口返回一个浏览器快照。它还适配锁定版本 `dsh-openapi` 的解析和 HTTP 实现，使标准 OpenAPI 工具按调用 Agent 所属的已注册 Workspace 解析配置，而不是使用进程级共享 API 清单。执行前守卫会把 `dsh-eval-harness` 的用例和结果限制在同一项目，拒绝符号链接穿越、模型指定可执行文件或 Profile，并禁用未获授权的 Judge 校准。

## 需求 Wiki

可信启动接口从现有 FDE Source 清单接收 1～30 个显式 SourceId。每项 Source 必须在 `.fde/derived/` 下拥有当前有效的 `ready` 派生文件；Build 会固定原件字节数与修改时间、解析器身份与版本、派生路径、完整 Source 清单指纹和预期 Wiki revision。发布时会再次核对所有固定事实，并拒绝已变化、已移除、新增、跨项目、待解析或重新解析的资料。

`requirement_wiki_get` 只暴露准确的活动 Build，并把它标记为运行中。`requirement_wiki_publish` 校验一份完整候选，最多包含 120 个页面、360 条关系、80 个冲突与 80 个未知项；每一项都必须引用 Build 内的 SourceId，页面 Markdown 不能包含可执行 HTML。发布成功后创建不可变的 `.fde/requirement-wiki/versions/RNNNNNN/` 目录，并原子替换 `current.json`。失败或取消只更新 `build.json`，不会改变之前的当前 revision。项目 Source 清单发生变化时，当前 revision 会标记为 stale，但不会自动重建。

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

两个稳定工具 Schema：[`requirement_wiki_get`](../../../docs/tool-catalog.zh.md#requirement_wiki_get) 和 [`requirement_wiki_publish`](../../../docs/tool-catalog.zh.md#requirement_wiki_publish)。前者返回准确 BuildId 的固定 Source 元数据、预期 revision 与可选当前 Wiki；后者接收一份完整且可追溯的候选。两个工具都不会发现用户确认 Build 之外的 Source。

#### Token 影响

能看到全局工具注册表的 Agent，其每次请求会增加两个固定 Schema 的输入 Token。Build 元数据与当前 Wiki 只在 `requirement_wiki_get` 被调用后进入上下文；已选派生内容只在 Agent 读取返回的项目路径时进入，而发布候选只通过有界的 `requirement_wiki_publish` 结果进入。

#### KV 缓存影响

Schema 在不同项目和 Build 之间保持一致，因此 Source 或 Wiki 变化不会改变可缓存的工具 Schema 前缀。工具调用与数据相关结果只扩展普通对话后缀。

## 已知限制与延期工作

- 本包不会启动项目服务、运行评估或创建系统架构产物。
- API 文档地址必须明确归属于项目；没有配置时保持未配置状态。
- 评估报告当前只读；损坏报告会被排除，不会自动修复。
- 适配层刻意复用锁定插件的解析和请求模块，因为上游插件的进程级静态 API 清单本身无法提供 Workspace 隔离。
- 系统架构历史以文件形式保存在 `.fde/architecture-history/`；浏览器当前只展示最新版本。
- 需求 Wiki 历史以文件形式保存在 `.fde/requirement-wiki/versions/`；Host 快照只展示完整的当前 revision 与最新 Build。
- 本包不上传或解析 Source、不编辑 Wiki 页面、不自动重建，也不会把候选知识提升为需求基线或交付阶段。

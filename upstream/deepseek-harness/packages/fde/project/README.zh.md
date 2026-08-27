# @deepseek-ai/dsh-fde-project

[English](README.md) | 中文

FDE 项目交付页面使用的可信 Host 支持。它只解析显式 Harness WorkspaceId，只读取该项目的 `.fde/api-docs.json`、`.fde/architecture.json`、`.fde/evaluations/`、固定的需求调研与方案设计产物和需求 Wiki 状态，校验有界结构后，通过同源接口返回一个浏览器快照。两个阶段产物读取器只报告已有、缺失或读取失败，不创建文件，也不把文件存在当成确认；已有的 Markdown 产物会获得有大小限制的同源只读预览地址，Host 按各阶段固定产物标识选择文件，不接受浏览器传入路径。它还适配锁定版本 `dsh-openapi` 的解析和 HTTP 实现，使标准 OpenAPI 工具按调用 Agent 所属的已注册 Workspace 解析配置，而不是使用进程级共享 API 清单。

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

## 已知限制与延期工作

- 本包不会启动项目服务、运行评估或创建系统架构产物。
- API 文档地址必须明确归属于项目；没有配置时保持未配置状态。
- 评估报告当前只读；损坏报告会被排除，不会自动修复。
- 适配层刻意复用锁定插件的解析和请求模块，因为上游插件的进程级静态 API 清单本身无法提供 Workspace 隔离。
- 系统架构历史以文件形式保存在 `.fde/architecture-history/`；浏览器当前只展示最新版本。
- 需求 Wiki 历史以文件形式保存在 `.fde/requirement-wiki/versions/`；Host 快照只展示完整的当前 revision 和最近构建。
- 本包不会上传或解析 Source、编辑 Wiki 页面、运行自动重建，也不会把候选知识提升为需求基线或交付阶段。

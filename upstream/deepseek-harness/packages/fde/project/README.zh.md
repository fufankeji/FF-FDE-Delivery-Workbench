# @deepseek-ai/dsh-fde-project

[English](README.md) | 中文

FDE 项目交付页面使用的可信 Host 支持。它只解析显式 Harness WorkspaceId，只读取该项目的 `.fde/api-docs.json`、`.fde/architecture.json` 和 `.fde/evaluations/` 产物，校验有界结构后，通过同源接口返回一个浏览器快照。它还适配锁定版本 `dsh-openapi` 的解析和 HTTP 实现，使标准 OpenAPI 工具按调用 Agent 所属的已注册 Workspace 解析配置，而不是使用进程级共享 API 清单。执行前守卫会把 `dsh-eval-harness` 的用例和结果限制在同一项目，拒绝符号链接穿越、模型指定可执行文件或 Profile，并禁用未获授权的 Judge 校准。

## 模型体验

### 项目 OpenAPI 与系统架构工具

#### 模型看到什么

五个稳定工具 Schema：`openapi_list`、`openapi_describe`、`openapi_call`、`architecture_get` 和 `architecture_set`。执行时，每个工具通过 Workspace 注册表解析 `exec.agent.session.header.cwd`。OpenAPI 结果只包含当前项目的接口元数据或有界 HTTP 响应；凭据保持为环境变量引用，不进入工具参数或结果。系统架构写入要求精确当前 revision，并原子替换一份完整候选。

#### Token 影响

能看到全局工具注册表的 Agent，其每次请求会增加五个固定 Schema 的输入 Token。项目接口目录和系统架构文件只在工具被调用后加载，并且只通过该次有界结果进入上下文。

#### KV 缓存影响

Schema 在不同项目和请求之间保持一致，因此修改当前项目 OpenAPI 文件不会改变可缓存的工具 Schema 前缀。工具结果只改变普通对话后缀。

## 已知限制与延期工作

- 本包不会启动项目服务、运行评估或创建系统架构产物。
- API 文档地址必须明确归属于项目；没有配置时保持未配置状态。
- 评估报告当前只读；损坏报告会被排除，不会自动修复。
- 适配层刻意复用锁定插件的解析和请求模块，因为上游插件的进程级静态 API 清单本身无法提供 Workspace 隔离。
- 系统架构历史以文件形式保存在 `.fde/architecture-history/`；浏览器当前只展示最新版本。

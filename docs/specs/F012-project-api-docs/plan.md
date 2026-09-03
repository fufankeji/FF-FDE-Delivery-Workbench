---
document: feature-plan
feature: F012
status: ready
updated: "2026-08-27"
---

# F012 · API 文档与受控接口使用实施计划

## 现有上下文与复用

- 本地 `FF-LangChain-Agent-Lab` 已验证最小展示方式：从当前项目 API 基地址生成真实 `/docs` 地址，通过 iframe 展示，并提供新窗口打开；项目关闭时显示不可用状态。
- 官方 Conversation 的 `conversation.view` 可承载当前项目的“API 文档”页面；组件必须通过 Session membership 解析 WorkspaceId，不按 cwd 或最近项目回退。
- 直接集成公开 `dsh-openapi@fb854355b89e495ded090b9e2eb94c33430d2366`（v0.1.0，MIT）。该插件支持 OpenAPI 3.0/3.1、接口搜索/描述/调用、默认 `GET/HEAD`、方法和参数校验、凭据环境注入、私网/重定向检查、超时与响应上限。
- `dsh-openapi` 没有浏览器 UI，且当前配置是插件级 API 目录；原样挂载不能自动满足 Workspace 项目隔离，因此必须增加薄的 FDE 项目配置与作用域适配，不能把安装成功当作 Feature 完成。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| Web Profile/Bundle 第三方依赖 | 当前未包含 `dsh-openapi` | 固定公开提交并挂载 Host 插件，保留其安全默认值和 MIT 许可 | AC-F012-002～003 |
| `packages/fde/project/` | 项目级交付产物 Host | 新增 Workspace 级 API 文档/OpenAPI 配置读取，并复用 `dsh-openapi` 实现注册项目作用域工具 | AC-F012-001～004 |
| `packages/client/ui-fde-project/` | 项目级交付页面 Client | 注册“API 文档”Conversation View、受限 iframe、外部打开、加载/未配置/失败状态 | AC-F012-001, AC-F012-004 |
| FDE Agent/工具作用域 | 当前无项目 OpenAPI 目录 | 工具执行时从 calling Agent cwd 解析注册 Workspace；保留标准工具名和安全边界 | AC-F012-002～004 |
| Bundle、TypeScript 聚合、第三方声明 | FDE Web 组合 | 注册新 Host/Client 包与固定第三方来源、版本、许可和兼容证据 | 全部 |
| Architecture、Agent Note、验证记录 | 技术决策与证据 | 记录项目运行地址来源、插件适配、失败语义和真实测试结果 | 全部 |

## 实现方案

Host 侧由 `fde-project` 优先读取项目 `.fde/api-docs.json`，其中保存 `docsUrl`、`openapiSource`、可选 `baseUrl`、允许方法、私网开关及非秘密凭据环境引用。该文件缺失时，才读取 F022 当前 `running` 记录中由 Agent 工具以 operationId 提交的 `docsUrl/openapiSource/baseUrl`；模型不能在单次工具参数中临时增加任意 API。

`dsh-openapi` 作为固定 Git 依赖进入 FDE Web 组合，但不挂载其进程级静态目录。`fde-project` 直接复用其解析、目录、参数校验、凭据注入、重定向和有界请求模块，注册 `openapi_list`、`openapi_describe`、`openapi_call`。每次执行都从 `exec.agent.session.header.cwd` 解析已注册 Workspace，再读取该项目配置；跨项目测试证明两个目录不会互相出现。

Client 插件只在阶段至少为项目开发、运行状态为 `running` 且 API 快照含真实 `openapiSource` 时通过 `conversation.view` 注册“API 文档”。可用时使用受限 iframe 加载真实文档页，并提供外部打开；停止、阻塞或无 OpenAPI 时不注册，探测失败和浏览器拒绝内嵌分别呈现。View 不读取 `dsh-openapi` 工具结果来伪造页面状态。

F022 提供统一运行来源和状态；F012 保留显式项目配置优先级，并把当前运行报告作为非覆盖式回退，不改变 `docsUrl/openapiSource/baseUrl` 产品合同。

## 实施顺序

1. 确认并固定 `dsh-openapi` 提交、许可证、包边界和当前 Harness 兼容性。
2. 建立 Workspace 级 API 配置与状态读取，覆盖未配置、离线、可用和失败。
3. 复用 `dsh-openapi` 实现注册按执行解析的项目工具，验证 list/describe/call 和跨项目隔离。
4. 实现“API 文档”View、受限 iframe、外部打开和真实失败状态。
5. 接入项目启动结果或显式配置，完成切换、取消、刷新和恢复。
6. 运行聚焦安全/作用域/组件测试和官方构建，重启 3080 后交由用户人工检查；不运行浏览器截图或完整 E2E。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| `dsh-openapi` 是插件级静态目录 | 可能让一个项目看到其他项目 API | 不挂载静态目录；工具执行时按 calling Agent Workspace 读取唯一项目配置 | 架构 spike＋跨项目测试 |
| 公开插件面向 DSH rc.5/rc.6 | 当前锁定 rc.2 可能存在合同差异 | 固定提交，先做类型/运行 spike；只维护必要适配，不复制整个实现 | 开发开始时 |
| API 文档地址由项目运行提供 | Agent 可能只发现项目页面而没有 OpenAPI | 显式配置优先；运行回退必须含真实 `openapiSource`，无 OpenAPI 不显示 View且不猜测端口 | F022 联调时 |
| iframe 跨源或服务端禁止嵌入 | 页面可能白屏 | 受限 iframe＋可达性状态＋外部打开；不放宽顶层权限 | 组件/人工检查 |
| loopback/私网 API | 安全默认可能拒绝真实本地项目 | 每项目显式允许，不把 `allowPrivateNetwork` 设为全局默认 | Host 安全测试 |
| 写方法与真实凭据 | 可能改变客户或生产系统 | 默认 `GET/HEAD`，写方法逐项目授权并继续走审批；凭据仅 Host 引用 | 工具调用测试 |

## 回退策略

F012 的 UI 和项目配置是独立 FDE 插件；移除 Client/Host rows 后现有项目对话与开发工作区保持可用。`dsh-openapi` 为独立 Bundle dependency，可从组合移除而不删除项目文件或会话。若兼容性或项目隔离无法证明，回退为只展示受信任 API 文档，不提供 Agent API 调用，并把该降级明确报告给用户，不自行重写安全能力。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F012-001 | 当前项目 API 文档 View 与真实状态 | Client 组件/Slot 测试＋人工检查 | 可用、未启动、未配置、禁止内嵌和失败可区分 |
| AC-F012-002 | 当前项目 OpenAPI 搜索与描述 | 固定插件集成＋Workspace 作用域测试 | 只返回当前项目定义，切换后不串目录 |
| AC-F012-003 | 默认只读、凭据隔离与受控调用 | Host 安全/调用聚焦测试 | 方法、参数、私网、重定向、凭据和响应边界成立 |
| AC-F012-004 | 多项目失败隔离与恢复 | Controller/Host 跨项目测试 | 单项目失败不污染其他项目，重试仍使用明确 WorkspaceId |

---
document: architecture
status: draft
updated: "2026-09-16"
prd: docs/PRD.md
product_spec: docs/specs/product-spec.md
---

# FF - FDE 交付工作台 技术架构

## 1. 状态、范围与事实来源

- 本文记录已经确认的技术方向，以及启动官方 Web 后必须用运行证据验证的架构假设。
- 强制基座：`https://github.com/deepseek-ai/deepseek-harness` 官方源码。
- 架构排除：`/Users/muyu/MuYuProjectBuild/DeepSeekHarnessDesktop` 及其他赋范分叉不作为 Agent、Host 或 Web 运行架构基线；F016 仅按用户明确授权复用该 Studio 的主题资源和已经验证的换肤交互，仍接入当前官方 Harness 插件与 ThemeRuntime。
- 当前官方快照：`deepseek-ai/deepseek-harness@0a15e36e7f82b6ed45af6fa9759f29b40dcd965d`，标签 `dsh-v0.1.6-alpha.1`。上一基线为 `b150a551…` / `0.1.1-rc.2`。本次接口、依赖和运行变化见[升级说明](harness-016-upgrade.md)。
- 官方状态：developer preview，明确允许破坏性变更；因此 V1 必须固定版本，不自动跟随 `master`。
- 当前已完成锁定官方源码、官方 Web 基线、FDE 品牌、项目优先导航、结构化项目创建、项目资料持久化/稳定身份/本地识别/双入口预览、六阶段提示、完整独立项目进度与只读项目详情、API 文档、系统架构、用量分析、评估优化页面和浏览器本地界面主题；正在增加由当前 Agent 驱动的项目运行、持久终端和内嵌预览；FDE 行为继续以独立 Host/Client Plugins 和最小下游 UI 适配实现。

> 运行基线更新：官方源码现已按 `upstream/deepseek-harness.lock.json` 检出到 `upstream/deepseek-harness/`，本地分支为 `main`；页面运行在 `http://127.0.0.1:3080`。当前组合已加入六阶段提示、独立项目进度、项目交付四个结果 View、右侧开发工作区与“界面主题”设置页；Architecture 在完整 FDE 领域与升级验证完成前继续保持 `draft`。

## 2. 架构目标与原则

### 独立业务挖掘实验室（F024）

实验室以 `packages/fde/discovery-lab` Host 插件和 `packages/client/ui-fde-discovery-lab` Client 插件接入当前 `0.1.6-alpha.1` 基座，不维护自定义 Agent Loop。Host 复用官方 Agent、Session、Tools、LLM 和持久化；仅维护实验室自己的轮次数据库和岗位会话，不注入 Workspace、FDE Stage 或项目服务。原插件 `0.3.2` 的业务代码保留来源说明，以最小修改适配当前会话事件接口和权限边界。

Client 在首页及项目中心的 `fde.workbench.module.action` 和原 `sidebar.footer.action` 增加入口，在 `shell.overlay` 挂载独立页面。模块入口槽由 `ui-fde-project` 的全屏页面声明和渲染，不传入项目数据；实验室通过 Slot 注册共享自身导航 Store，不依赖侧栏可见性，也不调用项目控制器。原像素办公室应用由当前宿主的专属路径提供，并在 iframe 中运行，隔离原应用的全局 CSS 与 React 生命周期；不是另起宿主或局域网代理。关闭页面仅改变该插件的浏览状态，不重置项目选择或阶段；返回后保留原工作台。接口采用独立 `/api/fde-discovery-lab` 命名空间，并复用工作台的 Host/Origin/Fetch-Metadata 信任校验。

训练数据位于显式 `DSH_HOME/fde-discovery-lab/`，每案例共享一个当前轮次；原生 Session 日志仍由宿主持久化，但不登记到项目 Workspace。业务原件、案例定义、固定计算模块和 PDF 字体从用户授权的 `0.3.2` 运行包按摘要及白名单导入 Host 包的 `.assets/`，该目录不进 Git，可用导入脚本重建；不导入源码归档的教师和未来事件目录。运行数据不随素材重建覆盖。适配源码、导入脚本和来源摘要受 Git 管理，构建与依赖继续使用当前仓库路径。

打开入口、案例列表或恢复已存在记录不触发模型。真实访谈、核对和报告调用共用宿主模型凭据，保持实验室原 `DEEPSEEK_PROVIDER/DEEPSEEK_MODEL` 环境变量及默认路由，不跟随、不改变普通项目模型选择。开发只运行无密钥验证；真实模型和人工体验不以构建、HTTP 成功或模拟响应代替。当前宿主的空 Session 延迟写入，适配层按精确 Session 原生记录决定创建或恢复，并使用 `sessions.flush(session)` 完成持久化检查点。

1. **Harness 负责 Agent 与执行内核**：复用官方 Workspace、Session、Agent Loop、LLM、Tools、FS、Shell、Terminal、LSP、Jobs、Workflow、SubAgent、Approval、Web Host 和 Client Runtime。
2. **FDE 负责产品领域**：项目来源、三层记忆、候选产物、确认清单、项目基线、阶段门、工程验证和交付语义由独立 FDE Plugins 提供。
3. **不修改 Agent Loop**：新行为使用官方 Cordis 插件、Service Definition/Provider/Consumer、Session Event、Projection、Remote API 和 UI Slot；只有官方没有可用公共扩展点且运行实验证明无法绕开时，才维护最小上游补丁。
4. **项目是唯一交付归属对象**：V1 可以汇总多个已登记项目的进度，但来源、会话、文件、阶段和交付仍严格归属于单个项目；不引入客户、团队资源和资产平台。
5. **持久事实先提交再发布**：项目状态、来源、确认、基线和阶段必须先写入权威持久层，UI 成功和 Agent 可见上下文随后产生。
6. **模型可见即可重建**：所有进入模型请求的 FDE 项目上下文必须能从 Session Log 和项目文件重建，遵守官方 “model-visible means logged” 规则。
7. **原件与派生物分离**：客户原始材料不可被解析文本、Agent 摘要或候选产物覆盖。
8. **版本固定与可升级**：FDE 代码保持独立包和 Bundle；上游升级通过兼容性测试显式进行。

## 3. 总体架构

```text
FF - FDE Web Profile / Bundle
│
├── FDE Client Plugins
│   ├── ui-fde-brand                 FF 品牌与产品文案
│   ├── ui-fde-stage                 六阶段定义、Workspace 级读取、空白与会话头部提示
│   ├── ui-fde-project               项目进度、详情、运行页头与项目 View 宿主
│   ├── ui-fde-document-preview      项目详情/Better Sidebar 共用的只读文档预览
│   ├── ui-fde-api-docs              当前项目 API 文档 View 与真实运行状态
│   ├── ui-fde-architecture          项目级系统架构 View、缩放与导出
│   ├── ui-fde-observability         项目运行汇总与观测导出状态
│   ├── ui-fde-evaluation            项目用例、运行、报告与 Baseline
│   ├── ui-fde-appearance            六套内置皮肤、自定义背景与浏览器本地偏好
│   ├── ui-fde-project-details       候选产物、确认清单与项目基线
│   ├── ui-fde-sources               项目资料导入、刷新与本地识别反馈
│   ├── dsh-better-sidebar           右侧 Files/Editor/Git；按运行操作开启 Terminal/Browser
│   ├── dsh-file-review-tab          会话/轮次 Agent 文件审查（F009）
│   ├── ui-fde-validation            运行、Evals、权限与部署证据
│   └── ui-fde-delivery              验收与交付包
│
├── FDE Host Plugins
│   ├── fde-project                  项目身份、运行记录、运行报告与项目快照
│   ├── fde-source                   原件保存、Source 索引、受控读取与本地派生
│   ├── fde-artifact                 候选产物与版本
│   ├── fde-confirmation             确认项与基线提交
│   ├── fde-stage                    Workspace 级当前阶段；后续交付门与历史
│   ├── fde-api-docs                 项目 API 文档/OpenAPI 配置和作用域
│   ├── dsh-openapi                  固定公开插件；Agent OpenAPI 搜索、描述与受控调用
│   ├── fde-architecture             项目级架构 schema、版本、状态与 Agent 工具
│   ├── fde-observability            Workspace 级本地运行聚合与外部详情配置
│   ├── dsh-observe                  固定公开插件；脱敏 Langfuse/OTLP 导出
│   ├── fde-evaluation               用例/候选版本/报告/Baseline 与隔离编排
│   ├── Semantica Provider Adapter   阶段 4 条件本体／知识图谱构建、验证与受控查询
│   ├── dsh-eval-harness             固定公开插件；真实 Headless Agent 回归
│   ├── fde-context                  项目基线进入 Agent 上下文
│   ├── fde-execution                工程运行与验证投影
│   ├── fde-delivery                 验收与交付包索引
│   └── fde-remotes                  Host/Client 调用合同
│
└── Official DeepSeek Harness
    ├── Workspace / Session / Persistence
    ├── Agent / Agent Loop / LLM
    ├── Tools / Skills / MCP / Preset
    ├── FS / Shell / Terminal / LSP
    ├── Jobs / Workflow / SubAgent
    ├── Approval / User Questions / Plan / Goal
    ├── Attachment（官方当前仅正式支持图片）
    └── WebServer / API / Client Runtime / UI Slots
```

包名是架构职责占位，不是已授权的最终发布名称。实际实现可在职责保持清楚的前提下合并低变化包，但不得把 Host、Client 和产品领域重新混成一个不可验证模块。

## 4. 官方 Harness 能力映射

| FDE 产品能力 | 官方能力 | 复用状态 | 本项目工作 |
|---|---|---|---|
| 空白项目物理范围 | `Workspace`＋目录选择 | 可复用 | 创建目录并注册 Workspace；稳定 WorkspaceId 直接作为 FDE 项目身份 |
| 项目 Agent 会话 | `Session`、Agent Loop、Web Conversation | 可复用 | 一个 Workspace 项目允许多条 Session；会话日志独立，FDE 项目来源、基线和阶段上下文跨会话共享 |
| 对话持久与恢复 | append-only Session Log、JSONL/SQLite persistence | 可复用 | 定义 `fde/*` 事件并验证重放 |
| 文本输入 | 官方 Composer 与 `user/message` | 可复用 | 绑定为当前项目原始来源之一 |
| 图片输入 | 官方 durable image attachment | 可复用 | 建立 SourceId 与 ImageAttachmentRef 的项目关系 |
| 普通文件 | 官方附件明确未支持 generic files/audio/video | 缺失 | 新增 `fde-source` Host/Client capability：原件、SourceId、本地识别与只读预览 |
| 项目文件读写 | `ctx.fs`、read/write/edit、glob/grep | 可复用 | 约束在项目 Workspace，并记录产物关联 |
| 编程 Agent | FS、Shell、Jobs、Terminal、LSP、Skills、MCP、SubAgent、Workflow | 可复用 | FDE Preset 与阶段技能组合；不改 Agent Loop |
| 用户审批 | Approval、AskUserQuestion、Plan Review | 部分可复用 | 即时交互复用官方能力；持久确认清单由 `fde-confirmation` 管理 |
| 阶段/基线/确认 | 无 FDE 领域对象 | 缺失 | 新增事件、服务、投影和 UI |
| 六阶段进度 | `storage-domain`、Workspace membership、Conversation Slots | 可组合 | 按 WorkspaceId 持久化当前状态；实现六个固定 FDE 人工放行并以 `completed` 表示终态，Agent 不拥有推进动作 |
| 工作台界面主题 | `ui-theme` 的明暗偏好、ThemeRuntime Token Override、`settings.section` | 可组合 | 新增 FDE Client 插件，复用 Studio 六套 WebP 皮肤与本地图片处理；浏览器本地持久化，不进入 Host、项目或 Session |
| 代码与项目资料展示 | 官方 Read/Diff/Tool cards＋Better Sidebar Files/Editor/Git＋FileViewer 扩展 | 可组合 | 右侧 Dock 提供文件树、文本/Markdown、代码编辑、Git Diff，并为 Office 补充只读 viewer；不承诺完整 VS Code |
| Agent 文件审查 | 官方工具 Diff/Session Event＋File Review Tab | 可组合 | 按当前会话/轮次展示标准文件工具与 Code Mode 变化；Git/Shell/外部变化保持不同来源语义 |
| 项目运行终端与预览 | Better Sidebar 的 xterm/node-pty、Agent Terminal tools 与 Browser Tab | 可组合 | 从项目开发阶段起只在 FDE 明确启动时开启；Agent 按项目说明启停，日志保留，Browser 只放行当前预览精确 loopback host:port |
| Evals/部署 | 有命令、任务、Trajectory、工具执行，无 FDE 验证/部署产品域 | 部分可复用 | 新增验证对象、门槛、部署证据和 UI |
| 最终交付 | 官方有 produced-files 行，无交付包/验收/移交域 | 部分可复用 | 新增 DeliveryPackage 和 finalization 行为 |

## 5. V1 对象到 Harness 的映射

### 5.1 项目

```text
FDE Project (= Harness Workspace)
├── one physical directory     项目文件与执行 cwd
├── many Harness Sessions      按任务拆分、各自持久的 Agent 会话
└── one FDE Projection         跨会话共享的阶段、基线、清单和产物读模型
```

- V1 直接使用稳定 `WorkspaceId` 作为 FDE 项目身份；`SessionId` 只标识项目内会话。FDE 投影、来源和基线全部以 `WorkspaceId` 为项目键，避免维护第二套易漂移的项目注册表。
- F010 先以官方 `storage-domain` 中的 `fde_stage` 表保存 WorkspaceId → 当前阶段记录；项目成功创建后首次读取只初始化 `requirements`，同项目普通 Session 读取同一记录。该当前值不进入页面 store，阶段说明选择只留在组件本地。
- 创建空白项目时，先创建/选择真实独立目录，再注册 Workspace、创建首个 Session，最后向 UI 发布成功；任一步失败不得留下用户可选的半项目。
- 一个项目可以有多条普通 Session；每条 Session 保留独立消息历史，但模型调用都注入同一项目当前基线、来源索引、阶段与权限边界。SubAgent/Workflow 仍用于单条会话内的子任务，不取代项目会话。
- 项目名称以 Workspace title 持久化；企业、待确认/预计周期保存到项目 `.fde/project-metadata.json`，由 `fde-project` 的可信同源接口按已登记 WorkspaceId 解析，不接受浏览器指定路径。`ui-workspace` 的 `projectMetadata` 服务为创建表单、侧栏和项目中心提供同一份 Host 读取状态；浏览器旧数据仅在项目文件缺失时导入，保留旧值且不覆盖服务器记录。根目录偏好仍保存在浏览器；业务显示名与 ASCII 物理目录名继续分离。
- FDE 新建项目需要“浏览目录＋创建子目录”两个能力同时存在。官方 auto chooser 在本地 macOS loopback 启动时会解析为 native，而 native 只提供系统选择、不提供 `createDirectory`；因此当前 FDE Web Bundle 固定组合官方 `directory-picker-browse` Host backend 与 `ui-directory-picker-browse` Client surface，不再使用 auto。该决定保持官方 capability seam，不修改或绕过 API 权限检查。

### 5.2 项目文件

当前已确认的普通文件目录：

```text
<workspace>/
├── fde-resources/     客户原始普通文件；所有项目会话共享
├── docs/              项目开发唯一规范文档与 Feature/任务证据
│   ├── PRD.md
│   └── specs/
│       ├── product-spec.md
│       ├── feature-map.md
│       └── FNNN-slug/{spec,plan,tasks}.md
├── fde-deliverables/  各业务阶段的固定候选产物
├── .fde/              FDE 领域索引和可再生成状态
│   ├── sources/       SourceId 与原件相对路径、格式、字节、版本和处理状态
│   ├── derived/       按 SourceId 保存的解析 Markdown 与解析器/原件版本元数据
│   ├── artifacts/     阶段候选与正式项目产物
│   └── delivery/      最终交付包索引和可交付文件
└── ...                实际产品源码、配置和测试
```

- 对话文字保存在 Session Log；图片字节使用官方 content-addressed Attachment Store，FDE Source Event 记录项目关系。
- 原件直接、持久地写入可见 ASCII 目录 `fde-resources/`，保留安全化原名并通过重名后缀避免覆盖；普通文件由 WorkspaceId 定位项目，而不是按 Session 创建隔离目录。
- 每个原件建立稳定 SourceId。项目进度详情、Better Sidebar 和后续 Agent 引用使用同一记录；历史 `fde-resources/` 文件在首次列出时补建确定性记录，不复制或移动原件。
- 受支持文档由本地解析器生成 `.fde/derived/<SourceId>.md` 和元数据。原件 size/mtime 或解析器版本改变时派生失效；解析失败或需要 OCR 不影响原件。
- 浏览器原件读取只接受同源 WorkspaceId＋SourceId，不接受任意绝对路径或外部 URL。预览与解析是独立能力状态，均不自动启动 Agent。Host 原件响应保留完整 MIME 与字符集；File Viewer 按存储文件名扩展名分发，MIME 不进入其扩展名字段。
- `.fde/derived/` 和 `.fde/artifacts/` 是可再生成/可版本化内容，不替代原件。
- 真实凭据不得写入上述目录；只记录凭据引用和责任位置。

### 5.3 项目事件

候选事件族：

| Event | 权威事实 |
|---|---|
| `fde/project-created` | WorkspaceId、InitialSessionId 和初始状态 |
| `fde/source-added` | SourceId、类型、不可变引用、权限与元数据 |
| `fde/source-processing` | 处理开始、成功、失败、失效和诊断 |
| `fde/artifact-upserted` | ArtifactId、候选类型、版本、来源与状态 |
| `fde/confirmation-updated` | ConfirmationId、结论、确认者、依据和状态 |
| `fde/baseline-committed` | 新基线版本、提交集合、变化摘要和影响对象 |
| `fde/stage-evaluated` | 阶段门使用的基线、产物、确认、验证和结果 |
| `fde/stage-changed` | 当前阶段变化及来源 Gate 决定 |
| `fde/api-docs-configured` | 项目文档/OpenAPI 来源、允许方法、运行状态和非秘密凭据引用 |
| `fde/architecture-upserted` | 项目架构版本、结构化图、来源、revision 和候选/确认状态 |
| `fde/observability-configured` | 观测启停、后端类型、脱敏范围和非秘密连接引用 |
| `fde/evaluation-recorded` | EvalRunId、候选/用例版本、用例证据、总体结果与 Baseline 关系 |
| `fde/execution-recorded` | 执行、候选版本、结果、失败和产物引用 |
| `fde/validation-recorded` | 验证类型、证据、门槛和结论 |
| `fde/delivery-finalized` | 交付包、验收、移交和项目终态 |

- Event payload 使用稳定 branded id；项目级事件以 WorkspaceId 归属，会话级证据同时携带 SessionId，并可从单条事件独立识别所属业务对象。
- 任何进入模型请求的项目基线/阶段上下文必须由已记录事件重建；不能读取页面内存后直接拼进 Prompt。
- FDE Session Projection 从事件增量折叠出 UI 所需整值，不让 Client 扫描完整历史。

### 5.4 当前六阶段进度与人工返回

- 当前顺序为 `requirements`（需求调研）→ `solution`（方案设计）→ `development`（项目开发）→ `validation`（验证评估）→ `pilot`（部署试运行）→ `handoff`（验收移交），最终进入只表示项目已完成的 `completed` 终态。
- `fde-stage` 提供本机同源的项目状态读取/初始化入口；请求必须携带已注册 WorkspaceId，Host 在持久提交后才返回成功。六个固定动作逐阶段推进至 `completed`，每个动作重新读取自身阶段合同并校验 expected revision；另有一个只接受当前 revision 和非空原因的人工返回动作，由 Host 根据当前状态计算唯一上一阶段，不接受浏览器传入任意目标状态。
- 人工返回与推进共用 Workspace 级串行写入。记录在现有 `currentStage/revision/createdAt/updatedAt` 之外保存有界返回历史（from、to、reason、returnedAt、revision）和待重新确认上界；返回不触碰项目目录、Session、源码、报告或交付物。重新前进仍逐门复核，越过待重新确认上界后才清除该标记；`completed` 只通过“重新打开项目”回到 `handoff`。
- `ui-fde-stage` 用 `useWorkspaces` 的 `sessionIds` 解析当前 Session 所属 Workspace，不按 cwd 或最近项目回退。一个 apply 作用域内的 Host-backed observable controller 为两个 Conversation Slot contribution 提供同一加载状态。F011 的人工门成功后发布只含 WorkspaceId 的浏览器本地失效通知；controller 强制重新读取 `fde-stage` Host 已提交值，通知本身不携带权威阶段，也不刷新其他项目。
- 空白会话保留 Conversation Hero 和常驻输入框，在 `conversation.input.dock` 只显示轻量当前阶段栏；阶段栏从 F010 固定定义读取一句行动提示，从 Host 只读状态读取当前阶段，并通过带 WorkspaceId 的浏览器内导航事件让 F011 直接打开当前项目详情。阶段栏读取 Conversation 共享的 card max-width 与两侧 clearance，在 Slot 外层复现输入卡的水平边界；六阶段全景、输入/输出、资料和确认动作不在工作入口重复。有内容的会话在 `conversation.session.header.utilities` 显示紧凑当前阶段。原 `conversation.view` 中央“交付流程”由 F011 开发时移除，完整进度不再属于某条会话。
- 需求调研阶段的固定产物为 `fde-deliverables/01-requirement-research/requirement-research-report.md`、`confirmation-checklist.md` 与 `requirement-baseline.md`。Host 只读取这三份真实文件的存在状态，不自动创建空产物。
- 三份产物齐备后，项目进度页才允许 FDE 二次确认并进入方案设计；Agent、文件生成完成和普通页面读取都不能自动推进。
- 方案设计阶段的五份固定 Markdown 为 `fde-deliverables/02-solution-design/project-prd.md`、`solution-design.md`、`development-plan.md`、`acceptance-plan.md` 与 `solution-baseline.md`。其中项目 PRD 定义建设对象与可验收行为，方案设计定义技术与工程实现。同阶段结构化产物复用 `.fde/architecture.json`；Host 只在五份文档存在、当前架构为 `confirmed`、阶段和 expected revision 一致时允许 FDE 二次确认进入项目开发。
- 项目开发阶段由 `fde-project` 只读扫描 `docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md` 和 `docs/specs/FNNN-slug/{spec,plan,tasks}.md`。Feature 状态、周期、里程碑、阻塞和任务完成数只来自明确 frontmatter 与 Markdown 任务证据；Host 不建立第二套任务数据库，也不从 Git 提交、文件时间或 Agent 回复推算进度。
- 项目开发固定收口产物为 `fde-deliverables/03-project-development/implementation-report.md`、`runbook.md` 与 `development-baseline.md`。Host 只在三份文件存在、阶段和 expected revision 一致时允许 FDE 二次确认进入验证评估；文件写入、任务勾选和评估运行都不能自动推进。
- 验证评估由 `fde-project` 有界读取 `.fde/evaluations/validation.json`，合同登记当前候选版本、验证环境、项目适用的数据/用例、指标/阈值、每项指标的前阶段来源文档与编号、当前结果、项目相对证据和问题；不复制大体积数据，也不把数据集设为所有项目统一硬门槛。Agent Trial 继续复用 F015 并明确命名为“固定用例回归”，工程、业务、数据/模型、性能、安全和恢复结果按项目适用进入同一合同。
- `fde-project` 以 SHA-256 计算当前方案定义摘要（候选、环境、数据、指标来源文件内容/方法/阈值，不含执行结果、问题状态和 FDE 指标决定），并在 `.fde/evaluations/validation-plan-approval.json` 原子保存 FDE 对该摘要的确认；方案定义或来源文件内容变化后旧确认自动 stale，执行结果和人工决定正常写回不会使确认失效。“生成评估方案”和“开始验证”都由 Client 向当前 Session 排队明确提示并切回对话，前者只维护合同和 `validation-plan.md`，后者只在确认有效时执行真实验证并维护报告/基线。验证固定产物为 `fde-deliverables/04-validation/validation-plan.md`、`validation-report.md` 与 `validation-baseline.md`。项目进度通过精确合同摘要让 FDE 对单个未运行、失败或缺少证据的必需指标填写理由并记录决定时间，Host 保留原结果且只解除该指标阻塞。Host 只在方案确认有效、合同有效、每个必需指标具有合格证据或完整人工接受、关键问题已处理、三份文件存在且阶段/revision 一致时，允许 FDE 二次确认进入部署试运行；Agent、评估报告、人工接受或文件生成不能自动推进。
- 部署试运行的结构化事实保存在 `.fde/deployment-trial.json`：schema v1 记录候选版本、目标环境摘要与 FDE 授权、`preparing/deploying/running/blocked/ready` 状态、验证/部署/健康/回滚/试运行五类项目相对证据，以及问题严重度、状态、说明与责任。固定产物为 `fde-deliverables/05-deployment-trial/` 下部署运行手册、部署基线、试运行报告和问题闭环清单。Host 不执行通用部署或读取凭据；当五类证据、问题决定和四份产物已齐备时，项目进度以当前合同 SHA-256 摘要提供独立 FDE 确认，原子记录环境授权与 ready，接受单条问题不会隐式完成该决定。之后只有环境已授权、状态 ready、证据/产物齐备、critical/high 问题已解决或有人工接受决定且阶段/revision 一致时，FDE 二次确认才能进入验收移交。
- 验收移交的结构化事实保存在 `.fde/acceptance-handover.json`：schema v1 记录最终版本、部署试运行基线、企业验收状态与有界项目相对证据数组、项目内或外部 HTTP(S) 交付物位置/版本/校验值/可取得状态、条件项，以及培训/权限/运维责任移交与项目内证据。`.fde/deployment-trial.json` 是授权和试运行状态的当前事实源，Skill 发现 Markdown 与其冲突时必须以结构化事实刷新材料。项目进度以当前验收合同 SHA-256 摘要提交 FDE 的验收结论、既有交付物可取得状态、既有条件项决定和责任移交记录；Host 在项目锁内只合并这些可变决定字段，保留交付物身份/位置/版本/校验值，拒绝旧摘要。固定产物为 `fde-deliverables/06-acceptance-handover/` 下交付物清单、项目验收报告、运维使用手册和移交确认记录。该动作不执行签章、上传、培训、权限变更或运维接管；只有验收通过或带完整条件通过、交付物可取得、无开放条件、责任与证据移交完整且阶段/revision 一致时，FDE 二次确认才能进入 `completed`。

### 5.5 项目进度页面

- `ui-fde-project` 使用官方 `sidebar.footer.action` 注册左侧一级“项目进度”入口，使用 `shell.overlay` 作为框架挂载点，但产品上呈现为完整独立页面：保留左侧栏，中央/右侧的 Conversation、Composer 和 Better Sidebar 被替换且不可交互，不使用透明模态背景。
- 页面状态为概览、时间轴或明确 WorkspaceId 的项目详情；项目卡先打开只读详情，只有“进入项目交付”才恢复目标 Workspace/Session。
- 页面从 `ctx.workspaces.list` 读取全部已登记项目，以 WorkspaceId 关联 F001 项目基础信息和 F010 当前阶段；单项目失败不阻塞其他项目。
- 项目详情从 `fde-source` 读取 Source 清单和识别状态，并声明 `fde.project.source.preview` Slot。`ui-fde-document-preview` 占用该 Slot，按受控同源文件描述显示只读预览：原始资料 URL 只接受 WorkspaceId/SourceId，阶段产出 URL 只接受 WorkspaceId、阶段类型与合同内固定 ArtifactId；浏览器不能提交任意项目相对路径。详情不提供编辑、移动或删除。
- 项目详情按当前阶段读取输出：需求调研展示三份固定 Markdown；方案设计展示项目 PRD 等五份固定 Markdown 与同一项目系统架构的标题、revision、status；项目开发展示标准 docs、Feature/任务证据和三份研发收口产物；验证评估展示候选版本、输入/指标/证据、问题和三份验证产物；部署试运行展示版本/环境/五类证据/问题和四份产物；验收移交展示最终版本、交付物、验收/条件/责任移交和四份产物。展示层不以 Agent 回复文本、对话摘要或推测状态代替项目文件、结构化合同或证据。
- 项目详情每次进入明确 Workspace 时强制刷新 `fde-project` 快照，避免 Controller 首次加载缓存遮蔽 Agent 新生成的文件或架构确认结果。候选架构行只提供“去确认架构”：先按同一 Workspace 的最新可见普通 Session 规则打开项目交付，再通过 scope-addressed Conversation View 动作选中 `fde-architecture`；项目进度不调用架构确认接口。
- 需求基线、方案产物和研发收口文件即使已经生成也仍是候选，只有 FDE 在项目进度页明确二次确认后才推进相应阶段。确认接口使用当前 revision 防止重复提交或旧页面覆盖新状态。
- 第一版时间轴只消费用户已填写的预计起止日期。周期待确认、日期缺失或日期非法的项目保留在列表并明确说明，不自动生成项目日期、阶段日期或完成百分比。
- 进入项目交付时先在明确 WorkspaceId 的 Session 摘要中排除归档与子 Agent，按 `updatedAt` 选择最新普通会话；只有没有可恢复会话时才调用官方 `connectWorkspace` 复用或创建首个空白会话；不得回退到最近项目或其他 Workspace。
- 公开 `dsh-dashboard@834a07b5601531f686d1a2a261bdf8172c8fa9ce` 与 `dsh-task-board@7fe31114b7dfe959ede4d4993c98f6b6e3b3c0e4`（MIT）已经验证相同 Slot 组合。F011 只复用其原生页面接入方式，不引入外部任务源、Agent 编排、工作树、凭据或任务执行领域。
- 当前时间轴使用本地语义布局，只消费同一真实日期数据，不引入任务编辑或完整甘特依赖。

### 5.6 API 文档与 OpenAPI 能力

- 直接集成 `dsh-openapi@fb854355b89e495ded090b9e2eb94c33430d2366`（v0.1.0，MIT）。该插件提供 `openapi_list`、`openapi_describe`、`openapi_call`，支持 OpenAPI 3.0/3.1、默认 `GET/HEAD`、声明参数校验、环境凭据注入、私网与重定向检查、超时、文档和响应上限。
- 原插件没有 Client UI，且 API 目录是插件级静态配置。`fde-project` 不挂载该全局目录，而是直接复用锁定包的解析、目录、参数、凭据、重定向和有界请求模块；`openapi_list/describe/call` 每次执行都从 calling Agent cwd 解析注册 Workspace，再读取该项目受信任 API 来源。
- 显式 `.fde/api-docs.json` 保存 `docsUrl`、`openapiSource`、可选 `baseUrl`、允许方法、私网开关、固定 Header 和非秘密凭据环境引用并保持最高优先级；文件缺失时只回退到当前 `running` 记录中由 `project_runtime_report` 提交的来源。默认只允许 `GET/HEAD`，Client 和模型参数都不能临时扩展项目 API 目录。
- `ui-fde-project` 只有在阶段至少为项目开发、项目状态为 `running` 且 API 快照含真实 `openapiSource` 时通过 `conversation.view` 注册“API 文档”。内嵌使用受限 iframe并保留外部打开；停止、阻塞或无 OpenAPI 时不显示该 View，不猜测 `/docs`、端口或最近运行项目。

#### 5.6.1 项目运行、终端与内嵌预览

- `fde-project` 在当前 Workspace 根的 `.fde/project-runtime.json` 保存 `schemaVersion`、revision、operationId、动作、`stopped/starting/running/stopping/blocked` 状态、时间、说明和可选 `previewUrl/docsUrl/openapiSource/baseUrl`。start/stop HTTP 只创建操作；写入采用项目锁和原子替换，旧 operationId 不能覆盖新操作。
- `project_runtime_report` 是 Agent 对当前操作提交事实的唯一工具。它从 calling Session cwd 解析已登记 Workspace，校验 operationId、发起 Session 与迁移；预览只接受不含凭据的 loopback HTTP(S) URL，API 来源只属于同一当前运行记录。启动 `blocked` 保留当前操作身份，因此同一发起 Session 在补齐条件并提交已验证 previewUrl 后可恢复 `running`；停止阻塞、旧 operationId 和跨 Session 报告继续拒绝。
- Client 在项目开发及后续阶段的 `conversation.session.header.utilities` 常驻显示运行状态。点击启动/停止会先开启 Better Sidebar 的 Agent Terminal、Terminal Tab 与 Browser Tab，再向当前 Session 排队可见提示；浏览器不直接执行 Shell，也不启动隐藏后台进程。
- 启动动作先通过 Session conversation service 选择当前 Session 的 `chat` View，再发送提示。提示要求 Agent 先读项目根 `AGENTS.md` 及其引用说明，使用 `terminal_list/create/read/wait_for` 启动和验证，最后报告真实地址；不可运行则报告 `blocked`。无论成功或阻塞，Agent 在调用运行报告后都要在当前对话说明结果和下一步；页头运行状态只提供摘要与恢复动作，不拥有或替换中央内容。Client 对 `starting/stopping` 快速刷新、对启动 `blocked` 低频刷新；首次观察到当前操作进入 `running` 后，通过 Better Sidebar 精确 loopback 白名单自动打开一次 Browser，并让 API 文档 View 使用同一快照重新计算。停止提示只对本项目运行终端发送 `SIGINT` 并等待，不使用宽泛 `pkill/killall`，也不关闭终端标签，因此输出可持续审阅。
- `running` 后 Client 向可信同源的 `/api/fde-project/runtime/preview` 提交 WorkspaceId。Host 只从该项目运行记录读取目标，为项目分配不可预测的 `*.localhost` 主机名与 OS 分配端口，绑定 loopback；Client 授权该精确入口并在当前 Session 的 Browser Tab 打开。页面根路径、相对资源、流式 API 与 WebSocket 使用同一代理；只适配本地响应的嵌入策略、同目标重定向与请求来源，HTML/JS 原件不改写。不同项目不共享来源，工作台凭证不进入预览。每次请求重核运行状态和目标，地址变化或停止后旧入口失效；卸载关闭全部代理连接。
- Better Sidebar 的嵌入预检根据实际父页面与最终目标来源判断明确的 CSP/X-Frame-Options，不再把所有非通配白名单判为禁止。无法完整判定的策略交给浏览器，不伪造成功。平台不代理任意外部站点；绝对硬编码地址、跨站登录及特殊 Cookie 策略不承诺自动兼容，保留直接打开项目原地址。

### 5.7 项目级系统架构

- 固定并复用 `dsh-planchart@e63a6359ed43e6ae35cac505f10a8d128f53eba7`（v0.1.0，MIT）的 framework schema、确定性布局、明暗呈现、缩放、Agent set/get 和 SVG/PNG 导出。
- 不原样安装完整插件：原插件按 Session 保存图形并使用 `shell.overlay` 增加右侧 steps 面板。FDE 适配移除 steps，只保留“系统架构”Conversation View，并把持久身份改为 WorkspaceId。
- `fde-project` 在项目 `.fde/architecture.json` 保存标题、摘要、分组、节点、边、revision 和候选/确认状态，并把被替代版本归档到 `.fde/architecture-history/`。Agent 通过 `architecture_get/set` 读取明确 revision，并以 expectedRevision、带锁原子替换发布完整新候选。
- `ui-fde-project` 在当前 Session 中解析项目身份，但同项目多会话读取同一架构；系统架构与官方 Trajectory、Langfuse Trace、工具调用图和 Agent 隐藏推理保持不同对象。
- `ui-conversation` 对其他 Client Plugin 暴露 scope-addressed View 选择动作。动作只修改目标 Session 的 Conversation View 状态；若 Session UI 尚未挂载则保存一次待应用意图，挂载后写入同一共享 Chat Store。F011 用它实现从候选架构行直接进入完整系统架构页，不通过 DOM 点击或浏览器存储改写绕过 Slot 合同。
- SVG/PNG 从受控结构化图生成，禁止脚本、事件属性和外部资源。确认和导出不推进项目阶段；F005 只把当前明确已确认架构版本作为方案设计阶段门输入，并同时复核 F018 项目 PRD 等五份固定文档。

### 5.8 项目用量分析

- 固定 `dsh-observe@0.2.12`（Apache-2.0），适配当前 Session 事件接口，消费 `session/event`，生成 Turn/Step/Tool/LLM spans、Token/成本指标，支持 Langfuse/OTLP、发送前脱敏、有界 storage-domain 缓冲、重试和运行时状态 Remote。
- Web Profile 默认装载但 `enabled: false`，没有明确后端和启用配置时不采集外发；本项目不读取其他本地项目的 Langfuse 凭据，也不自动部署 Langfuse。
- `ui-fde-project` 以 Workspace `sessionIds` 读取官方 Session 摘要中的 `sessionStats` 和 `tokenUsage`，形成项目本地运行列表；当前 Session Trajectory 保持独立。
- 当前 Bundle 的 `dsh-observe` 为 disabled，且该插件会在注册 Remote 前返回，因此页面明确显示“外部导出未启用”，不猜测后端、队列或缓冲健康。未来启用 Langfuse/OTLP 时再接入真实 Remote 状态。
- 外部详情地址只有由部署配置明确提供且无凭据时才传到 Client；远端状态不能覆盖本地运行事实。

### 5.9 项目评估优化

- 固定 `dsh-eval-harness@2f59376e2a2f22c151f75de446d5cde764dd5aff`。它以 YAML 用例驱动真实 Headless DSH、解析 JSONL/Zstd Session Trace、执行确定性断言、多 Trial/重试、Token 汇总、Baseline 对比和 PASS/WARN/FAIL。package 声明 MIT，仓库根许可缺失在第三方审查中明确记录。
- `ui-fde-project` 通过 `conversation.view` 注册“评估优化”，从当前 Workspace 的 `.fde/evaluations/cases/` 形成 cases_dir，把插件 output、Session、overlay 和工作副本固定到项目 `.runtime/fde-evaluations/<RunId>/`；工具完成后只把 `report.json` 与 `report.md` 发布到 `.fde/evaluations/reports/<RunId>/`。
- 用户必须经过二次费用确认，页面才向当前 Session Agent 提交 `eval_run`；页面加载、项目切换和自动测试不调用模型。固定 runner 未暴露可靠取消，因此页面不显示假取消。
- `fde-project` 只索引当前项目的有界报告，并且只允许把 reports 目录中的有效 JSON 通过带锁原子写入批准为 Baseline；Client 按同名用例只读比较，Candidate 不自动改写 Baseline。
- 候选源码版本与正式阶段证据的绑定由 F005/F006 后续消费；F015 页面自身不推进阶段。

### 5.10 第四阶段条件本体与 Semantica Provider

第四阶段的权威目标仍是选择最小充分机制、形成生产方案并跑通端到端纵向切片；正式本体／知识图谱只是条件路线。所有项目都要定义最小领域语义与数据／接口合同，但只有能力问题确实要求跨来源实体统一、复杂关系、时间有效性、来源追溯、冲突处理或图推理时，才加载 Semantica Provider。

已选定 [`semantica-agi/semantica`](https://github.com/semantica-agi/semantica) 作为该条件路线的本地能力来源；当前评审基线为 `0.6.7 / 3acf8012733e`、MIT。它不替代 FDE 项目、阶段、Artifact、证据或人工决定，也不成为工作台的目录事实源。当前开发机已有的启动脚本、绝对源码路径、匿名 Explorer 和单一演示图谱只属于本地验证环境，不进入产品默认配置。

```text
FDE Workspace 与阶段 2/3 证据
  → 机制必要性判断
  ├─ 不需要正式图谱
  │    → 开发 Spec／合同／NFR
  │    → 最窄纵向切片
  └─ 需要正式图谱
       → 能力问题集
       → 最小 Schema／关系
       → 来源、时间与置信度规则
       → Semantica Provider 分步摄取、构建和验证
       → 受控项目查询
       → 最窄纵向切片
  → 运行证据
  → FDE 人工决定
```

- 产品状态按 WorkspaceId 归属；每个项目拥有隔离的 Provider 工作目录、图、缓存和运行身份，不读取或写入其他项目图谱。
- 定义类对象独立版本化；构建、验证和纵向切片保存为不同的可重复运行记录。每次运行引用输入、Schema、规则、Provider 版本与配置，并保存结构化输出、诊断和适用边界。
- “构建命令成功”“已有节点与边”“Explorer 可打开”“能力问题验证通过”和“FDE 同意进入下一阶段”是不同事实，不能相互代替。
- 本体机制结论使用 `not_required`、`validated`、`validation_failed`、`insufficient_evidence`；FDE 提交后仍然只有 `Go`、`Revise`、`Narrow`、`Stop` 四类决定，未提交时保持无决定并显示等待人工评审。
- Agent 不直接装载整个图谱。项目上下文通过受控查询返回最小必要子图或答案，并携带来源、有效时间、置信度和权限边界；查询能力不得扩大阶段 3 已确认的读取或动作授权。
- Provider 载体仍需用最小 Spike 在 Python API、本地服务 API 与现有 MCP 能力之间验证。选择以完整覆盖本体构建、独立验证、结构化运行证据和项目隔离为准，而不是以调用路径最短为准。

## 6. Agent 组成与上下文

### 6.1 一个项目的会话使用一致 FDE Preset

- 官方 Agent Preset 在 Session 产生内容后不能安全切换；因此 V1 为同一项目的新建会话选择一致的 FDE Preset，不在会话产生内容后按阶段切换。
- 阶段差异通过项目上下文、Skills、工具调用、动态工具限制和当前工作指令表达。
- 需求调研阶段注册内置 `fde-requirement-research` Skill，并在系统 Prompt 中仅注入当前阶段、Skill 名称、三份固定路径和“不得自行推进阶段”的短约束。
- 方案设计阶段注册内置 `fde-solution-design` Skill，以同样的按需加载方式约束项目 PRD 等五份固定文档，并明确项目 PRD 负责产品定义、方案设计负责技术实现；系统架构必须先通过 `architecture_get` 读取，再以精确 revision 调用 `architecture_set`，不直接写 `.fde/architecture.json`。
- 项目开发阶段注册一个内置 `fde-project-development` Skill：借鉴 Spec Kit 的规格先行顺序，但直接维护项目既有 `docs/`，不安装第二套 CLI、不强制分支命名、不增加任务数据库。它约束 PRD → 产品总规格 → Feature Map → Feature spec/plan/tasks → 实施证据 → 三份研发收口产物，并明确未知日期写“待确认”、任务只随真实证据勾选。
- 验证评估阶段注册一个内置 `fde-validation` Skill：生成方案时先读取验收方案、项目 PRD/方案基线、研发基线和现有验证合同，为每项指标登记来源文档与编号，只更新合同和验证计划；FDE 确认当前方案定义摘要后，开始验证提示才引导真实运行、记录问题/复测并更新报告和基线。缺少客户数据、来源或阈值时只登记缺口，不编造通过条件；需要修改已确认指标时先停止并要求重新确认方案。
- 六项阶段 Skill 都只负责产物结构与事实/方案选择/推断/未知项边界，继续复用官方文件与项目工具，不增加独立工作流引擎或阶段推进工具。部署试运行 Skill 禁止 Agent 代替 FDE 接受问题；验收移交 Skill 禁止 Agent 代替企业/FDE 写入验收通过、交付物可取得或责任移交完成。项目进度通过绑定当前合同摘要的人工动作记录这些决定，并且不改写原始证据或对象身份。
- 子任务可使用 SubAgent 或 Workflow，但其结果回到所属项目会话并形成项目级候选事件后，才能成为候选产物或项目事实。

### 6.2 项目基线上下文

- `fde-context` 读取当前项目投影，只在基线版本或阶段发生变化时生成新的模型可见快照，避免每轮重复注入同一大段内容。
- 模型可见快照通过官方可持久路径进入每条 Session Log；其内容至少包含 WorkspaceId、当前阶段、基线版本、当前工作、必要确认、授权来源索引和禁止越权规则。
- 大文件、全部原始资料和历史产物不自动灌入上下文；Agent 通过来源索引和文件工具按需读取。
- Prompt 中必须明确：Agent 产出默认是候选，业务确认与基线提交由 FDE 控制。

### 6.3 即时问题与持久确认

- Agent 在当前 Turn 内缺少信息时，可以复用官方 `ask_user_question`。
- 项目确认清单不是一次性问题 UI；`fde-confirmation` 把问题、来源、影响和后续企业答案作为持久对象。
- 即时问题的答案只有被显式提交为 Confirmation/Baseline Event 后，才进入正式项目事实。

## 7. 普通文件来源能力

### 7.1 为什么不能复用官方图片附件协议

- 官方 Attachment 当前只定义并验证图片，Session Event 保存的是 ImageAttachmentRef。
- PDF、Office、文本、表格、录音和其他客户原件具有不同解析、预览、大小、权限和模型接入语义。
- V1 新增独立 `fde-source` capability，不扩大官方 ImageAttachmentRef 的含义。

### 7.2 能力角色

| 角色 | 责任 |
|---|---|
| Service Definition | 保存、读取、列出、失效和查询处理状态；不绑定本地磁盘或浏览器 |
| Local Provider | 在项目 `fde-resources/` 原子发布原件，维护 `.fde/sources/` 稳定记录并提供同源受控读取 |
| Parser Providers | 使用本地有界转换按格式把原件转为 `.fde/derived/` 中的 Markdown，记录原件/解析器版本与诊断 |
| Agent Consumer | 提供来源目录、读取派生文本、请求解析和引用来源的工具 |
| Host Remote/Upload | 接受受限上传、报告进度和失败；正式二进制上传不塞入普通 JSON RPC |
| Client Plugin | 项目行负责导入；项目详情负责只读清单/状态；共享预览插件同时适配项目详情与 Better Sidebar |

当前 vertical slice 为：Client 以明确 WorkspaceId 导入，Host 保存原件并建立 SourceId；本地解析器生成可追踪派生；同一个只读预览组件服务项目详情与 Better Sidebar。保存、预览和解析都不修改 Composer、不追加 `user/message`、不调用 Agent 或外部模型。上传安全实现继续参考 `dsh-local-file-upload@0.1.4`；解析适配锁定 MIT 的 `@jiaoqsh/dsh-document`；预览锁定 Apache-2.0 的 `@file-viewer/react` 与 Word/Spreadsheet/Presentation 三个按需 Renderer，不复制 AGPL 社区 Office viewer 源码，也不打包无关 Office preset 能力。

### 7.3 V1 验证项

- 文本与图片直接利用官方路径。
- 普通文件验证覆盖项目入口、multipart carrier、默认单文件 25 MiB、批次原子保存、稳定 SourceId、重启恢复、同源文件读取、本地派生和双入口预览。
- Office/PDF/文本/表格的具体支持以生成样本的解析/预览结果为准；OCR 和音频仍不在当前承诺中。

## 8. Web Client 组合

### 8.1 第一版在官方 AppFrame 旁增加右侧 Dock

```text
┌────────────────┬─────────────────────────────┬──────────────────────┐
│ FDE Sidebar    │ Official Conversation       │ Development Dock      │
│ 项目/会话      │ 对话/输入/工具/审批           │ Files/Edit/Git/Review  │
│ 始终保持       │ 持续保持                      │ 可收起                  │
└────────────────┴─────────────────────────────┴──────────────────────┘
```

- 左栏：始终保持 F001 的“项目 → 会话”，开发插件不注册或 shadow `sidebar.workspaces`。
- 中栏：始终保留官方 Conversation、Composer、消息、图片、工具卡片、Approval 和 User Questions。
- 中栏阶段层：空白会话在 Composer 上方只显示当前阶段、行动提示和“查看项目进度”轻量入口；会话产生内容后，头部只显示紧凑当前阶段。完整“项目进度”和真实资料/产物状态属于左侧一级独立页面，不进入 Conversation View。
- 右栏：Better Sidebar 通过会话 Header/Overlay 提供可收起 Dock，Files/Editor、Git、Diff 与 File Review 走同一 Tab 服务；关闭时恢复原左栏＋Conversation 布局。
- 项目资料与阶段产出：Better Sidebar 的公开 `registerFileViewer` 为 DOCX/XLSX/PPTX 注册共享 Office viewer；内置图片/PDF/Markdown/代码能力继续保留。项目进度详情通过 Slot 使用同一预览组件；客户原始资料使用受控 Source URL，需求调研、方案设计和项目开发文档使用 Host 索引的固定 ArtifactId，浏览器不提交任意路径，预览均不加载编辑动作。
- 官方 `details` 继续服务工具详情；后续候选产物/确认/基线详情仍需在 F004 确认独立入口，不把右侧 Dock 当成唯一产品详情面。
- `conversation.view` 的业务页签按当前项目事实逐步开放：对话与轨迹始终可见，系统架构从方案设计开始可见，用量分析从项目开发开始可见，评估优化从验证评估开始可见；API 文档还必须同时满足项目 `running` 且存在真实 OpenAPI。进入后续阶段后保留阶段已开放页签，但运行条件失效时 API 文档立即收起。Chat 保持默认，加载失败时不提前展示后续能力。所有项目级 View 都必须从当前 Session membership 解析 WorkspaceId，不能把 SessionId 当作项目事实身份。
- 品牌 mark 可通过官方品牌 Slot 替换；Hero 标题和完整产品文案若无法通过公开 Slot/locale 配置完成，记录为最小 downstream UI patch，不复制整个 Conversation 实现。

第一阶段已确认采用最小 downstream 品牌补丁：复用 `frontend/public/brand/ff-logo.png` 原始字节；让集中品牌 occupant 在 FDE 发行中始终注册，并替换 Sidebar/Hero Logo 和 Sidebar 名称。品牌 Slot 被占用后 Sidebar fallback 及其提交短 SHA 自然不再渲染，无需修改 Sidebar 壳；Conversation Hero 文案改为 FDE 文案，并在预览文案为空时不渲染徽标。该阶段不改变 Slot、Session、Workspace、Composer 或 Agent 行为。

### 8.2 代码视图边界

- 官方源码没有 Monaco 或完整 VS Code Workbench；LSP 目前主要是 Agent 的只读导航工具。
- 当前锁定 `dsh-better-sidebar@0.19.1` 与 `dsh-file-review-tab@0.5.0`（MIT）。右侧面板由官方 Sidebar 承载，Agent 持久终端从 Better Sidebar 的 bottomSplits 定位；Git Diff 与 Agent Review 保留不同来源语义。当前兼容性依据是本次隔离构建、定向测试和启动记录。
- `@lsq64737/dsh-workbench-layout@0.1.5`、其左侧 Activity Rail patch、Bundle row 和依赖全部移除；被用户否定的页面形态不保留为隐藏备选入口。
- Better Sidebar 复用会话 Header/Overlay，并以固定面板 Host 和布局变量为中央区域让出右侧空间；不 shadow 项目 Sidebar、不重排 Conversation 到另一列，也不占用官方 `details`。
- 默认开发 Dock 只展示 Files/Editor、Git、Diff 与 File Review；Subagent、Side Chat 和底部面板继续禁用。Browser、Terminal 与 Agent Terminal tools 只在 FDE 明确执行“启动项目/停止项目”时开启，服务当前项目运行与预览；这不扩展为通用网页浏览器、任意命令面板、调试器、扩展市场、完整语言诊断或 VS Code Extension Host。
- Office 只读预览由 `@file-viewer/react`＋Word/Spreadsheet/Presentation 按需 Renderer 提供，并显式固定为 `light` 文档主题，避免系统深色偏好造成原件深色文字和单元格内容不可见；工作台外围主题继续独立。Renderer 分发使用存储文件名中的扩展名，不把 `application/vnd...` 或 `text/csv; charset=utf-8` 等 MIME 误作扩展名；Host 响应继续保留 MIME 与字符集。Presentation Renderer 所需的锁定版本 ES module Worker 由 Web 构建复制为同源 `/vendor/pptx/pptx.worker.js`，预览组件不依赖动态 Client bundle 中失真的第三方相对模块地址；该 Worker 只存在于可再生成的 `dist`。PDF 继续使用现有浏览器预览。损坏或不支持格式回退为明确诊断/下载，不把预览失败当作解析失败。
- 文件树订阅当前 Session 的 Conversation snapshot：成功完成 `write/edit` 或 Code Mode 嵌套文件变更后，以 300ms 合并窗口清除文件树缓存并重新读取根目录、已展开目录和当前搜索；流式文本和只读工具不触发刷新，避免轮询与无关重载。
- Agent 直接 `write/edit` 的 Diff 仍由官方工具卡呈现；File Review 按当前会话/轮次聚合标准工具和 Code Mode 变化；Git Diff 表示版本库差异；Shell、外部编辑或会话外变化不得被错误归因给 Agent。

### 8.3 当前官方扩展边界

- 官方 `sidebar.footer.action` 可以追加全局入口，`shell.overlay` 可以提供 root-scoped 页面层；二者不提供完整路由器，F011 需要在插件作用域内管理打开、关闭和项目切换后的恢复。
- 插件增加 `conversation.view` 后不能声明其为新 Session 默认视图；V1 保持 Chat 默认，并不再用 Conversation View 承载完整项目进度。
- `conversation.view` 的作用域是 Session；API 文档和系统架构虽然从该位置打开，权威配置与产物必须按 WorkspaceId 保存并跨同项目会话共享。
- 普通文件、用户 Xterm、完整编辑器和 FDE 领域状态均需新增插件。

### 8.3.1 统一一级导航（F025）

`ui-fde-project` 复用 apply-scoped `ProjectPageController` 管理介绍页、总览、项目中心、项目详情、实验室与技能占位页；导航仅发布页面快照，不写 Host 领域状态。新增 `shell.overlay` 导航项，通过明确的子 Slot 接收实验室页面；实验室插件只消费 active 与返回回调，不运行时导入项目插件。总览的实验室摘要通过独立 Slot 从既有只读案例 API 获取真实数量。已打开 iframe 在切换时隐藏而非卸载，保留训练现场；全局侧栏采用共享宽度为页面让位，进入具体项目仍复用原生项目导航。

### 8.4 工作台界面主题

- F016 新增独立 `@deepseek-ai/dsh-client-ui-fde-appearance` Client 插件，通过 `settings.section` 注册“界面主题”，不修改官方 `ui-theme` 的浅色、深色和跟随系统偏好，也不进入 Host Profile 的项目领域。
- 插件在 apply 作用域创建一个可观察外观控制器。控制器从固定浏览器存储键加载完整选择，通过 `ctx.theme.overrideTokens('fde-appearance', ...)` 叠加成对明暗语义 Token，并在 `body[data-fde-skin='active']` 上应用背景；卸载、选择 `official` 或失败回退会完整撤销自身 DOM 和 Token 写入。
- AppFrame 与 SidebarRoot 都消费侧栏填充 Token；F016 使用较轻的明暗成对透明度，并通过 Slot 系统稳定的 `[data-slot='sidebar']` 地址移除 SidebarRoot 的重复填充、增加背景模糊。AppFrame 保留一层可读侧栏表面和边界，背景因此覆盖主内容和左侧项目导航，而不修改官方 Layout/Sidebar 包。
- 侧栏模糊会建立 fixed 包含块，因此 `ui-settings-general` 只把触发器留在 `sidebar.settings`，打开后的设置面板通过 React Portal 进入 `document.body`。该层级修正保持设置导航、焦点与关闭合同不变，并保证主题启用时蒙层和双栏面板仍按完整视口计算。
- 六套稳定选项为 `official`、`whale-maid`、`cloud-cat`、`jiutian-deep-space`、`jiutian-quantum-glass` 和 `jiutian-dawn-horizon`。五张背景从用户明确指定的 Studio Web 资源机械复制到 `apps/web/public/fde-themes/`，保留 1920×1080 WebP 字节；Studio 只提供资源和交互事实，不成为本项目架构基线。
- 自定义图片只接受 PNG、JPEG、WebP 和 16 MiB 以内原图，在浏览器 Canvas 中 cover 裁切为 1920×1080 WebP，并提取四个配色值。控制器先生成并验证完整持久值，再一次性写入 `localStorage`；配额、编码或解析失败不清除旧值、不改变当前 DOM，也不发起网络、RPC、Session 或 Agent 调用。
- `settings.section` 组件只通过注入的框架绑定观察控制器；预览、文件 Object URL 和滑杆草稿留在组件本地。保存成功后由控制器发布不可变快照，设置页和全局 DOM 使用同一已提交值。

## 9. 工程执行、验证与部署

- 工程执行优先复用官方 FS、Shell、Jobs、Terminal、LSP、Skills、MCP、SubAgent 和 Workflow。
- `fde-execution` 只记录项目语义和版本关联，不复制官方工具执行实现。
- 评估由项目确定的测试/Eval 命令或插件产生；结果必须关联候选系统版本、评估集、环境和原始日志。
- 部署由受控工具或适配器执行，明确目标环境、权限、开始/结束、输出、健康检查和回退证据。
- V1 没有通用云部署平台；没有真实部署适配器时只能停留在验证阶段，不能生成假 URL 或上线成功。
- Trajectory 和 Tool Events 用于执行证据，FDE Validation View 只投影与项目门槛有关的结果。

## 10. 安全与运行边界

- V1 采用官方本地 Web/loopback 安全姿态；不把 Web Host 暴露到公网，不在无认证的 LAN 上扩大权限。
- 默认使用 Workspace Write＋Ask 类权限组合；用户明确切换完全访问时沿用官方风险确认。
- FDE Plugins 不直接读取凭据值；凭据通过官方 Credentials/Authorization 能力按执行需要注入。
- 文件上传、解析、命令、网络和部署分别设置独立大小、时间、权限与取消边界。
- 原始来源和项目文件归属当前 Workspace；任何跨项目/跨客户读取在 V1 中拒绝。
- 浏览器状态不得承载项目、阶段、来源或交付的权威事实；刷新、断线和 Host 重启后这些事实从 Session Events、项目文件和官方持久化恢复。F016 界面主题是明确的非项目个人偏好，可在固定 Origin 的浏览器本地保存，且不得进入项目或 Agent 数据链。

## 11. 上游管理与发行策略

### 11.1 推荐仓库形态

- 使用固定官方提交的薄分叉或受控发行层，配置 `upstream` 指向官方仓库。
- 所有 FDE 行为放入独立 Host/Client packages 和一个 FDE Bundle/Profile。
- 不在官方包内混入产品领域代码；确需修改的 UI 扩展点使用单独、可审查的最小补丁。
- 正式决定采用 monorepo 薄分叉还是外置插件发行前，先完成官方 Web vertical spike；两种方式不得同时成为维护源。

### 11.2 升级纪律

- 每次升级先记录上游旧/新提交与兼容范围。
- 对 Session Event、Projection、Remote API、UI Slot、Bundle/Profile 和 Web Snapshot 建立兼容验证。
- 不自动合并 master，不依赖未发布讨论中的扩展点。
- 上游已实现相同能力时删除本地补丁，不能同时维护两套语义。

## 12. 官方 Web 适配验证顺序

用户下一步启动官方 `dsh web` 后，按以下顺序只做验证，不直接展开完整产品：

1. 记录官方提交、Node/pnpm 版本、启动命令、实际 Profile 配置和页面基线。
2. 验证 Workspace 创建/选择、空白 Session、文字输入、图片输入、重启恢复和权限审批。
3. 安装一个最小 FDE Client Plugin，证明品牌 Slot、Sidebar 替换、Details/Conversation View 扩展和 HMR/重启行为。
4. 增加一个最小 `fde/project-created` Event＋Projection，证明持久化、重放和 UI 恢复。
5. 完成普通文件 Source vertical spike，证明上传、原件保存、处理失败、重启恢复和 Agent 按需读取。
6. 再根据真实页面与能力证据更新 Product Prototype、Feature Map 和对应 Feature Spec。

任一步失败都先记录官方扩展缺口和最小替代方案，不通过复制既有分叉代码或静默修改 Agent Loop 绕过。

## 13. 技术选择

| 层级 | 方案与版本 | 用途 | 选择理由 |
|---|---|---|---|
| Agent/Host 基座 | 官方 `deepseek-ai/deepseek-harness`；开发前固定提交 | Agent、Session、Workspace、工具、权限、执行和 Web Host | 官方插件体系覆盖核心 Agent 工程能力，避免自研执行内核 |
| Web 基座 | 官方 React/Vite Client Runtime＋UI Slots | 对话、三栏布局、动态 Client Plugins | 可保留成熟对话与工具界面，并按 Slot 替换 FDE 表面 |
| 项目持久状态 | 官方 Session Log＋自定义 `fde/*` Events/Projection | 项目阶段、来源引用、候选、确认、基线和交付 | 与对话同一可重放事件源，满足模型可见即可重建 |
| 当前阶段读模型 | 官方 `storage-domain`＋`fde_stage` Workspace 表 | F010 六阶段进度、跨 Session 读取、六个连续人工放行、单步人工返回和 `completed` 重开 | 项目级事实不依赖某条 Session；推进和返回都校验 revision，返回目标由 Host 固定计算并记录原因/历史，不删除项目产物 |
| 项目进度页面 | `sidebar.footer.action`＋`shell.overlay` 完整页面状态＋F001/F010/F002/F004/F006/F007/F020/F023 数据 | 多项目阶段/周期、六阶段输入/输出/证据/阻塞、docs/Feature/任务证据、FDE 人工放行、进入项目交付 | Slot 只作为挂载点；真实文件与状态由 Host 读取，不透出底层会话或开发 Dock，不引入或反写第二套任务/验证/部署状态 |
| 需求调研规范 | 官方 System Prompt、Skill Registry 与 Workspace FS | 引导 Agent 按固定路径更新三份候选产物 | 保持同一 Preset 和 Agent Loop；文档生成与阶段决策分离，最终推进只由 FDE 操作 |
| 方案设计规范 | 官方 System Prompt、Skill Registry、Workspace FS 与 FDE 架构工具 | 引导 Agent 按固定路径更新项目 PRD 等五份候选文档并维护项目级候选架构 | 不增加工作流引擎；项目 PRD 与技术方案分工；架构确认和阶段推进分离，只有 FDE 人工门可进入项目开发 |
| 项目开发规范 | 官方 System Prompt、Skill Registry、Workspace FS 与 `fde-project` docs 索引 | 引导 Agent 维护唯一标准 docs、Feature 规格/计划/任务证据与三份研发收口产物 | 借鉴 Spec Kit 规格先行但不引入第二套 CLI/任务库；页面只读，只有 FDE 人工门可进入验证评估 |
| 验证评估规范 | 官方 System Prompt、Skill Registry、Workspace FS、Session Prompt、F015 Eval 与 `fde-project` 验证索引 | 从前阶段文档生成带来源方案，绑定方案定义摘要由 FDE 确认后才开始验证；组织候选版本、项目适用输入、指标/阈值、真实证据和三份验证产物 | 复用既有固定用例执行器，不另建数据集/指标平台；方案定义变化使确认失效，结果写回不使确认失效，只有 FDE 人工门可进入部署试运行 |
| 部署试运行规范 | 官方 System Prompt、Skill Registry、Workspace FS、`.fde/deployment-trial.json` 与 `fde-project` 投影 | 引导 Agent 在明确授权下维护候选版本、目标环境、五类证据、问题决定和四份试运行产物 | 不内置通用部署执行器、不读取凭据、不把本地启动或 HTTP 200 当成阶段完成，只有 FDE 人工门可进入验收移交 |
| 验收移交规范 | 官方 System Prompt、Skill Registry、Workspace FS、`.fde/acceptance-handover.json` 与 `fde-project` 投影 | 统一最终版本、交付物、企业验收、条件项、培训与权限/运维责任，并形成四份移交产物 | V1 由 FDE 代录企业确认；不建客户账号/签章/制品仓库，只有 FDE 人工门可完成项目 |
| 项目运行与内嵌预览 | `fde-project` 运行操作/报告＋当前 Session Agent＋Better Sidebar Terminal/Browser | 项目开发阶段的启动、日志、内嵌页面、停止与阻塞恢复 | Agent 读取项目 `AGENTS.md`，避免自建技术栈配置器或隐藏进程管理；终端可见、地址精确、停止保留证据 |
| API 文档与 Agent 接口能力 | `dsh-openapi@fb854355…`＋FDE Workspace 作用域适配＋运行事实＋`conversation.view` | 当前运行项目的真实 API 文档、OpenAPI 搜索/描述/受控调用 | 直接复用成熟解析与安全边界，同时补齐项目隔离和可视化；只有 `running + openapiSource` 开放，默认只读 |
| 系统架构 | `dsh-planchart@e63a635…` framework 能力＋FDE Workspace 级版本存储 | 方案设计架构、自然语言更新、确认、SVG/PNG 导出 | 自动布局和导出已经存在；去掉 Session/steps 语义后更符合项目级 FDE 产物，第一版不引入重型手动画布 |
| 项目用量分析 | `dsh-observe@64791ff…`＋官方 Workspace/Session/Stats＋FDE View | 多会话运行汇总、Token/成本/错误、可选 Langfuse/OTLP | 精确支持当前 rc.2，119 项测试、先脱敏、有界缓冲和失败隔离；默认关闭外发 |
| 项目评估优化 | `dsh-eval-harness@2f59376…`＋FDE Workspace/候选版本守卫＋报告 View | YAML 用例、真实 Headless Trial、Trace 断言、Baseline 与 PASS/WARN/FAIL | DSH 原生、关注度较高，避免每项目重写 runner；补齐路径、版本、许可和 UI 边界 |
| 条件本体／知识图谱 | `semantica-agi/semantica@3acf8012733e`（`0.6.7`、MIT）＋项目级 FDE Host Provider | 按机制必要性完成本体、图谱、来源／时间规则、验证和受控查询 | 复用完整语义能力但保持 Workspace 隔离、分步运行证据和 FDE 状态权威；非图谱方案不加载或创建占位对象 |
| 工作台界面主题 | 官方 `ui-theme` ThemeRuntime＋独立 `ui-fde-appearance`＋Studio 固定 WebP 资源 | 六套内置皮肤、自定义背景、焦点/玻璃层和浏览器本地恢复 | 保留官方明暗主题与插件生命周期，复用用户已有皮肤资源，不引入 Electron bridge、Host 存储或新的 UI 框架 |
| 项目文件 | 官方 Workspace/FS＋项目 `fde-resources/`/`.fde/sources`/`.fde/derived` | 客户原件、稳定来源身份、本地派生、工程产物和交付文件 | 原件只保存一份并对两个入口可见；派生可再生成且不覆盖原件 |
| 图片 | 官方 Attachment Store | 对话图片与持久引用 | 官方已有内容寻址、限制、恢复和模型适配 |
| 普通文件 | `fde-source`＋`@jiaoqsh/dsh-document`＋`@file-viewer/react`/三个 Office Renderer | PDF、Office、文本、表格等原件、识别和只读预览 | 官方未支持通用附件；以独立 Host/Client 能力实现，按需打包且不自动接入 Agent |
| 代码视图 | `dsh-better-sidebar@0.19.1`＋`dsh-file-review-tab@0.5.0` | 右侧 Files/Editor/Git/Agent Review Dock | 保持左侧项目导航和中央对话稳定；插件可移除、可扩展，当前组合已验证隔离加载，不承诺完整 VS Code |
| 评估/部署 | 官方工具执行＋FDE 记录/门槛插件 | Evals、测试、健康检查、部署和回退证据 | 复用执行层，新增 FDE 产品语义 |

## 14. 服务与目录边界

- `frontend/`：保留 FF 品牌原件；当前实际 Client Plugins 位于锁定 Harness checkout 的 `packages/client/`，F016 固定主题资源位于 `apps/web/public/fde-themes/`，后续发行形态稳定后再迁移。
- `backend/`：当前 `fde-source` 与 `fde-project` Host Plugins 位于锁定 Harness checkout 的 `packages/fde/`；其余 FDE 领域插件仍按后续 Feature 增加。
- 根目录跨服务文件：正式选择官方源码集成方式后再定义；当前不创建 Workspace、Compose、CI 或依赖清单。
- `docs/`：继续作为 FDE 产品规格源，不存放下载的 Harness 源码、构建产物或运行数据。

## 15. 请求、数据与运行链

```text
Browser gesture
  → FDE Client Plugin
  → official Remote/API carrier
  → FDE Host Service
  → durable file and/or Session Event commit
  → Session Projection / Host change
  → Browser state update

Project message
  → official Session prompt
  → FDE project context snapshot
  → Agent Loop
  → official Tools/Skills/MCP/FS/Shell
  → durable tool/session events
  → candidate FDE artifact/confirmation
  → FDE confirmation
  → baseline commit
  → stage gate evaluation

Start project
  → project header creates Workspace operationId
  → current Session receives visible start prompt
  → Agent reads AGENTS.md
  → Better Sidebar persistent terminal starts and verifies service
  → project_runtime_report validates current operationId
  → .fde/project-runtime.json atomically becomes running or blocked
  → exact loopback Browser preview and optional API View update

Stop project
  → project header creates stopping operationId
  → Agent signals only the project terminal and waits
  → project_runtime_report commits stopped or a truthful failure
  → preview/API View close while terminal output remains
```

## 16. 外部服务与安全边界

- 工作台局域网入口：用户显式使用 `--lan` 时，Web 启动器绑定 `0.0.0.0`，由现有 WebRuntime 为 RPC/WebSocket 推导本机 IPv4 信任地址。FDE 项目、阶段、资料、Semantica 和用量接口复用 Connection 的 `createWebRequestTrust`，只接受实际监听端口上的本机 IP，并保留 Host/Origin/Fetch-Metadata 校验。默认仍为回环地址；设置与凭据 RPC 的本机限制不变。此模式不提供身份认证或多人权限隔离，不适合公网部署；没有扩大独立项目预览的监听范围。

- DeepSeek 或其他模型服务：由官方 LLM/Credentials capability 管理；密钥不进入本项目文档或源码。
- 企业系统、MCP、部署平台：必须作为项目级明确授权能力接入，不因安装工作台自动获得权限。
- 项目预览：只允许当前 Agent 验证并报告的不含凭据的 loopback HTTP(S) 地址，并按精确 host:port 放行；不得扩大到所有 localhost 端口、局域网或任意外部 URL。
- 官方 GitHub 仓库：只用于固定源码与升级；不在运行时下载任意 master 代码。
- 普通文件解析器：每种解析器声明支持 MIME、资源上限、输出、失败和安全边界；未验证前不纳入产品承诺。
- 浏览器自定义背景：只在当前 Origin 本地处理和保存，不进入 Host、模型、观测后端或项目目录；浏览器清理站点数据会清除该个人偏好。

## 17. 待验证与确认

### 第五阶段开发与验证承接（2026-09-07）

第五阶段沿用 DSH 的当前 Workspace、Session、文件与终端工具执行客户项目开发；FDE 项目插件只解析 `.fde/stages/evaluation.json` 的版本与测试记录并生成快照。只读 `project_evaluation_get` 返回候选文件、环境和指标定义的当前指纹，执行与结果记录仍在 DSH 中完成。阶段门重新检查同一投影，不以页面状态、文件计数或项目运行成功放行。候选指纹覆盖显式文件清单，不进行客户目录全扫描。

客户端使用第五阶段信息工作台，复用页头的运行操作和同一快照；验证操作先预填原生输入框，开发完全留在既有 Agent 对话，不增加任务看板。现有系统架构、Agent Trial、项目预览和终端入口保留；不建立第二套开发或评估执行引擎，也不改写旧 V1 验证合同。用户未提交开发请求时不会操作客户项目。

- [x] 实际官方提交与可重复启动命令。证据：`docs/verification/2026-08-26-official-harness-baseline.md`。
- [ ] Better Sidebar 右侧 Dock、File Review Tab 与当前 FDE 项目/会话的运行验证；构建通过不代替用户布局验收。
- [ ] FDE Event/Projection 在刷新和 Host 重启后的重放。
- [x] 普通文件当前存储切片的 multipart carrier、默认限制、Workspace 定位和批次发布。证据：`docs/verification/2026-08-26-f002-project-resource-intake.md`。
- [x] F011～F015 技术组合、聚焦测试、公开插件无模型测试、完整构建、3080 启动与数据分析项目快照；页面产品效果仍待用户人工验收。
- [x] F016 六套皮肤、自定义背景、明暗模式独立、刷新恢复、失败保留旧主题、左侧项目栏适配和设置弹窗文档级 Portal 已完成代码、聚焦测试、目标构建与 Boot HTTP 检查；修复后视觉效果待用户人工复验。
- [x] 当前 SourceId、历史原件补索引、同源读取、项目详情/Better Sidebar 双入口预览和本地解析已实现并验证；权限/有效性、OCR、版本/删除、Agent 引用和最终格式支持矩阵仍待后续确认。
- [ ] FDE 项目上下文进入 Agent 的日志可重建性与 token 成本。
- [ ] Better Sidebar 与官方 Workspace FS/权限之间的保存、Git Diff、File Review、项目/会话切换行为；本阶段完成构建后交由用户人工验证。
- [ ] Evals、部署和交付包在第一个真实项目类型中的最小闭环。
- [ ] Semantica Provider 的载体 Spike、固定配置、逐项目隔离、构建／验证分离、受控 Agent 查询和双路线纵向切片。

以上项目完成前，本文保持 `status: draft`，不得把源码可编译或 UI 可展示误报为架构确认。

## 2026-09-07 阶段六至八工作台实施

阶段定位只有实际项目生命周期与只读浏览选择：侧栏和正文使用显式浏览阶段，否则跟随当前项目阶段。返回当前阶段只清除浏览选择。第八阶段从已持久化 improvementCycles 和 lastReviewedAt 显示已完成轮数与最近评审；不读取独立演示快照、不注册演示开关。

用户授权的数据联调写入当前验证项目的 .fde/stages 和小体积来源记录，逐次调用 /api/fde-stage/v2/complete，继续遵循原有证据校验、阶段与 revision 冲突检查。操作前四份阶段记录留在项目 docs/verification 中用于恢复；阶段表只由现有服务写入，未改全局门槛。联调输入不代表生产操作或客户签收。

`fde/project/src/delivery-workbench.ts` 在已有 Workspace 快照中只读解析阶段文件 delivery 字段；版本清单与证据通过实际项目内文件及 SHA-256 核验，128 个不同文件、单文件 8 MiB、总量 32 MiB 上限。固定类别区别试点、生产交接与持续改进；状态声明和有效状态分开，必备类别、版本与范围不符阻止原阶段门。旧六阶段读取路径不变。未登记 delivery 的旧 V2 记录保留产物访问，但必须补齐专用事实才能按新规则评审。

`DeliveryStagePanel.tsx` 复用现有快照、阶段选择和文件预览 callback，纯 props 接入，不新增服务、不修改 Agent Loop。三种页签布局共享版本、证据详情与人工阶段门；未来／历史只读，短视口复用第五阶段已预留输入框的滚动布局。详情使用右侧原生 dialog，键盘关闭与焦点恢复由浏览器处理。没有部署、实时观测或生产语义查询的假按钮。

设计决定与代价：采用文件证据投影而非自动生产执行，当前即可复用 Agent 已产出的事实并保持项目隔离，但真实性与批准身份仍需有权 FDE 核对；文件摘要只证明文件一致，不证明报告内容真实。拒绝把本地运行映射成生产在线，也不强制所有项目接入企业系统或本体。简单项目可有依据地标记集成不适用。

Semantica 后续执行需分离编制／验证与发布／查询。当前第四阶段 createAgentContext 会更新上下文并使切片失效，不能复用作生产查询；本轮只展示实际 snapshot/runtime 接入声明与来源，未实现独立生产查询 Provider。知识图谱的业务关系不能直接作为代码影响依赖。运行时、发布和跨客户复用执行器仍为后续独立授权范围。

阶段四、五共用 `semantic_workspace` 准备操作和 `semantic_context_query` 只读消费；前者复用工作台 Provider，不暴露候选审核、Schema 发布或 FDE 决定。消费要求绑定来源版本、当前约束验证回执和实际 SDK 版本有效，结果不写入编制状态。Python 解释器与源码路径通过隔离 `DSH_HOME/.env` 交给现有 Loader；不添加自动发现、全局安装或案例配置。独立客户生产服务、向量检索和 Semantica 原生 AgentContext 仍未启用，现有查询由受控适配器执行。

## 通用性整改：数据读取与执行边界

阶段投影按 Workspace 根目录检查固定文件、证据摘要及 dataProvenance；这些检查不等于实际执行认证。旧生命周期读操作不迁移数据，状态写入按版本拒绝交叉。Semantica 的 queryAgentContext 仅返回上下文，由 Harness 工具结果保留调用轨迹，不写编制状态；createAgentContext 是显式编制验证操作。Python Adapter 在 SDK 结构检查之外执行项目身份、字段、关系约束；查询先排除不满足绑定来源、已声明时间与分数的节点和边，再遍历。自由文字规则与 permissionScope 不构成授权策略引擎。

源码不为案例设置默认实体、指标、负责人或行业 Schema；随仓库项目材料仍由显式加载器导入。既有联调记录不被改写，历史阶段不自动回退。完整机器执行回执与外部人工签收认证仍需后续接入；不能将本轮完整性修复宣称为这些能力已完成。

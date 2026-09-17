# AGENTS.md

> `FF - FDE 交付工作台`：供 FDE 从业者长期使用，以一个真实项目为单位，从空白需求输入持续推进到最终验收移交的专业交付工作台。

## 项目定位

- 项目根目录名：`FDEDeliveryWorkbench`
- 对外产品名：`FF - FDE 交付工作台`
- 内部工程标识：`FDEDeliveryWorkbench`
- 目标用户与场景：FDE 从业者在一个真实企业 AI 项目中持续发现高价值问题，定义结果、范围与责任，调查真实环境，完成方案和纵向切片，运行 PoC 与 Eval，推进企业集成与受控 Pilot，进入生产并验收交接，最后依据现场证据持续改进；学员只是课程阶段身份，不是产品角色。
- P0 核心旅程：产品介绍首页 → 工作台总览 → 从项目中心创建或选择项目 → 进入当前阶段的项目工作台 → 通过自然语言和客户资料补齐事实 → Agent 调用当前阶段能力并形成候选产物与证据 → FDE 审阅、补充和人工决定 → 推进或返回阶段，直至完成生产交付与能力沉淀。平台侧栏提供总览、项目中心、实验室和技能中心；实验室独立于项目，技能中心区分第一阶段七个“平台内置”方法与用户明确提供的“课程原版”，只读阅读与下载，不安装或执行。课程原版收录不改变 Agent 注册，维护源与平台适配版不互相覆盖。
- 当前范围：V2 以项目为真实交付单元，以八阶段表达项目责任变化，并在锁定的官方 DeepSeek Harness Web 上逐阶段适配；未显式迁移的 V1 六阶段项目、会话、文件和状态继续受保护。
- 明确不做：客户管理、跨项目资源调度、经营统计、教学角色、团队协作、资产复用、需求市场、商业流程和完整 VS Code Workbench。

## 品牌与产品语言

- 用户可见名称逐字使用 `FF - FDE 交付工作台`；内部工程名、缩写和临时代号不得进入界面。
- Logo 唯一来源：`frontend/public/brand/ff-logo.png`；原始文件为 PNG、RGB、300×300，SHA-256 为 `522944bbaee48d98190c8c5a0a0ac80f05b71b1975838807742a782e2aeceedc`。
- Logo 源文件不得覆盖、重绘、反色、改色、裁切或拉伸；界面中的两处品牌 Logo 使用同一原图并统一呈现为小圆角，不添加发光、渐变、旋转等装饰效果，明暗主题使用同一原图。
- 全局导航或页头必须把 Logo 放在完整产品名左侧，保持比例并提供 `FF - FDE 交付工作台 Logo` 无障碍文本；不得使用菜单图标或临时字母图形替代。
- 凡出现版权、脚注或研发署名，逐字使用 `@赋范空间 独家研发`。
- 所有可滚动页面应在内容末尾提供统一脚注；固定高度工作台可将脚注放入侧栏或应用壳底部，但不得遮挡核心操作。
- 不默认在产品页头展示“演示模式”“Mock”“测试版”等内部研发阶段标签；确有用户告知义务时，必须由产品规格明确其位置与文案。
- 使用用户任务、业务对象、动作和可观察状态命名；避免“驾驶舱、宇宙、中枢、大脑、魔法”等包装词。
- 多项目创建、选择和管理页面使用“项目中心”；单项目当前阶段的默认主操作面使用“项目工作台”，执行对话使用“Agent 对话”，一次执行过程使用“运行轨迹”。不得用“Dashboard”“驾驶舱”“控制面”“执行面”替代这些业务名称。
- 单项目中的接口说明页面使用“API 文档”，方案产物页面使用“系统架构”；“系统架构”不得与运行轨迹、调用链或 Trace 混为同一对象。
- 单项目中的跨会话运行与资源汇总页面使用“用量分析”，数据集、指标、真实验证与回归结果页面使用“评估优化”；“运行轨迹”只解释一条 Session，“用量分析”汇总同项目运行和 Token 等资源使用，“评估优化”给出版本化验证结论与改进依据，三者不得混称。

## 目录与架构边界

- 项目根目录名使用大驼峰（PascalCase），只包含英文字母和数字并以大写字母开头；例如 `AgenticRAG`、`OcrPlatform`。

```text
FDEDeliveryWorkbench/
├── frontend/  # 前端源码、测试、静态资源和专属配置
│   └── public/brand/ff-logo.png  # Skill 内置 FF Logo，不得修改
├── backend/   # 后端、Agent/LLM、数据、测试和专属配置
├── upstream/
│   ├── deepseek-harness.lock.json  # 官方源码版本、提交与 checkout 位置
│   └── deepseek-harness/  # 与产品资产同仓管理、保留上游历史的官方源码与 FDE 扩展
├── .runtime/  # 主工作树的 DSH_HOME 与本地运行状态，均被 Git 忽略
├── docs/      # PRD、Product Spec、Feature 规格、架构和验证证据
├── README.md
├── AGENTS.md
└── CLAUDE.md
```

- 根目录只保留项目级文档和真实跨服务编排文件。
- 前端专属内容不得散落到 `frontend/` 外；后端、Agent、LLM 和数据服务专属内容不得散落到 `backend/` 外。
- `FDEDeliveryWorkbench/` 根目录是唯一 canonical Git 仓库；`docs/`、根文档、产品资产与 `upstream/deepseek-harness/` 源码由同一仓库、分支和 worktree 管理。
- `upstream/deepseek-harness/` 承载官方源码与当前 FDE 扩展；`upstream/deepseek-harness.lock.json` 记录当前和上一官方基线，不表示该目录可以直接覆盖或重建。
- FDE 行为优先放入独立 Host/Client Plugins 与 FDE Bundle/Profile；不修改官方 Agent Loop，只有运行证明确认不存在公共扩展点时才维护最小补丁。
- 不为目录整齐凭空添加 workspace、Compose、CI、数据库或部署设施。

## 文档职责

- `docs/PRD.md`：唯一产品级需求事实源，记录用户价值、范围、稳定需求 ID 和 Given/When/Then 验收。
- `docs/specs/product-spec.md`：唯一项目级总行为合同，记录跨 Feature 对象、状态、不变量、共享交互、安全恢复和兼容规则。
- `docs/specs/feature-map.md`：已确认 Feature 边界、需求/PSC 归属、优先级和依赖的唯一事实源。
- `docs/specs/FNNN-<slug>/spec.md`：单个 Feature 的行为、状态、边界和验收。
- `docs/specs/FNNN-<slug>/plan.md`：该 Feature 的实现方案、影响范围、顺序、风险和回退。
- `docs/specs/FNNN-<slug>/tasks.md`：可独立验证的任务、依赖、完成证据和验证方法。
- `docs/architecture/architecture.md`：框架、依赖、数据、服务边界和技术决策。
- `docs/verification/`：记录真实命令、退出状态、可观察结果和未验证项。

## 技术基线与真实命令

- 独立业务挖掘实验室位于 `packages/fde/discovery-lab` 与 `packages/client/ui-fde-discovery-lab`；其素材导入与训练数据边界见[包说明](upstream/deepseek-harness/packages/fde/discovery-lab/README.zh.md)。不要把 `DSH_HOME/fde-discovery-lab` 当作可重建素材缓存，也不要将训练轮次登记为项目或阶段。

- 前端：锁定官方 DeepSeek Harness `0.1.6-alpha.1` 的 React/Vite Web Client、拆分后的 Session/Workspace Controllers、Store 与 UI Slots；FDE UI 以独立 Client Plugins 适配。
- 后端：锁定官方 DeepSeek Harness Cordis/TypeScript Host，复用 Workspace、Session、Agent Loop、Tools、FS、Shell、Terminal、LSP、Approval 和 Web API；FDE 领域以 Host Plugins 扩展。
- 数据与模型：Workspace 负责项目文件，主 Session 与自定义 `fde/*` Events/Projection 负责项目事件和状态；图片复用官方 Attachment，普通文件由待开发的 FDE Source capability 负责；模型通过官方 LLM/Credentials 配置。
- 安装：从当前根仓库或 Feature worktree 进入其 `upstream/deepseek-harness/`，执行 `corepack pnpm install --frozen-lockfile`。
- 构建：从当前根仓库或 Feature worktree 进入其 `upstream/deepseek-harness/`，执行 `corepack pnpm run build`；依赖和构建产物只留在该 worktree。
- 启动：在当前根仓库或 Feature worktree 的 `upstream/deepseek-harness/` 中，必须显式执行 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port <该 worktree 的独立端口>`；主工作树默认使用 3080。不得省略 `DSH_HOME` 或使用相对当前 checkout 的 `.runtime/dsh-home`，否则会误读全局或其他 worktree。完整证据见 `docs/verification/2026-08-26-official-harness-baseline.md` 与 `docs/verification/2026-08-27-f022-project-runtime-preview.md`。
- **隔离启动是硬性门禁。** 禁止直接执行 `pnpm dsh web`、`corepack pnpm dsh web` 或任何未显式携带上述 `DSH_HOME` 的等价命令；如果误启动，必须立即停止错误进程，不能让用户刷新或继续操作，也不能通过修改、删除全局 Workspace 数据来补救。
- 修改 `packages/client/**/src/` 后，重启前必须先执行对应 Client 包的 `bundle`（例如 `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`）；仅重启 Host 不会自动更新已构建的浏览器 Bundle。
- 重启后的最小验证同时包含三项：`3080` 返回 HTTP 200；监听进程使用项目隔离的 `DSH_HOME`；`.runtime/dsh-home/storages/workspace.json` 只含隔离区登记的 Workspace。涉及前端改动时，还必须从首页 Boot Manifest 读取实际 Client Bundle URL，并确认该在线 Bundle 已包含本轮新行为、且不再包含应删除的旧文案。HTTP 200 本身不代表新代码或正确工作区已加载。
- 当前官方 Web：http://127.0.0.1:3080；未配置模型时只验证官方界面与无密钥能力，不调用计费服务。
- 用户明确要求局域网访问时，在同一隔离运行区使用 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --lan --port 3080`，同时验证本机和实际局域网 IP 上的页面、FDE 数据接口与 WebSocket；不得开放其他 worktree 或擅自做公网映射。详见 README 的局域网访问说明。

## 官方基座维护

- 当前标签与提交见 `upstream/deepseek-harness.lock.json`，本次升级与下一次操作见 `docs/architecture/harness-016-upgrade.md`。
- 官方根树映射在子目录中，升级使用旧官方树、当前下游树和新官方树做三方合并，不直接覆盖目录或执行 `git pull upstream master`。
- 当前使用 `pnpm@10.34.5`，避开本组合已复现的 pnpm 11 peer 解析异常。完整构建中的 `build:fde-integrations` 从固定 Git 插件源码生成评估入口，并支持 `session.vN.jsonl[.zstd]`；生成的 lib 不提交。
- 首次升级先用隔离副本验证官方 Session 逐代迁移；保留旧格式原件。代码回退不会自动撤销新版本会话写入，回退时必须同时选回升级前的数据副本。

## 单阶段开发与文档同步

- **禁止一次性铺开全部阶段。** 只处理用户当前点名并说明开发方式的一个阶段或 Feature；不得预生成后续阶段的完整 Spec、Plan、Tasks、代码或测试。
- 每个阶段固定执行：`用户说明并确认当前阶段 → 更新必要文档 → 开发授权范围 → 联调与调试 → 记录验证证据 → 同步受影响文档 → 停止等待下一条指令`。
- **采用人工优先的协同验收。** 当前阶段实现完成后，只运行能证明改动可构建或直接行为成立的最窄、最快检查；保持本地页面可访问，随后立即汇报改动与待人工确认项，由用户第一时间手动验收。
- 未经用户明确要求，不运行整套浏览器回放、全量 Web E2E、自动截图/视觉对比、录屏或其他耗时的 UI 自动化验收；不得为了“更放心”重复已经通过的检查。需要新增此类验证时，先说明必要性并等待用户授权。
- **默认不主动打开浏览器做 UI 自审。** 完成代码、最窄测试和必要构建后，只启动正确的本地服务、确认服务可访问并把地址交给用户；不得自行启动 Playwright、Chromium 或其他浏览器去点击页面、截图和逐项核对。只有用户明确要求自动化审查时才执行。
- 用户手动验收尚未返回时，可以如实标记为“实现完成，待人工确认”，不得用自动截图替代用户的产品判断，也不得因此继续扩展当前阶段。
- 开发前只创建或更新当前阶段真正需要的文档：产品范围/验收变化先更新 `docs/PRD.md`；跨 Feature 对象、状态或不变量变化先更新 `docs/specs/product-spec.md`；Feature 边界变化更新 `docs/specs/feature-map.md`；当前 Feature 的行为、方案和任务分别进入其 `spec.md`、`plan.md`、`tasks.md`。
- 技术选型、DeepSeek Harness 能力映射、插件边界、数据流或运行方式变化时，同步 `docs/architecture/architecture.md`，不得把实现决定偷偷写进产品需求。
- 调试与验证完成后，把真实命令、退出状态、可观察结果、未验证项和剩余风险写入 `docs/verification/`；没有真实证据不得勾选 Task 或声称阶段完成。
- 实现或联调发现上游合同不成立时，先暂停代码并更新相应 PRD/Product Spec/Feature Map/Feature Spec，再继续开发；不得让代码事实长期领先文档。
- 当前 Feature Map 可以先保持 `draft`。只有用户开始该阶段并确认其边界时，才创建对应 Feature 目录和三件套；Architecture 未稳定前，Plan/Tasks 不得猜测官方扩展点或实现文件。
- 当前阶段完成并同步文档后立即停止。没有用户下一阶段的明确指令，不自动继续拆分、开发、重构或美化。

## 主分支开发与 Worktree 清理

`FDEDeliveryWorkbench/` 根目录是唯一 Git 顶层。默认直接在现有 `main` 主工作树开发、构建和运行，不因新增 Feature、UI 修改或并行任务自动创建分支、worktree 或重复 checkout。

- 保留主工作树已有的 staged、unstaged 和 untracked 改动；只提交当前任务的明确文件，不覆盖或顺带提交其他任务内容。
- 只有用户明确要求创建 worktree 时才创建；此前先说明用途、磁盘成本、运行数据来源和清理条件。运行数据仍须显式指定 `DSH_HOME`，不得默默切换为空运行区或全局默认目录。
- 收回既有 worktree 时先检查所有提交和未提交改动；可快进则使用 `--ff-only`，否则核对差异后合并。构建产物中出现功能不代表提交已合并。
- 删除前确认所有应保留提交已包含于 `main`，独有设计稿、Session 和其他运行数据已保留。工作树与分支分别处理，不能因 Git 状态干净就把被忽略的数据当作可删除缓存。

### FDE-Agent 运行数据同步

- Git 的 merge、rebase、fast-forward 只同步受控源码；被忽略的 `.runtime/`、Workspace 项目文件和 Session 日志不会随代码自动同步。用户要求“合并回 main 再拉取最新”、“同步 main”或“同步 FDE-Agent 数据”时，在重启预览前必须分别核对代码基线和运行数据基线，不得仅根据 Git SHA 宣称同步完成。
- FDE-Agent 测试项目的业务数据事实源是 `/Users/muyu/FDE-Agent/fde-agent`；主运行区中该项目的 Session 事实源是根仓库 `.runtime/dsh-home/` 内该 Workspace 对应的会话记录。Feature worktree 必须把它们复制到自己的 `.runtime/workspaces/fde-agent` 和 `.runtime/dsh-home/sessions/`，并保持 `workspace.json` 的 Workspace ID 与 Session ID 一致；不得让隔离预览直接写入事实源。
- 同步 Workspace 文件时必须同时保留原始字节和高精度修改时间，并在完成后对比相对路径、文件数、内容 hash 与 `mtimeMs`。当系统自带 `rsync -a` 会把修改时间截断到整秒时不得使用它复制该数据；应使用能保留时间精度的 `ditto` 或等价方式，否则已识别 Source 会因原件 `mtimeMs` 不匹配被误判为 `stale`。
- Session 日志不得解压后整体重新压成单个 Zstandard frame。迁移会话工作目录时，必须把改写后的唯一 Session header 保持为第一个独立 frame，后续事件保持在后续 frame，且 header 中的 `cwd` 必须指向该 worktree 的隔离 Workspace；否则 Harness 会以 `first frame is not exactly one header line` 拒绝启动。
- 数据同步后的最小验证是：目标 Workspace 与事实源的文件集、内容和修改时间一致；没有因复制新增的 `stale` Source；Session 数量和 ID 与 `workspace.json` 一致；所有 Session header 指向隔离 Workspace；服务使用当前 worktree 的显式 `DSH_HOME` 成功启动并返回 HTTP 200。

## 开发规则

- 只实现 Feature Map 中已确认且由当前请求授权的 Feature；保持 PRD、Product Spec、Feature Map、三件套、架构和实现一致。
- 产品范围或验收变化时使用 `$product-prd`；跨 Feature 合同变化时使用 `$product-spec`；Feature 边界或任务变化时使用 `$feature-spec-planning`。
- Task 按可独立验证的结果拆分，可以跨页面、服务、数据和测试；不得使用 FE、BE、INT 或 Pack 技术车道标签。
- 只有完成证据和最窄验证真实通过后才勾选 Task；需求变化先更新 PRD、Product Spec 和 Feature Map。
- 先映射用户旅程、状态、前后端合同和可见结果，再修改代码。
- 正常、加载、空、失败和成功状态服从产品实际需要，不用假成功或隐藏 mock 冒充真实结果。
- 每项验收只使用一个最窄且充分的验证方法；通过后记录证据并停止。
- 不读取、回显、提交或复制真实凭证；计费调用、外部写入和部署必须获得明确授权。
- 保留用户已有改动，不使用破坏性工作区回滚。

## Definition of Done

- 行为可追踪到已确认需求 ID 与验收标准；
- 直接受影响的页面、API、数据和后台状态一致；
- 最窄相关检查通过，核心旅程得到可观察结果；
- README、AGENTS、PRD、Product Spec、Feature Map、三件套、架构和验证证据已同步；
- 未执行项、外部依赖和剩余风险已如实记录。

## 最终教学交付

目录初始化和功能开发不等于最终交付。全部开发完成且用户明确要求后，使用 `$prepare-teaching-project-delivery` 生成学员包、项目介绍、截图和视频。

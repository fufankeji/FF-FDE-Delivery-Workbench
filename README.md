# FF - FDE 交付工作台

面向 FDE 从业者，把企业需求转化为可验证、可部署、可验收、可移交 AI 生产系统的一体化交付工作台。课程负责教会用户使用，但不构成产品角色或信息架构。

## 当前范围

- 目标用户：承担真实企业 AI 项目结果的 FDE 从业者。
- P0 核心旅程：产品介绍首页 → 工作台总览 → 创建或选择项目 → 收集原始来源 → 与项目 Agent 协作 → 形成方案、业务系统和运行证据 → FDE 审阅并决定 → 试点、生产交接与持续改进。
- 当前平台导航：首页统一使用“进入平台”，不再单列实验室入口；总览、项目中心、实验室和技能中心为同级入口。总览展示真实项目/实验室/案例概况与最近项目；实验室切换保留训练页面，技能中心仅显示“待接入”，不读取或安装 Skills。F025 实现与定向检查已完成，页面观感待人工确认。
- 当前已实现：项目中心、多会话导航、项目 `fde-resources/` 原件与稳定 SourceId、本地文档识别、八阶段项目工作台、项目启动/关闭/预览、系统架构、用量分析、评估优化，以及右侧 Files/Editor/Git/Review Dock。历史阶段只读回看；继续工作需返回相应阶段，不因浏览页面改变项目进度。
- 当前资料边界：导入、本地识别和预览都不修改输入框、不创建消息、不触发 Agent；已验证 DOCX、XLSX、PPTX、PDF、CSV、Markdown 和文本识别，OCR、版本/删除、权限/有效性与对话显式引用尚未实现。
- 当前开发工作区边界：锁定 `dsh-better-sidebar@0.19.1` 与 `dsh-file-review-tab@0.5.0`；左侧保留项目/会话及独立功能入口、中央保留官方对话，右侧按需展示文件、编辑、Git Diff 与 Agent 文件审查，且两类 Diff 保持不同来源语义。
- 当前项目进度：项目中心按最近操作汇总项目、阶段、会话和交付周期，支持查看产物、进入项目及历史阶段回看；不把文件数量或服务启动成功直接当成阶段验收。
- 当前项目结果：项目交付中提供“API 文档”和“系统架构”。API 工具复用锁定 `dsh-openapi` 并按 calling Agent Workspace 隔离；系统架构提供 Agent 候选、精确 revision、人工确认、缩放和 SVG/PNG 导出，不把运行图冒充设计架构。
- 当前运行与质量：观测固定 `dsh-observe`，默认 disabled 且无外发，页面汇总项目内真实 Session/Stats/Token；评估固定 `dsh-eval-harness`，经过二次费用确认后运行隔离 Trial，展示报告、人工 Baseline 和同名用例差异。自动开发验证没有调用付费模型。
- 当前界面主题：设置中的“界面主题”提供官方原版、大肥鱼拟人、云端猫咪和三套九天皮肤，也支持只在当前浏览器处理和保存的自定义背景；皮肤与浅色/深色/跟随系统相互独立。
- 当前独立训练：业务挖掘实验室保留五案例、像素办公室、岗位访谈、资料、计算、报告与历史；不要求创建项目，不推进项目阶段。实现与无密钥检查已完成，真实模型和视觉体验待人工确认。
- 明确不做：客户管理、跨项目资源与成本管理、经营统计、教学账号与班级管理、团队协作、跨项目资产复用和完整 VS Code Workbench。

## 官方基座更新

当前固定官方 `dsh-v0.1.6-alpha.1` / `0a15e36e7f82b6ed45af6fa9759f29b40dcd965d`，由 Corepack 按 package.json 使用 `pnpm@10.34.5`。升级与后续更新步骤见[基座升级说明](docs/architecture/harness-016-upgrade.md)，结果见[验证记录](docs/verification/2026-09-16-harness-016-upgrade.md)。普通 `git pull --ff-only` 更新本工作台发行源码，不会自动合并官方版本。

官方 Web 首次访问现在使用终端输出的本地登录链接建立浏览器 Cookie。旧会话由官方迁移器读取并保留原格式文件；第一次切换版本前应先验证隔离副本。当前升级分支的隔离预览使用 3082，主工作台保持原版本，等待人工验收。

## 八阶段如何使用

| 阶段 | 工作重点 |
| --- | --- |
| 1. 发现高价值问题 | 核对原始材料、业务流程与值得解决的问题。 |
| 2. 定义结果、范围与责任 | 明确业务目标、成功标准、边界和责任人。 |
| 3. 调查数据、系统、接口、安全与组织 | 核实现场证据、数据适用性、系统关系和 AI 动作权限。 |
| 4. 设计方案并完成端到端纵向切片 | 简单业务采用开发 Spec；确有必要时使用 Semantica 建立最小本体和图谱，再运行切片验证。 |
| 5. 运行 PoC 与 Eval | 在 Agent 对话中开发项目；工作台承接受测版本、启动入口、架构、测试指标与证据。 |
| 6. 企业集成、可靠性改造与受控 Pilot | 明确受控范围、接入条件、接管恢复、试点指标与结果。 |
| 7. 进入生产、推动采用并验收交接 | 记录发布、采用、逐项验收、交接材料和接收责任。 |
| 8. 持续改进并沉淀可复用能力 | 根据现场问题排序，跟踪修复、回归、发布与复盘。 |

本体不是每个项目的必选项。构建成功、结构验证、业务验证与 FDE 人工决定分别记录；图谱可视化不等于项目已验收。

## 项目结构

- `upstream/deepseek-harness/`：锁定官方 DeepSeek Harness `0.1.6-alpha.1` 的源码及当前 FDE 下游插件。
- `.runtime/dsh-home/`：被忽略的本地 DSH 运行状态。
- `source-materials/fde-agent/`：随仓库分发的 FDE-Agent 项目素材、导入脚本和文件校验清单；不是工作台的全局业务模板。
- `frontend/`、`backend/`：预留给后续独立 FDE 前端/后端交付层；当前实现仍在锁定基座中以插件方式完成 vertical slices。
- `docs/`：产品级 PRD、项目总 Spec、Feature Map、逐 Feature Spec/Plan/Tasks、架构与验证证据。

## 快速开始：加载已有 FDE-Agent 项目

需要 Node.js 24+、Corepack 和 pnpm。以下为 macOS/Linux Shell 命令；仓库目前为私有仓库，拉取者需先获得访问权限。首次安装和构建需要网络，不需要模型密钥。

```bash
git clone https://github.com/fufankeji/FF-FDE-Delivery-Workbench.git
cd FF-FDE-Delivery-Workbench

# 导入附带项目：资料、阶段记录、图谱和业务源码
node source-materials/fde-agent/load.mjs

cd upstream/deepseek-harness
corepack pnpm install --frozen-lockfile
corepack pnpm run build

DSH_HOME="$PWD/../../.runtime/fde-agent-sample/dsh-home" \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

打开 <http://127.0.0.1:3080>，在项目中心进入“连锁门店设备故障智能分诊项目”。首次进入会创建自己的会话，不会载入作者的私人聊天记录。端口已被占用时改用其他空闲端口，不要停止其他项目。

### 局域网 IP + 端口访问

在 `upstream/deepseek-harness/` 内，用实际运行区的 `DSH_HOME` 启动；主工作区命令如下（导入素材的独立运行区则使用导入脚本打印的 `dshHome`）：

```bash
DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --lan --port 3080
```

同一局域网设备打开启动日志中的 `http://本机局域网IP:3080`，本机仍可打开 `http://127.0.0.1:3080`。`--lan` 显式启用网络监听，IP 随电脑网络变化，不写死在源码；换网后重启。取消 `--lan` 并使用 `--host 127.0.0.1` 即恢复本机访问。

此模式没有登录鉴权，能连接该端口的人可查看项目并操作 Agent，只用于可信局域网，不要做公网端口映射。凭据、系统配置和原生桌面操作仍限本机；业务系统的独立 `*.localhost` 内嵌预览仍是本机能力，不随工作台开放而自动发布。

### 拉取后可以看到什么

- 35 份客户仿真原件及其 SourceId、已解析内容。
- 第一至第八阶段已有产物与状态；载入位置是第八阶段，保留一轮改进记录，可从左侧回看前面阶段。
- 第四阶段的最小 Schema、Semantica 构建/验证记录，以及 **56 个实体、56 条关系**的知识图谱快照。
- 第五阶段的业务项目源码、架构、测试指标和历史运行证据。
- 后三阶段的试点、交接和改进记录，直接使用正常项目工作台展示，不另设演示入口。

这些是脱敏仿真项目与历史联调数据。部分阶段通过输入用于验证交付状态链，不代表真实客户已上线或签收；数据来源保留在项目证据文件中。导入不会重新执行测试，也不会重新签署人工决定。

### 为什么要执行导入脚本

Git 只同步文件，不同步本机 Workspace、阶段存储、会话或文件修改时间。脚本将素材复制到独立运行区，校验文件摘要、恢复原始资料时间，并登记一个新的 Workspace 和已有阶段状态，避免“文件在，但阶段或图谱读不到”。

```text
source-materials/fde-agent/project/        仓库中的原始素材，保留不动
.runtime/fde-agent-sample/project/         导入后的可工作项目
.runtime/fde-agent-sample/dsh-home/        对应工作台状态和之后新建的会话
```

重复运行脚本会拒绝覆盖。以后启动只需复用同一个 `DSH_HOME`；希望再导入一份时，在仓库根目录执行 `node source-materials/fde-agent/load.mjs .runtime/fde-agent-second`，并使用脚本打印的新 `dshHome` 启动。不要把素材直接上传为一批附件：附件上传不能恢复项目阶段和来源引用。

运行目录不进 Git，`git pull` 不会覆盖已导入项目。已有运行区若产生了自己的会话、报修和草稿，应保留或备份，不能当作缓存删除。只想从空白项目开始时，不必导入，使用原来的 `DSH_HOME="$PWD/../../.runtime/dsh-home"` 启动即可。

### 启动附带的业务系统

工作台和业务系统是两个进程。新开终端，从仓库根目录执行：

```bash
cd .runtime/fde-agent-sample/project
node backend/server.mjs
```

打开 <http://127.0.0.1:4177>，选择报修 `R-1002` → 分析 → 查看关联与证据 → 人工核对并保存本地草稿。无需安装业务依赖或配置模型。端口冲突时使用 `REPAIR_PORT=4178 node backend/server.mjs`，按 `Ctrl+C` 停止。

业务项目不会自动正式派单、通知客户或产生费用承诺。新增记录保存在项目 `.runtime/maintenance/` 中。导入时不复制作者的“运行中”状态，工作台启动/预览入口需针对本机实际进程登记，不能因为带有源码就显示已启动。

### 继续用 Agent 开发或重建图谱

查看阶段材料、历史图谱和运行上述业务系统，不要求配置大模型或安装 Semantica。继续与 Agent 对话需要在工作台中配置自己的模型服务，可能产生模型费用；运行轨迹和用量分析只统计自己之后产生的会话。

重新抽取、建图、验证或查询 Semantica 运行时，需要自行安装兼容的 Semantica `0.6.7` 并在启动工作台时设置 `FDE_SEMANTICA_PYTHON`、`FDE_SEMANTICA_SOURCE`。详细边界与操作见 [Semantica 集成说明](upstream/deepseek-harness/packages/fde/semantica/README.zh.md)。素材包不含 Semantica 源码、虚拟环境、模型权重、个人凭证或生产系统账号。

为避免重启后丢失配置，把下面两项保存到实际使用的 `DSH_HOME` 目录内 `.env` 文件，替换为自己的安装路径；仍按前述命令显式传入同一个 `DSH_HOME` 启动。主工作区使用 `.runtime/dsh-home/.env`，导入素材后的独立工作区使用导入脚本打印的 `dshHome`。不要把本机 `.env` 提交到 Git。

```dotenv
FDE_SEMANTICA_PYTHON=/path/to/semantica/.venv/bin/python
FDE_SEMANTICA_SOURCE=/path/to/semantica
```

第四阶段选择本体路线后，可在 Agent 对话中说：“调用 semantic_workspace 检查当前项目，使用我已授权的资料逐步准备本体和图谱；遇到候选审核或 Schema 发布时停下让我确认。”Agent 可绑定材料、编辑草稿、抽取、构建和验证；候选审核、发布以及阶段决定仍在工作台由 FDE 确认。第五阶段通过 `semantic_context_query` 的 `consume` 方式查询当前有效图谱，不需要重新构建。历史记录缺少当前验证或原始资料变化时会拒绝查询，需要重新核对，不能直接改状态恢复通过。

素材构成、校验与更新方式见 [FDE-Agent 素材说明](source-materials/fde-agent/README.md)。

## 独立业务挖掘实验室

从首页右上角或项目中心顶部的“业务挖掘实验室”进入，无需创建或选择项目；项目工作面侧栏也保留同名入口。选择案例、查看背景并开始调查；点击“返回工作台”恢复原工作面。原项目中心、八阶段和会话入口不变。打开大厅和选择岗位不调用模型；提交访谈后会进行回答与证据核对，报告也调用模型，可能产生费用。训练使用原实验室的 Provider/Model 环境变量，不修改项目模型选择。

首次使用需从获授权的 `0.3.2` 完整交付 ZIP 导入素材。在 `upstream/deepseek-harness/` 下执行：

```bash
corepack pnpm --filter @deepseek-ai/dsh-fde-discovery-lab import:assets /absolute/path/to/FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip
```

然后按前述安装、构建和显式 `DSH_HOME` 命令启动。缺少素材时实验室显示安装提示，其余工作台入口仍保留。训练同一服务共享每案例一个当前轮次，不提供学员账号隔离；原桌面应用保留 1000 px 最小宽度。素材来源、存储、模型与清理边界见[实验室说明](upstream/deepseek-harness/packages/fde/discovery-lab/README.zh.md)，本次真实检查与待人工项见[F024 验证记录](docs/verification/2026-09-16-f024-business-discovery-lab.md)。

## 使用 Agent 开发

项目规则见 `AGENTS.md`。可让 Codex 先读取该文件、confirmed PRD、Product Spec 与 Feature 三件套，再实现当前授权 Feature。

---

`@赋范空间 独家研发`

## 真实项目与证据校验

平台按当前 Workspace 读取各项目自己的资料、Schema、指标与阶段记录，素材项目不会自动成为新项目的数据。随仓库材料保留历史联调来源，导入后可查看完整过程，但不代表真实生产上线或客户签收。

若旧结果显示待核对，请核对实际运行证据后重新记录：第五阶段结果需要 `evidenceDigests`（证据相对路径到运行完成时 SHA-256 的映射）；不要通过改标签、重算旧报告摘要或填充 PASS 绕过检查。文件检查证明完整性，不代替真实测试和 FDE 人工验收。

图谱查询需指定当前项目的 `questionId` 或 `seedNodeId`；默认 `semantic_context_query` 只读，不改变第四阶段。准备新的第四阶段切片时才传 `purpose: "validation"`。当前为规则抽取与明确节点／问题查询，不是任意文档自动理解或自由文本语义检索。

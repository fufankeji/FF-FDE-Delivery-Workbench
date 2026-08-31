# FF - FDE 交付工作台（完整交接快照）

这是 `FF - FDE 交付工作台` 的私有协同仓库。仓库不是只有一份前端源码，而是把本轮演示所需的三类事实放在一起：

- 基于 DeepSeek Harness Web 二次开发的完整工作台源码；
- `数据分析项目` 的源码、客户资料、六阶段交付物、项目状态和本地业务数据库；
- 本轮真实使用过的隔离 DSH 工作区状态、会话历史和会话附件。

同事克隆仓库后，通过仓库内脚本恢复隔离工作区，即可看到当前的项目文件、阶段状态与历史会话。模型 API Key、个人凭证、依赖目录、构建产物、日志和进程文件不会提交。

## 快速开始

### 1. 克隆私有仓库

```bash
git clone git@github.com:fufankeji/FF-FDE-Delivery-Workbench.git
cd FF-FDE-Delivery-Workbench
```

如果本机 GitHub 使用 HTTPS，也可以使用仓库页面提供的 HTTPS 地址。

### 2. 安装并构建工作台

环境要求：

- macOS；
- Node.js `22.19.0+` 或 Node.js `24+`；
- Node.js 自带的 npm/npx；
- 安装依赖时可访问 npm registry。

执行：

```bash
./scripts/install.sh
```

该脚本会：

1. 按锁文件安装 `app/deepseek-harness/` 的 pnpm 依赖；
2. 构建 DeepSeek Harness 与本项目的 FDE 插件；
3. 从 `handoff/dsh-home-template/` 恢复仓库专用的 `.runtime/dsh-home/`；
4. 自动把原机器路径改写为当前克隆目录，不会读写用户全局的 DSH 工作区。

脚本会读取 DeepSeek Harness `package.json` 中锁定的 pnpm 版本并通过
`scripts/pnpm.sh` 执行，不依赖电脑上 Corepack 当前激活的 pnpm 版本。

### 3. 启动工作台

```bash
./scripts/start.sh
```

浏览器访问：<http://127.0.0.1:3080>

启动脚本始终显式使用：

```text
DSH_HOME=<当前仓库>/.runtime/dsh-home
```

因此打开的就是本仓库携带的隔离工作区，不会误加载同事电脑上的其他 DeepSeek Harness 项目。

### 4. 首次配置模型

为了避免泄露凭证，仓库没有包含原机器的 `.credentials.yaml`。页面与历史会话可以直接读取；需要继续与 Agent 对话时，请进入：

```text
设置 → 模型
```

由使用者填写自己的模型服务配置。不要把生成的凭证文件提交到 Git。

## 启动后应看到什么

左侧项目区应出现：

- 项目：`数据分析项目`；
- 可见项目会话：3 个；
- 其中已有标题的会话包括 `客户需求初步解读结论`、`项目安装方式说明文档`；
- 会话归档总计 9 个，其中 6 个是主会话产生的子代理过程；
- 当前项目阶段：已走完六阶段并保留阶段返回记录；
- 项目文件：客户原始资料、方案/研发/评估/试运行/验收移交产物，以及数据分析系统源码。

如果 `.runtime/dsh-home/` 已存在，恢复脚本会停止并保留现有内容，不会覆盖。需要重新加载交接快照时，先把现有目录移动为备份，再执行：

```bash
node ./scripts/restore-handoff-state.mjs
```

## 仓库结构

```text
.
├── app/deepseek-harness/          # FDE 工作台完整源码
├── workspaces/ai-analysis/        # 数据分析项目源码、资料、交付物与业务数据
├── handoff/dsh-home-template/     # 已脱敏的会话、附件、项目与阶段状态模板
├── scripts/install.sh             # 安装、构建并恢复交接状态
├── scripts/start.sh               # 使用隔离 DSH_HOME 启动 Web UI
├── scripts/pnpm.sh                # 使用源码锁定的 pnpm 版本执行命令
├── scripts/restore-handoff-state.mjs
├── PRODUCT_GUIDE.md               # 产品设计思路与六阶段使用手册
└── AGENTS.md                       # 协同开发与数据保护约束
```

## 数据分析项目

`workspaces/ai-analysis/` 是工作台当前加载的真实项目目录，包含：

- `fde-resources/`：DOCX、PDF、XLSX、PPTX、CSV、PNG 等客户输入资料；
- `fde-deliverables/`：需求调研、方案设计、项目开发、验证评估、部署试运行、验收移交六阶段产物；
- `.fde/`：架构、阶段、评估、试运行与验收移交状态；
- `docs/`：研发过程中的标准 Spec 文档；
- `backend/`、`frontend/`、`scripts/`、`sandbox/`：数据分析系统完整源码；
- `.runtime/northlight.sqlite3`：本轮演示产生的本地业务数据快照。

数据分析系统自身的安装与启动要求，以 [workspaces/ai-analysis/AGENTS.md](workspaces/ai-analysis/AGENTS.md) 和 [workspaces/ai-analysis/INSTALL.md](workspaces/ai-analysis/INSTALL.md) 为准。工作台中的“启动项目”也会读取该项目的 `AGENTS.md` 来驱动启动过程。

### 下载最终交付 ZIP

最终验收阶段生成的 4 个交付 ZIP 和 1 个评估导出 ZIP 不写入普通 Git 历史，而是随私有仓库发布在 `handoff-2026-08-27` Release 中。它们不影响工作台、项目或历史会话的加载；需要检查最终打包物时执行：

```bash
mkdir -p workspaces/ai-analysis/fde-deliverables/06-acceptance-handover/packages
gh release download handoff-2026-08-27 --repo fufankeji/FF-FDE-Delivery-Workbench \
  --dir workspaces/ai-analysis/fde-deliverables/06-acceptance-handover/packages
```

Release 中还包含评估导出 ZIP。每个资产的 SHA-256 见 [artifacts/HANDOFF_RELEASE_SHA256SUMS.txt](artifacts/HANDOFF_RELEASE_SHA256SUMS.txt)。

## 会话恢复原理

版本库保存的是可迁移模板，而不是直接提交一个正在运行的用户目录：

1. `handoff/dsh-home-template/` 保存会话事件、会话投影、项目登记、阶段状态和附件；
2. 模板中的原机器绝对路径已经替换为占位符；
3. `restore-handoff-state.mjs` 将模板复制到仓库根目录的 `.runtime/dsh-home/`；
4. 脚本按当前克隆位置重写 Workspace 与每一条会话中的工作目录，并生成 DeepSeek Harness 使用的项目目录键；
5. `start.sh` 只加载这个仓库内的 DSH_HOME。

这样，同事不需要创建 `/Users/muyu/test/ai-analysis`，也不需要导入全局配置，就能加载同一套项目和会话。

## 有意排除的内容

以下内容可再生、属于本机状态或包含秘密，因此不进入仓库：

- `.credentials.yaml`、项目 `.env` 和所有模型/API 凭证；
- `node_modules/`、`.venv/`、`.uv-cache/`、`.pnpm-store/`；
- 构建目录、测试缓存、日志和 PID；
- 原 DeepSeek Harness 仓库的 `.git/` 历史。

公开配置示例、锁文件、业务数据库、客户资料、项目交付物、会话历史与附件均已保留；生成的最终 ZIP 通过同一私有仓库的 Release 保存。DeepSeek Harness 官方基线提交为 `e648f3ba1ecee83a88eebc4ff1aaf8a4a4264327`，其上的 FDE 工作台本地改动已经作为本仓库源码快照提交。

## 产品设计说明

请先阅读 [PRODUCT_GUIDE.md](PRODUCT_GUIDE.md)。其中说明了：为什么以项目为最小单元、项目交付与项目进度的职责、六个阶段的输入输出、Skills 如何约束产物、人为什么必须负责阶段确认，以及阶段相关页面和项目启动/终端/API/浏览器的出现条件。

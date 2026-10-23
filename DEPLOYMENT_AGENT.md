# FF - FDE 交付工作台：Agent 部署手册

> 用途：将本文件与源码一起交给有权操作目标电脑的 Agent，让它完成环境检查、依赖安装、构建、本机启动与必要验收。
>
> 本文是部署操作指南，不是让 Agent 继续开发产品的需求书。默认不修改业务代码、不开放公网、不调用付费模型、不迁移作者的个人运行数据。

快速导航：[Agent 提示词](#2-可以直接交给-agent-的任务提示词) · [部署范围](#3-先选择部署范围) · [环境检查](#5-环境检查与安装前报告) · [Git / ZIP](#6-获取完整源码git-与-zip-两条路径) · [macOS / Linux](#7-macos--linux标准部署流程) · [Windows](#8-windows-powershell对应流程) · [实验室](#9-实验室素材与-python-的详细规则) · [模型配置](#10-模型配置部署与计费验证分开) · [部署验收](#11-最小部署验收只读技术检查--人工体验) · [故障处理](#16-常见故障与最小处理) · [交付记录](#17-agent-最终部署记录模板)

## 1. 适用版本与完成标准

本文已于 **2026-10-23** 随兼容升级更新，锁定官方基座为 `dsh-v0.2.1-rc.2`：

```text
687f282e8625c6b8d11ff58211a90524be2e4317
```

这不是要求所有接收者强制切换到该提交。实际分享版本以交付者提供的 Git 提交或源码包版本为准；如果依赖版本、脚本或目录已经变化，先对照实际源码调整部署计划，不要照抄过期命令。

验证边界：本文依据源码、项目已有本机运行证据及文档命令检查编写，**不代表已经在全新的 macOS、Linux、Windows 机器上逐一完成安装验收**。尤其是 Windows 原生依赖和不同 Linux 发行版，应记录目标机器上的实际结果。

部署成功至少意味着：

1. 使用分享源码中的锁定依赖，安装和完整构建退出码均为 `0`。
2. 启动的是这份源码对应的 Host，显式使用本次部署的 `DSH_HOME`。
3. 首页返回 `200`，Boot Manifest 存在，关键在线插件与本地构建产物一致。
4. 项目登记和用户选择的部署范围一致，没有误读作者或其他实例的数据。
5. 若选择实验室，五个案例可读取；若缺少授权素材，必须标记实验室未完成。
6. 交付访问地址、实际数据路径、停止及重启方法，并说明模型、视觉与可选能力哪些尚未验证。

不要把“网页能打开”“安装命令执行过”或“示例自带通过记录”等同于全部功能验收通过。

## 2. 可以直接交给 Agent 的任务提示词

把下面一段复制给接收者自己的 Agent，并填入源码实际位置：

```text
请部署“FF - FDE 交付工作台”。源码目录是：<填写源码绝对路径>。

先完整阅读根目录 AGENTS.md、DEPLOYMENT_AGENT.md，以及本次选用功能的包说明。
本次任务是部署与验收，不是修改产品功能。

默认范围：本机访问 + 导入仓库附带的 FDE-Agent 示例项目。
如果我另行提供了获授权的业务挖掘实验室 0.3.2 完整交付 ZIP，增加实验室素材导入；
没有 ZIP 时先完成工作台，不下载来历不明的素材、不伪造案例。

请按以下顺序执行：
1. 检查源码完整性、操作系统、Node、Corepack/pnpm、端口及已有运行数据。
2. 告诉我将使用的源码路径、部署范围、端口、DSH_HOME 和缺失依赖。
3. 在 upstream/deepseek-harness 中按锁文件安装并完整构建。
4. 如需示例，仅用仓库导入脚本写入一个不存在的新目标目录。
5. 必要时导入授权实验室素材，然后显式指定 DSH_HOME，以 127.0.0.1 启动。
6. 完成本文的只读技术验收，给我地址进行人工体验；没有授权不做自动浏览器回放。
7. 按本文模板输出部署记录，明确哪些通过、哪些未配置、哪些待人工确认。

禁止读取或复制作者/我的现有凭据文件，禁止把密钥写入聊天、源码或日志。
需要模型时，先说明服务商、用途、费用与资料外发范围，等我明确授权；
优先让我在本机工作台设置中自己配置。没有模型不妨碍先完成无密钥部署。
不得擅自开放 LAN/公网、杀死其他服务、删除已有运行区、改锁文件或升级依赖。
如果已有目标目录、端口占用或源码包不完整，保留现状并提出最小解决方案。
完成以上验收后停止，不继续开发、重构、打包或发布。
```

如只要空白工作台，把“导入仓库附带的 FDE-Agent 示例项目”改为“空白工作台，不导入示例”。

## 3. 先选择部署范围

| 范围 | 需要的交付物 | 无模型时能做什么 | 额外条件 |
| --- | --- | --- | --- |
| A：空白工作台 | 完整仓库源码 | 打开工作台、使用无密钥界面与本地能力 | 自行创建或选择项目；真实 Agent 对话需模型 |
| B：工作台 + FDE-Agent 示例，默认推荐 | 完整源码，含 `source-materials/fde-agent/` | 查看八阶段材料、原件、历史图谱；运行示例业务系统 | 用导入脚本创建独立 Workspace |
| C：A 或 B + 业务挖掘实验室 | 以上内容 + 单独获授权的实验室 ZIP | 进入实验室、浏览案例与已有资料 | Python；访谈、核对、报告等模型操作另需授权配置 |
| 可选：重新运行 Semantica | A 或 B + 接收者自己的兼容 SDK 环境 | 不影响原有历史图谱展示 | Semantica `0.6.7` 及其依赖；见第 13 节 |

### 3.1 源码不包含什么

- 不包含作者的模型密钥、个人会话、全局 `~/.dsh`、生产账号。
- 不包含可直接沿用的 `node_modules`、编译产物或 Python 虚拟环境。
- 不包含业务挖掘实验室约 **36 MB** 的导入后授权素材；该目录被 Git 忽略。
- 不包含 Semantica SDK 源码或它的完整 Python 环境。
- 不包含可直接宣称为客户验收结果的真实生产数据。

完整实验室交付 ZIP 的名称为：

```text
FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip
```

没有这个获授权的交付物，仍可完成 A/B，但不能将 C 标为完成。拥有工作台源码访问权限，不自动代表拥有实验室素材的公开再分发权。

## 4. 认识目录：不要从错误的入口启动

```text
FDEDeliveryWorkbench/                         ← 本文所说的仓库根目录
├── AGENTS.md
├── README.md
├── DEPLOYMENT_AGENT.md
├── source-materials/fde-agent/
│   ├── load.mjs                              ← 示例导入入口
│   └── project/                              ← 原始分享素材，不在这里开展工作
├── upstream/deepseek-harness/                 ← 安装、构建、工作台启动目录
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── vendor/
│   ├── patches/
│   ├── apps/
│   └── packages/
│       ├── fde/discovery-lab/.assets/         ← 导入后的可重建实验室素材
│       └── client/ui-fde-discovery-lab/       ← 实验室界面及构建入口
└── .runtime/                                 ← 本机可变数据，不进 Git
    ├── dsh-home/                             ← A：空白工作台运行区
    └── fde-agent-sample/
        ├── project/                          ← B：接收者实际使用的示例项目
        └── dsh-home/                         ← B：示例对应的工作台运行区
```

关键约束：

- 仓库根目录是唯一 Git 顶层；`upstream/deepseek-harness/` 是随仓库交付的真实源码，不是让你另行克隆最新版上游的位置。
- 根目录 `frontend/` 和 `backend/` 不是当前完整工作台的独立部署入口。
- 不要运行一个单独的 Vite 页面代替 Host；页面需要 Host 注入 Boot Manifest 与插件图。
- 不要用全局安装的 Harness、`npx` 下载的最新版或另一个 checkout 代替这份源码。
- 本部署不需要额外搭建 PostgreSQL、Redis、Docker Compose 或 Kubernetes；不要为部署任务自行增加这些设施。

## 5. 环境检查与安装前报告

### 5.1 版本与工具

| 项目 | 本文采用的基线 | 说明 |
| --- | --- | --- |
| Node.js | **24.x** | 用作统一部署基线；实验室使用 `node:sqlite` |
| pnpm | **11.28.5** | 以 Harness `package.json` 的 `packageManager` 为准，通过 Corepack 调用 |
| Corepack | 能执行锁定的 pnpm | 是否随 Node 发行包提供取决于安装方式；缺失时先确认安装方案 |
| Git | 克隆、更新时需要 | 仓库 Hook 安装器要求 Git 2.26+；源码 ZIP 不强制包含 `.git` |
| Python | 实验室需要 **3.9+** | 导入器与固定计算脚本使用；普通示例浏览不需要 |
| 浏览器 | 目标机可用的现代浏览器 | 默认由用户手动打开，不要求安装额外自动化浏览器 |

Harness 包声明的 Node 范围为 `^22.19.0 || >=24.0.0`，但本文涉及实验室，因此统一使用 24.x，避免把“满足部分包的 engines”误当作全部所选功能兼容。

安装需要访问包注册表及锁文件引用的 GitHub 下载地址。构建依赖和产物会占用明显多于源码的磁盘空间；先检查剩余容量。本文不把未经目标环境测量的内存、磁盘数值写成硬性最低要求。

`dsh-openapi@0.1.0` 已通过本地 `file:` 依赖随源码提供，不再下载原作者的 GitHub 仓库。部署前确认 `upstream/deepseek-harness/third-party/dsh-openapi/` 完整存在，并保留同级 `dsh-openapi.source.json` 和包内 MIT 许可证。不要删除该目录、改回原 Git URL 或要求接收者提供原作者仓库凭据；`yaml` 等公共依赖仍需按锁文件安装。

### 5.2 只读预检查

macOS/Linux，在仓库根目录执行：

```bash
pwd
node --version
corepack --version
git --version
df -h .
test -f upstream/deepseek-harness/package.json
test -f upstream/deepseek-harness/pnpm-lock.yaml
test -f upstream/deepseek-harness/pnpm-workspace.yaml
test -f source-materials/fde-agent/load.mjs

# 仅 C 范围需要；命令不存在时不要因此否定 A/B。
python3 --version
```

有 Git 元数据时，另外检查 `git rev-parse --show-toplevel`、`git rev-parse HEAD` 和 `git status --short`。源码 ZIP 没有 `.git` 属于另一条正常分发路径，见第 6 节。

Windows PowerShell：

```powershell
Get-Location
node --version
corepack --version
git --version
Get-PSDrive -PSProvider FileSystem
Test-Path upstream/deepseek-harness/package.json
Test-Path upstream/deepseek-harness/pnpm-lock.yaml
Test-Path upstream/deepseek-harness/pnpm-workspace.yaml
Test-Path source-materials/fde-agent/load.mjs

# 仅 C 范围需要。也可以检查已安装的 python3。
py -3 --version
```

端口检查，按平台选一个即可：

```bash
# macOS；没有输出通常表示没有对应监听者。
lsof -nP -iTCP:3080 -sTCP:LISTEN

# Linux；不要把没有 ss 命令误判为端口一定空闲。
ss -ltnp 'sport = :3080'
```

```powershell
# Windows；无匹配时不输出。
Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
```

有占用时先确认是否就是本次已有实例；若是其他服务，改用例如 `3082` 的空闲端口。禁止直接终止不属于本任务的进程。

### 5.3 Agent 应先给出的简短报告

```text
源码目录：<绝对路径>
来源：Git / 源码 ZIP；实际版本：<提交或交付版本>
系统与架构：<实际值>
Node / Corepack / pnpm：<实际值或缺失项>
部署范围：A / B / A+C / B+C
DSH_HOME：<绝对路径>
工作台端口：<实际端口>
实验室 ZIP / Python：<有、缺失或不适用>
现有运行数据：<不存在 / 存在，计划复用或另开目录>
计划安装的缺失工具：<没有则写无>
模型调用：本次不调用，或列出已明确授权的范围
```

用户已经要求部署时，项目内依赖安装和构建是正常步骤；安装系统工具、覆盖已有数据、调整系统安全策略或扩大网络开放范围不能悄悄夹带执行。

## 6. 获取完整源码：Git 与 ZIP 两条路径

### 6.1 Git 克隆，优先采用

当前仓库公开，可直接克隆；若交付者另行提供私有镜像，使用接收者自己的 Git 登录或 SSH 配置，不要把访问令牌拼进 URL、脚本或对话。

```bash
git clone https://github.com/fufankeji/FF-FDE-Delivery-Workbench.git FDEDeliveryWorkbench
cd FDEDeliveryWorkbench
git rev-parse --show-toplevel
git rev-parse HEAD
git status --short
```

如果已经收到完整目录，不必再克隆一份。不要在已有目录上覆盖解压、强制 checkout 或丢弃本地改动。

### 6.2 源码 ZIP：必须保留完整工程和版本信息

解压到接收者有写权限的本地目录，确保点号开头的必要配置、`vendor/`、`patches/`、锁文件及 `source-materials/` 均被保留。避免使用会改变文件内容或不支持所需时间精度的同步/网络目录。

**不含 `.git` 的源码包有一个额外步骤：构建前设置 `DSH_CLIENT_COMMIT_HASH`。**

构建脚本会读取 Git 提交哈希；没有 Git 元数据且没有该变量时会失败。此变量必须是交付者提供的、对应这份源码的真实提交哈希，不是随意填写的版本字符串。

macOS/Linux，在执行安装与构建的同一终端设置：

```bash
# 下面仅适用于明确标注为本文基线的源码包。
# 其他版本请替换为交付者给出的对应 SHA。
export DSH_CLIENT_COMMIT_HASH=337cd32a63a7042ccfd2ade412619ee41441f4c1
```

Windows PowerShell：

```powershell
$env:DSH_CLIENT_COMMIT_HASH = '337cd32a63a7042ccfd2ade412619ee41441f4c1'
```

如果交付者未提供版本，先索取，不能用 `git init` 或伪造哈希掩盖来源缺失。已有正常 Git 克隆一般不设置此变量，避免以后更新源码却继续使用旧值。`DSH_CLIENT_*` 会用于浏览器构建信息，**绝不承载密钥**。

## 7. macOS / Linux：标准部署流程

以下命令分步骤执行。某一步失败时停止后续步骤，保存脱敏错误摘要；不要继续启动半构建的系统。

### 7.1 固定本次路径与模式

先 `cd` 到自己的仓库根目录；同一终端执行：

```bash
export FDE_REPO_ROOT="$PWD"
export FDE_WEB_PORT=3080

# 默认 B：带示例项目。A 模式使用后面给出的替代路径。
export FDE_DSH_HOME="$FDE_REPO_ROOT/.runtime/fde-agent-sample/dsh-home"
```

`FDE_REPO_ROOT`、`FDE_DSH_HOME`、`FDE_WEB_PORT` 是本文为命令复用设置的 Shell 变量，不是产品新增配置；真正传给 Host 的运行目录变量叫 `DSH_HOME`。

若选择 **A：空白工作台**，改用下面一行，并跳过示例导入：

```bash
export FDE_DSH_HOME="$FDE_REPO_ROOT/.runtime/dsh-home"
```

不要混用两条路径。B 的 Workspace 登记在 B 自己的 `dsh-home` 中，换成 A 后看不到示例不代表数据丢失。

### 7.2 安装与完整构建

```bash
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm run build
```

分别确认退出码为 `0` 后再执行下一条。`corepack pnpm --version` 在当前工程应输出 `11.28.5`；若不一致，先核对交付版本的 `packageManager`。

注意：

- 首次必须完整构建，不能只运行某个 Client 的 `bundle` 或 `build:web`。
- 不要使用 `npm install`、另一个 pnpm 大版本、删除锁文件或不受控升级来“修复”安装。
- 不要默认添加 `--ignore-scripts`。本项目存在需要安装脚本和原生依赖的包，应使用仓库已声明的构建许可。
- 不要改用 `build:official`；本文部署当前 FDE 产品，不是生成另一个官方发行构建。
- `node:sqlite` 的实验性警告本身不等于启动失败；仍需依据退出码、监听和接口结果判断。
- 缺少 `corepack` 时，先选择与当前 Node 安装方式匹配的补装方案。不要未经说明使用 `sudo` 或改变用户全局工具链。

### 7.3 仅 B：导入示例

确认 `.runtime/fde-agent-sample` 不存在后执行：

```bash
cd "$FDE_REPO_ROOT"
node source-materials/fde-agent/load.mjs
```

脚本会校验素材、复制文件、恢复原件时间、创建新 Workspace 并登记阶段状态。保存输出中的 `workspace`、`dshHome` 和 Workspace ID；确认 `dshHome` 与 `FDE_DSH_HOME` 相同。

导入特点：

- 附带 35 份仿真原件、八阶段历史记录和 56 节点 / 56 关系的图谱快照。
- 首次位置是第八阶段，保留一轮改进记录；可以回看历史阶段。
- 创建新的 Workspace，不复制作者个人聊天；之后的对话属于接收者自己。
- 校验并恢复原件修改时间，避免 Source 被误判为 `stale`。
- 目标已存在时拒绝覆盖。失败留下的部分目录也不能直接覆盖重试。

已有成功导入就复用原目录，不必再导入。确需第二份时，先选定新的、不存在的目录：

```bash
cd "$FDE_REPO_ROOT"
node source-materials/fde-agent/load.mjs .runtime/fde-agent-second
export FDE_DSH_HOME="$FDE_REPO_ROOT/.runtime/fde-agent-second/dsh-home"
```

不允许通过复制一个 `project/` 文件夹、上传附件或手改阶段 JSON 来替代导入流程。

### 7.4 仅 C：导入实验室素材

按第 9 节完成素材导入。如果不部署实验室，直接进入下一步。

### 7.5 启动工作台

```bash
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
DSH_HOME="$FDE_DSH_HOME" \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port "$FDE_WEB_PORT"
```

保持这个终端运行。首次打开终端输出的带授权参数链接以建立浏览器 Cookie；随后才可访问下述普通地址。不要公开授权链接。页面不再自动弹出预览说明或账号/API Key 引导，模型配置由用户主动进入设置完成。在另一个终端做第 11 节检查。

```text
http://127.0.0.1:3080
```

如果换了端口，所有访问地址与检查命令同步替换。`--no-open` 仅表示不自动打开浏览器，不是无界面服务模式的特殊部署版本。

**禁止省略 `DSH_HOME`。** 一旦误启动并读到全局或别的实例数据，立即停止错误实例，以正确运行区重新启动；不要删除或修改全局 Workspace 来补救。

## 8. Windows PowerShell：对应流程

使用 PowerShell 命令，不要把 Bash 的 `NAME=value command`、反斜杠续行或 `export` 直接复制到 PowerShell。

### 8.1 路径与环境

先进入源码根目录：

```powershell
Set-Location 'C:\Projects\FDEDeliveryWorkbench'
$FdeRepoRoot = (Get-Location).Path
$FdeWebPort = 3080
$FdeDshHome = Join-Path $FdeRepoRoot '.runtime\fde-agent-sample\dsh-home'

# A 模式改用下一行，并跳过示例导入：
# $FdeDshHome = Join-Path $FdeRepoRoot '.runtime\dsh-home'
```

源码 ZIP 没有 `.git` 时，在此终端先按第 6.2 节设置对应版本哈希。

### 8.2 安装、构建、示例导入

```powershell
Set-Location (Join-Path $FdeRepoRoot 'upstream\deepseek-harness')
corepack pnpm --version
corepack pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，停止部署。' }
corepack pnpm run build
if ($LASTEXITCODE -ne 0) { throw '构建失败，停止部署。' }

# 仅 B；目标已存在时先处理复用/新路径选择，不要覆盖。
Set-Location $FdeRepoRoot
node source-materials/fde-agent/load.mjs
if ($LASTEXITCODE -ne 0) { throw '示例导入失败，保留现场并检查原因。' }
```

### 8.3 Python 与实验室

如果系统有真正可执行的 `python3`，可以采用第 9 节的 pnpm 导入入口。

若只有 Windows Python Launcher `py`，可直接调用同一个导入脚本：

```powershell
Set-Location (Join-Path $FdeRepoRoot 'upstream\deepseek-harness')
py -3 packages/fde/discovery-lab/scripts/import-assets.py 'C:\Packages\FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip'
if ($LASTEXITCODE -ne 0) { throw '实验室素材导入失败。' }

# FDE_PYTHON 需要真实的可执行文件路径，不能填成字符串 "py -3"。
$FdePythonExe = (py -3 -c 'import sys; print(sys.executable)').Trim()
$env:FDE_PYTHON = $FdePythonExe
```

### 8.4 启动

```powershell
Set-Location (Join-Path $FdeRepoRoot 'upstream\deepseek-harness')
$env:DSH_HOME = $FdeDshHome
corepack pnpm dsh web --no-open --host 127.0.0.1 --port $FdeWebPort
```

环境变量和 `$Fde...` 变量只在本次 PowerShell 会话中保留。新开终端时重新设置真实路径；不要以为之前赋值会永久生效。

Windows 若遇到原生依赖编译问题，先判断包是否提供当前平台预构建；只有明确需要编译时，再说明并安装对应 C++/Python 工具链。不要为了消除报错而禁用整个安全策略、删除原生依赖或大范围修改包版本。

## 9. 实验室素材与 Python 的详细规则

### 9.1 导入命令

macOS/Linux，在 Harness 目录执行，替换为真实绝对路径并保留引号：

```bash
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
corepack pnpm --filter @deepseek-ai/dsh-fde-discovery-lab import:assets \
  "/absolute/path/to/FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip"
```

pnpm 入口调用 `python3`。如果 Python 安装在其他路径，可以直接用其可执行文件运行 `packages/fde/discovery-lab/scripts/import-assets.py`；设置运行时 `FDE_PYTHON` 不会改变这个 pnpm 导入脚本对 `python3` 的调用。

导入器读取 ZIP 内的固定运行包：

```text
FDE-业务挖掘实验室-v0.3.2/安装包/jiutian-fde-discovery-lab-0.3.2.tgz
```

该内部 TGZ 的预期 SHA-256：

```text
2c68c7b2ef51f6e92c1cb00e796dbbdb249362eb249821152a9f26128e057678
```

导入器会执行固定摘要及文件校验，不需要另行手动解包整个交付 ZIP，更不能移入其中的个人配置、历史记录或无关素材。

### 9.2 导入结果与重复执行

- 目标为 `upstream/deepseek-harness/packages/fde/discovery-lab/.assets/`。
- 当前基线正常导入为 248 个文件、约 36.7 MB，包含五案例资料、案例定义、计算脚本与字体许可等。文件数量是此基线的参考，不代替导入器校验。
- 已有文件完全一致时可以跳过；同名内容不同会拒绝，不静默覆盖。
- 缺少 ZIP、内部路径不符、摘要不符时停止该模块部署，向交付者索取匹配文件；不得改脚本绕过校验。
- 如果 Host 已启动，导入后必须重启同一个实例，插件初始化才会重新读取素材。
- 素材导入和训练数据不同：重新导入不会重建或恢复训练历史。

### 9.3 运行时 Python

默认执行 `python3`。需指定解释器时，启动前设置：

```bash
export FDE_PYTHON="/absolute/path/to/python3"
```

这是单个可执行文件路径，不包含 `-I`、`-B` 等参数。运行桥接层自己添加隔离参数并限制环境变量、超时和输出。实验室这部分不要求安装 Semantica，也不需要给 Python 计算进程传模型密钥。

### 9.4 入口、数据与限制

- 首页右上角、项目中心顶部及项目工作面侧栏保留“业务挖掘实验室”入口。
- 实验室不是项目的第九阶段，不要求创建 Workspace，也不自动推进项目阶段。
- 原应用保持 1000 px 最小宽度；窄窗口可能出现横向滚动，不能据此断言构建失败。
- “返回工作台”恢复原工作面，不等于清除训练记录或保证取消所有后台处理。
- 同一个 Host 共享每个案例的当前轮次，没有账号、班级或多租户隔离。
- 训练数据库位于 `DSH_HOME/fde-discovery-lab/training.sqlite`；原生 Agent Session 记录也属于运行数据，需要一起保留。

多人独立学习应分别运行自己的实例和 `DSH_HOME`，在同一机器上还需独立端口；涉及互不信任的人员，应使用适当的系统用户/机器隔离。不能把一台无鉴权 LAN 服务当作学员管理平台。

## 10. 模型配置：部署与计费验证分开

### 10.1 不配模型也能先部署

安装、构建、打开工作台、浏览示例阶段与历史图谱、运行第 12 节的示例业务系统，不依赖模型密钥。没有模型时，可以交付“基础部署完成，模型未配置”，不必伪造一次对话成功。

### 10.2 安全配置流程

1. 由接收者选择其有权使用的模型服务商、接口地址、模型 ID 和预算。
2. 说明真实请求可能把输入内容发到该服务商，并可能产生费用。
3. 优先让接收者通过本机工作台的模型/凭据设置自行输入密钥；部署 Agent 不要求用户把密钥发到聊天。
4. 若已有受控环境变量，优先复用经过授权的注入方式，不主动枚举其值。
5. 只有明确授权模型验证后，才发送最小测试；单次操作也可能涉及多次内部调用，不能承诺只计费一个请求。

不要主动读取任何现存凭据库或作者的 `.credentials.yaml`。尤其不要读取 `~/.config/skyforge/credentials.yaml`；若确需使用受保护凭据，先单独说明服务、目的、目标命令/外部地址、费用和远端影响，等用户明确批准。

### 10.3 项目 Agent 与实验室的路由不是同一开关

项目 Agent 使用工作台已有的 Provider / Model 配置与选择器。

实验室另有启动环境变量，当前源码默认值如下：

```dotenv
DEEPSEEK_PROVIDER=deepseek-official
DEEPSEEK_MODEL=deepseek-v4-flash
```

这里描述的是**本版本源码默认值**，不保证接收者账号当前拥有该模型。先核实目标 Provider 已注册、模型 ID 可用、凭据已按对应 Provider 配置。

- `deepseek-official` 是 Provider 标识，不等同于所有名为 `deepseek` 的其他适配器。
- 官方 DeepSeek Provider 支持 `DEEPSEEK_API_KEY`，也支持其相应凭据配置；自定义服务应按该 Provider 自己的配置合同操作。
- 在项目界面切换模型不会自动改变实验室路由。
- 修改实验室环境变量后重启 Host；已有原生 Session 可能保存既有配置，不能仅凭新环境变量声称所有历史会话已经改用新模型。
- 打开大厅、选择岗位和恢复记录不调用模型；提交访谈、随后的证据核对及报告等会使用模型，可能增加用量。

### 10.4 配置保存与优先级

已核对的凭据读取优先级为：继承的进程环境变量 → `DSH_HOME/.credentials.yaml` → 启动工作目录 `.env` → `DSH_HOME/.env`。UI 管理的凭据保存在运行区，不应复制进源码。

非密钥配置可由用户在**实际使用的** `DSH_HOME/.env` 中维护，例如：

```dotenv
DEEPSEEK_PROVIDER=deepseek-official
DEEPSEEK_MODEL=deepseek-v4-flash
FDE_PYTHON=/absolute/path/to/python3
```

只保留自己需要的行，不把占位路径原样保存。Windows 文件中路径应使用该机器真实解释器路径，并遵循所用 dotenv 的写法。改完启动配置后重启。

检查配置问题时只报告“是否配置、配置来源、非敏感模型标识”等必要信息，不输出整个环境、整个 `.env`、凭据文件或带鉴权头的请求。继承环境变量可能覆盖 UI 保存值，不能通过重复修改 UI 掩盖该优先级。

## 11. 最小部署验收：只读技术检查 + 人工体验

先完成技术检查，再把地址交给用户体验。默认不安装浏览器、不跑整套 E2E、不自动发送对话或创建训练。

### 11.1 核对实例和运行区

记录启动命令、实际 PID、工作目录、端口和明确传入的 `DSH_HOME`。不要用会打印全部进程环境的命令收集证据。

如运行区已有 Workspace 登记文件，可用下面的 Node 命令只输出项目数量、ID 和项目路径。在第二个终端先显式设置对应的 `DSH_HOME`，再执行。下面的 Shell 写法用于 macOS/Linux；Windows 可将 `-e` 后单引号包裹的 JavaScript 内容保存为 `.runtime/workspace-check.cjs`，再用 `node .runtime/workspace-check.cjs` 执行，避免旧版 PowerShell 的原生参数转义差异：

```bash
node -e 'const fs=require("node:fs"); const path=require("node:path"); const h=process.env.DSH_HOME; if(!h) throw Error("先设置本次 DSH_HOME"); const f=path.join(h,"storages/workspace.json"); if(!fs.existsSync(f)){console.log("尚无 workspace.json：首次空白运行区需结合界面确认"); process.exit(0)} const d=JSON.parse(fs.readFileSync(f,"utf8")); const ids=d.global?.workspaceIds??[]; console.log(JSON.stringify({dshHome:h,count:ids.length,workspaces:ids.map(id=>({id,path:d.tables?.workspaces?.[id]?.path}))},null,2))'
```

- 全新 B 导入后，应包含本次新建的示例 Workspace，路径指向自己的 `.runtime/fde-agent-sample/project`；首次导入一般为 1 个。
- A 首次空白实例可以没有 Workspace，不能要求出现作者机器上的项目数。
- 复用已有实例时，以接收者已有登记为准，不把“必须 1 个”作为破坏已有数据的理由。
- 工作区不符时先处理启动路径，不能继续声称验收通过。

### 11.2 首页、Boot Manifest 与真实 Bundle

以下脚本读取本实例启动日志中的授权链接，在内存中交换 Cookie 后发送只读请求，不创建会话、不调用模型。将本次启动输出保存在仅本机可读、被 Git 忽略的日志中，设置 `FDE_DEPLOY_LOG` 为该日志路径；不得把授权链接写进命令行、仓库或检查输出。Agent 可将脚本保存为被忽略的 `.runtime/deployment-check.mjs`，完成后可移除。在线资源可能经模块服务转换，不能要求它与本地 lib 文件逐字节相等；本检查确认实际在线插件注册内容，不代替浏览器激活验收。

```javascript
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = new URL(process.env.FDE_DEPLOY_URL || 'http://127.0.0.1:3080');
const fail = (message) => { throw new Error(message); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (!process.env.FDE_DEPLOY_LOG) fail('请设置本实例启动日志路径 FDE_DEPLOY_LOG');
const log = await readFile(process.env.FDE_DEPLOY_LOG, 'utf8');
const authUrl = [...log.matchAll(/dsh web: (http[^\s]+)/g)].at(-1)?.[1];
if (!authUrl || new URL(authUrl).origin !== base.origin) fail('日志中的授权地址不属于本实例');
const exchange = await fetch(authUrl, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
if (exchange.status !== 303) fail('浏览器授权交换失败，请核对当前启动日志');
const cookie = exchange.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const get = (url) => fetch(url, { headers: { cookie, origin: base.origin }, signal: AbortSignal.timeout(15000) });

const home = await get(base);
if (home.status !== 200) fail(`首页状态异常：${home.status}`);
const html = await home.text();
const marker = 'globalThis["__DSH_BOOT__"] = ';
const start = html.indexOf(marker);
if (start < 0) fail('缺少 Boot Manifest：可能启动了错误的服务或裸 Vite');
const end = html.indexOf('</script>', start);
if (end < 0) fail('Boot Manifest script 不完整');
const raw = html.slice(start + marker.length, end).trim().replace(/;$/, '');
const boot = JSON.parse(raw); // 仅解析 JSON，不 eval 页面脚本
if (!Array.isArray(boot.entries)) fail('Boot Manifest entries 无效');

const plugins = [
  ['@deepseek-ai/dsh-client-ui-fde-project', 'ui-fde-project'],
  ['@deepseek-ai/dsh-client-ui-fde-discovery-lab', 'ui-fde-discovery-lab'],
];
for (const [id] of plugins) {
  const entry = boot.entries.find((item) => item.id === id);
  if (!entry) fail(`缺少插件：${id}`);
  const url = new URL(entry.url, base);
  if (url.origin !== base.origin) fail(`拒绝请求非本实例的 Bundle：${id}`);
  const response = await get(url);
  if (!response.ok) fail(`Bundle 请求失败：${id} ${response.status}`);
  const online = Buffer.from(await response.arrayBuffer());
  const script = online.toString('utf8');
  if (!script.includes('__ModuleLoader__') || !script.includes(id)) fail(`在线 Bundle 未包含插件注册：${id}`);
  console.log(`PASS bundle ${id} sha256=${sha(online)}`);
}

const lab = await get(new URL('/api/fde-discovery-lab/cases', base));
if (lab.status === 503) {
  console.log('实验室 API 503：模块未就绪；A/B 可以继续，C 不能验收通过。');
  if (process.env.FDE_EXPECT_LAB === '1') process.exitCode = 1;
} else {
  if (!lab.ok) fail(`实验室接口异常：${lab.status}`);
  const cases = await lab.json();
  if (!Array.isArray(cases)) fail('案例接口没有返回数组');
  const actual = cases.map((item) => item.id).sort();
  const expected = ['finance', 'manufacturing', 'operations', 'internal-service', 'logistics'].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('五案例列表不符合当前基线');
  const app = await get(new URL('/fde-discovery-lab/', base));
  if (!app.ok) fail(`实验室应用入口异常：${app.status}`);
  console.log(`PASS lab cases=${actual.join(',')} app=${app.status}`);
}
console.log('只读技术检查结束；本脚本不证明模型、WebSocket 或人工视觉验收通过。');
```

macOS/Linux：

```bash
cd "$FDE_REPO_ROOT"
FDE_DEPLOY_URL="http://127.0.0.1:$FDE_WEB_PORT" \
  FDE_DEPLOY_LOG="$FDE_REPO_ROOT/.runtime/deployment-server.log" \
  FDE_EXPECT_LAB=1 node .runtime/deployment-check.mjs
```

Windows PowerShell：

```powershell
Set-Location $FdeRepoRoot
$env:FDE_DEPLOY_URL = "http://127.0.0.1:$FdeWebPort"
$env:FDE_DEPLOY_LOG = Join-Path $FdeRepoRoot '.runtime/deployment-server.log'
$env:FDE_EXPECT_LAB = '1'
node .runtime/deployment-check.mjs
```

上面示例要求 C 完成。只部署 A/B 时将 `FDE_EXPECT_LAB` 设为 `0`。即使实验室可用，也不因此触发真实访谈。

该工作台没有在本文中约定通用 `/api/health` 路由；不要把第 12 节业务系统的健康接口用到工作台端口上。检查脚本若因后续版本 Boot 格式变化而失败，先核对实际源码，不能用 `eval` 或关闭所有检查来绕过。

### 11.3 交给用户的人工检查

| 范围 | 人工动作 | 应观察到的结果 |
| --- | --- | --- |
| 所有部署 | 打开工作台地址 | 产品名正确、页面完成加载、无持续连接错误 |
| A | 查看项目中心 | 空白或接收者预期的已有项目，不出现作者私人项目 |
| B | 打开“连锁门店设备故障智能分诊项目” | 八阶段记录可见，当前位置为第八阶段；历史回看不自动推进 |
| B | 查看来源与第四阶段历史图谱 | 仿真原件、历史图谱可见；不声称已重新运行 SDK |
| C | 打开实验室、选择案例和岗位，再返回工作台 | 五案例入口可用，原项目/工作面仍可进入；无需提交访谈 |
| 已授权模型验证 | 使用允许发送的最小测试输入 | 能得到真实回答，记录 Provider/Model 与结果，不记录密钥 |

没有用户反馈时写“技术检查通过，人工体验待确认”，不要用静态截图代替实际操作验收。

## 12. 可选：启动附带的业务系统

这不是工作台服务，也不会因工作台启动而自动运行。先完成 B 导入，再开一个终端。

macOS/Linux：

```bash
cd "/absolute/path/to/FDEDeliveryWorkbench/.runtime/fde-agent-sample/project"
node backend/server.mjs
```

Windows PowerShell：

```powershell
Set-Location 'C:\Projects\FDEDeliveryWorkbench\.runtime\fde-agent-sample\project'
node backend/server.mjs
```

访问 <http://127.0.0.1:4177>。该样例不需要另装业务依赖或配置模型。

健康检查，下面是 macOS/Linux 写法：

```bash
node -e 'fetch("http://127.0.0.1:4177/api/health").then(async r=>{if(!r.ok)throw Error(String(r.status));console.log(await r.json())}).catch(e=>{console.error(e.message);process.exitCode=1})'
```

Windows PowerShell 可使用 `Invoke-RestMethod 'http://127.0.0.1:4177/api/health'`。

当前预期包含 `ok: true`、`mode: "local"`、`modelConnected: false`。这里 `modelConnected: false` 是样例本地运行边界，不是工作台模型配置结果。

端口冲突时使用 `REPAIR_PORT`，例如 macOS/Linux：

```bash
REPAIR_PORT=4178 node backend/server.mjs
```

PowerShell 则先设置 `$env:REPAIR_PORT = '4178'`，再执行启动命令。

如用户需要业务演示，可手动选择 `R-1002` → 分析 → 查看关联证据 → 人工核对并保存本地草稿。保存会修改示例项目的数据，不能作为默认只读验收自动执行。

新增业务记录位于该项目的 `.runtime/maintenance/`。系统不会自动正式派单、通知客户或承诺费用。不要在受控的 `source-materials/fde-agent/project/` 内启动并产生工作数据。

工作台“启动/预览”状态需关联本机真实进程；历史证据或单独打开 4177 页面，不等于工作台已经登记为运行中。

## 13. 可选：Semantica 重建与查询环境

**只查看分享示例的历史图谱，不需要安装本节环境。** 本节仅适用于接收者明确要求重新抽取、构建、验证或使用相关 SDK 运行能力。

当前 Adapter 面向 Semantica `0.6.7`。接收者需要按该版本的可信安装说明准备自己的环境；源码不包含 SDK、虚拟环境或可照搬的作者机器路径。不要猜测一个同名 pip 包就安装，也不要默认升级到最新版。

准备后配置：

```dotenv
FDE_SEMANTICA_PYTHON=/absolute/path/to/semantica/.venv/bin/python
FDE_SEMANTICA_SOURCE=/absolute/path/to/semantica
```

`FDE_SEMANTICA_SOURCE` 用于确有需要的 SDK 源码路径；以自己的安装方式为准。可以将非密钥配置放在当前 `DSH_HOME/.env`，启动仍须显式传入同一个 `DSH_HOME`。

当前规则管线不需要模型 API Key，但通过工作台 Agent 对话驱动工具时，Agent 对话本身可能使用模型。不要把两种费用与依赖混为一谈。

SDK 健康、候选抽取、人工审核、定义发布、建图、结构验证、业务切片和 FDE 决定是不同步骤。缺少当前证据时，应如实标为待核对；不得改 `PASS`、摘要或阶段状态“修好”示例。

具体运行合同见 [Semantica 集成说明](upstream/deepseek-harness/packages/fde/semantica/README.zh.md)。没有明确要求重建时，报告“历史图谱可查看，Semantica 重运行未配置”即可。

## 14. 网络模式：本机、远程单人、可信 LAN

### 14.1 默认本机访问

始终使用 `--host 127.0.0.1`。默认部署不是公网应用，也没有因此获得公网发布授权。

### 14.2 远程 Linux 上供本人访问

如果用户明确要求在自己的远程机器部署，仍可让工作台只监听远程 `127.0.0.1:3080`，然后在用户电脑建立 SSH 隧道：

```bash
ssh -N -L 3080:127.0.0.1:3080 user@your-server
```

再在用户电脑访问 <http://127.0.0.1:3080>。如果本地端口有占用，调整转发左侧端口并同步访问地址。SSH 认证与服务器操作权限由用户自行管理，不复制私钥进项目。

这个方案不自动解决工作台创建的所有业务预览端口、`*.localhost` 域名或本地桌面能力。远程工作台可访问，不等于独立业务系统已经发布。

### 14.3 只有明确要求时才开启可信局域网

停止本次自己的本机实例后，保持相同运行区；先把 `FDE_LAN_IP` 设置为该机器的具体局域网 IP（PowerShell 使用 `$FdeLanIp`），再运行：

```bash
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
DSH_HOME="$FDE_DSH_HOME" \
  corepack pnpm dsh web --no-open --host "$FDE_LAN_IP" --port "$FDE_WEB_PORT"
```

PowerShell 同理：先设置 `$env:DSH_HOME`，再执行 `corepack pnpm dsh web --no-open --host $FdeLanIp --port $FdeWebPort`。

- 旧 `--lan` 已退役；使用 `--host` 指定一个真实本机地址，仅监听该地址。
- 不使用 `0.0.0.0` 或 `::` 通配监听地址。
- 按日志中的实际局域网 IP 访问；不能把作者电脑 IP 写死给接收者。
- 本机和 LAN 均要求浏览器授权。每台获准设备打开启动日志中的授权链接，裸 IP 在授权前返回 401；不要公开令牌。FDE 接口只接受 owner 身份。
- 凭据、部分系统设置和原生桌面能力仍限本机；LAN 页面被拒绝修改特权设置不是让你关闭安全校验的理由。
- `--trusted-host` 不是登录鉴权，不应被当作公网安全方案。
- 不自动修改云安全组、路由器映射、反向代理、隧道公开地址或防火墙全局规则。

LAN 完成标准需增加：实际另一台设备能打开页面、读取相关 FDE 数据，且 WebSocket 连接正常。只在服务器本机 curl 局域网地址，不能替代客户端验收。

## 15. 数据、备份、停止与后续更新

### 15.1 哪些是数据，哪些可重建

| 路径 | 性质 | 保留与清理原则 |
| --- | --- | --- |
| `source-materials/fde-agent/` | 受版本管理的分享原件 | 不在里面产生工作数据；不要手动改摘要清单 |
| 实际 `DSH_HOME` | Workspace 登记、会话、配置等 | 用户数据，不是缓存；包含敏感内容，不随源码分享 |
| 示例导入后的 `project/` | 用户可工作的项目与阶段证据 | 单独保留；只备份 `DSH_HOME` 不等于备份项目文件 |
| 项目自己的 `.fde/`、`fde-resources/` | 阶段证据与原件等 | 随实际项目一起保存 |
| `DSH_HOME/fde-discovery-lab/` | 训练数据库与相关状态 | 保留训练时不能删除；还要保留 Host 原生 Session 记录 |
| 实验室包 `.assets/` | 可由授权 ZIP 重新导入的素材 | 保留合法来源与许可；不是训练历史 |
| `node_modules/`、`lib/`、Web 构建目录 | 可由源码与锁文件重建 | 不进普通 Git 历史；清理后需重装/重建 |
| `.runtime/deployment-check.mjs`、可选 `workspace-check.cjs` | 本文检查脚本的本地副本 | 交付后可移除，不影响工作台 |

`.runtime/` 整体包含真实用户数据，不能因为它被 Git 忽略就当作可批量删除的缓存。

### 15.2 正确停止与常驻

前台启动时，在对应终端按 `Ctrl+C`，只停止本次工作台。示例业务系统有自己的终端，需要分别停止。

若 Agent 使用受管理的终端任务启动，应交付真实任务/PID 和重启命令，并确认它不会在 Agent 会话结束时意外退出。不能只报告一个已经失效的工具内部会话编号。

需要常驻时，再按用户系统选择已有进程管理方式。没有明确要求，不新增 `launchd`、`systemd`、开机启动、Docker 服务或后台守护配置。应用源码部署与操作系统常驻服务是两个范围。

### 15.3 备份与迁移

备份前停止相关写入，保存：实际项目目录、完整 `DSH_HOME`、非公开配置及需要的合法素材来源。备份可能含凭据与客户资料，应存放在受控位置，不进入源码包或公开云链接。

实验室 SQLite 活跃时可能有 WAL/SHM 文件。优先正常停止 Host 后备份完整运行区；不要运行时只复制一个 `training.sqlite` 就宣称一致备份完成。

项目原件的字节与高精度修改时间会参与证据判断。跨设备复制时使用能保留时间精度的方式并验证；不要用会截断时间的复制方法后直接把 `stale` 状态改回通过。

跨机器迁移涉及 Workspace 绝对路径、Session header 工作目录等，不是只拷贝文件夹就一定有效。不要直接改压缩日志或将整个 Session 解压后重压为单个 frame。接收者首次部署优先使用分享素材导入，不迁移作者会话。

### 15.4 更新源码

仅在用户要求升级时执行。更新前记录当前源码版本、工作区改动、实际数据位置，并在需要时完成受控备份。

Git 路径的基础命令，在仓库根目录执行：

```bash
git status --short
git rev-parse HEAD
git pull --ff-only
```

如果有本地改动或不能 fast-forward，停止并说明，不擅自 stash、reset、rebase 或覆盖。

之后在 Harness 目录重新执行锁文件安装与完整构建，停止旧的本次实例，用**相同的实际 `DSH_HOME`** 重启，再做直接受影响的验收。ZIP 更新则使用新交付版本和对应提交哈希，不将新包覆盖到含用户数据的旧目录上。

重要区别：

- Git 更新不会自动升级已经导入的示例项目，也不会迁移 `.runtime/` 数据。
- `.assets/` 不在 Git，实验室素材版本变化需要对应授权交付物和明确迁移方案。
- Client 改动需要重新 bundle；仅重启 Host 不会把 TypeScript 源码自动变成新浏览器代码。
- 有针对性开发时可按包说明只构建受影响包；首次部署与一般接收者更新使用完整构建更直接。
- 数据迁移不一定能通过回退源码撤销，不能把 `git checkout` 当作完整数据回滚。

## 16. 常见故障与最小处理

| 现象 | 优先检查 | 合理处理，不越过的边界 |
| --- | --- | --- |
| `corepack: command not found` | Node 安装方式、PATH | 说明并补齐匹配的 Corepack；不擅自全局重装所有 Node |
| pnpm 版本不符 | 当前目录、`packageManager` | 进入 Harness 后用 Corepack；不改锁文件适配错误工具 |
| frozen lockfile 安装失败 | 源码/锁文件是否同一版本、完整错误 | 先修复交付完整性；不删除锁文件再安装 |
| GitHub tarball / registry 下载失败 | 网络、代理、证书、锁定下载地址 | 恢复合规访问；不随意换第三方源码或关闭 TLS 校验 |
| 缺少 node-pty 等原生模块 | Node/系统架构、安装脚本、对应包错误 | 按具体错误补工具链；不删除该依赖绕过 |
| 原生编译要求 Python / make / C++ | 是否确实进入源码编译 | 经说明安装平台构建工具；不要默认每台机器都全装 |
| lefthook Hook 配置冲突或警告 | 仓库位置、已有 Hook 配置 | 保留用户 Hook；分清提交工具问题与 Web 运行问题 |
| ZIP 构建报无法读取 Git commit | `.git` 是否存在、版本是否已提供 | 设置对应真实 `DSH_CLIENT_COMMIT_HASH`；不造假 |
| 首页出现裸 Vite / Boot Manifest 缺失 | 启动入口与端口 | 从 Harness 启动 `dsh web`，不是仅启动前端 |
| 首页 200 但界面还是旧版 | 实际进程 cwd、Manifest Bundle、本地构建 | 修正实例/重新构建对应包并重启；不先清掉运行数据 |
| 导入后项目中心为空 | 实际 `DSH_HOME` 与导入输出 | 启动到导入器给出的运行区；不手动重建假阶段 |
| 示例导入提示目标已存在 | 是成功旧实例还是失败残留 | 保留现场，复用成功实例或选新路径；不自动删除 |
| 刚复制资料就显示 `stale` | 原始内容与 `mtimeMs` | 用正确导入或保精度迁移；不直接修改证据状态 |
| 工作台端口被占用 | 监听 PID 是否属于本任务 | 复用明确的本次服务或换空闲端口；不杀其他项目 |
| 实验室 API 返回 503 | 素材是否导入、Host 初始化日志 | 导入授权包并重启；A/B 仍可单独交付，C 不通过 |
| 实验室 UI 提示未构建 | Client 完整构建是否成功 | 重新构建实验室 Client/完整工程；不修改原始 HTML 冒充修复 |
| ZIP 摘要或内部路径不符 | 交付版本和文件完整性 | 索取正确包；不关闭校验、不改名假装版本匹配 |
| `python3` 找不到 | 导入入口与运行时解释器各自配置 | 导入用真实解释器；运行设置 `FDE_PYTHON` |
| 实验室模型认证失败或找不到模型 | Provider、模型 ID、凭据来源与授权 | 由用户核对正确配置；不输出 Key，不连续重试计费 |
| 项目切换模型后实验室没变 | `DEEPSEEK_PROVIDER/MODEL` | 按独立路由配置并重启，不改项目选择器逻辑 |
| LAN 403、设置不可编辑、WebSocket 失败 | 实际访问 Host/端口、LAN 模式、特权限制 | 按安全合同使用；不把关闭 Origin 校验当成部署步骤 |
| 历史图谱可见但重建失败 | Semantica SDK/解释器及当前证据 | 按可选能力处理；不声称历史展示证明 SDK 已安装 |
| 示例业务系统 4177 不通 | 是否单独启动、端口占用 | 在导入项目中启动；与 3080 工作台分别排查 |
| 重启后配置/历史不见了 | 新终端变量、运行路径是否一致 | 找回正确运行区；不要复制作者个人配置覆盖 |

诊断日志只保留必要、脱敏的错误片段。不要把整个项目资料、Session 内容或环境变量作为“排障附件”自动上传。

## 17. Agent 最终部署记录模板

完成后直接在交付回复中填写；如果用户需要文件，再保存到其认可的被忽略运行目录。部署记录不应夹带密钥、完整环境或私人聊天。

```text
FF - FDE 交付工作台部署结果

一、版本与环境
- 源码来源 / 提交：
- 源码绝对路径：
- 系统 / 架构：
- Node / pnpm：
- 部署范围：A / B / A+C / B+C

二、访问与进程
- 工作台地址：
- 网络范围：仅本机 / 经授权的可信 LAN / SSH 隧道
- 实际进程 PID 或可持续管理方式：
- 启动工作目录：
- 实际 DSH_HOME：
- 工作项目路径：
- 停止方式：
- 完整重启命令（含绝对路径与 DSH_HOME，不含密钥）：

三、验收结果
- 锁文件安装：通过 / 失败；退出码：
- 完整构建：通过 / 失败；退出码：
- 首页 / Boot Manifest / Bundle 一致性：
- Workspace 登记与路径：
- 实验室素材 / 五案例 / Python：通过 / 未配置 / 不适用
- 示例业务系统：通过 / 未启动 / 不适用
- 模型：已授权并验证 / 已配置但未调用 / 未配置
- Semantica：已验证 / 未配置 / 不适用
- 人工体验：已确认 / 待确认
- LAN 客户端与 WebSocket：已确认 / 待确认 / 不适用

四、数据与边界
- 新建持久目录、用途与近似大小：
- 必须保留的数据：
- 可重建产物与安全清理条件：
- 本次未做的事项：
- 剩余问题及最小下一步：
```

如 C 缺少素材或模型尚未授权，应明确区分“工作台部署完成”“实验室素材未就绪”“模型调用未验证”，不要统一写成“全功能正常”。

## 18. 源码分享者的交付清单

给接收者分享前，应确保：

- 提供完整源码以及本文件；不能只给根目录 `frontend/`、截图或已构建页面。
- 写明实际源码版本；无 `.git` 的 ZIP 必须另附其真实提交哈希。
- 保留锁文件、Workspace 配置、`vendor/`、`patches/`、必要点文件与第三方许可。
- 需要示例时保留 `source-materials/fde-agent/`，不把作者实际 `.runtime/` 当作示例替代品。
- 需要完整实验室时，另行提供有权交付的匹配 ZIP，说明其授权范围；不承诺 Git 克隆会带上它。
- 不附带 `node_modules`、构建目录、私人配置、密钥、会话日志、虚拟环境或机器专属绝对路径。
- 原项目包与依赖的 LICENSE / NOTICE / 来源说明继续保留；私有源码分享不代表所有嵌入素材可公开发布。
- 先由一个接收环境按本文实际走完，再将该环境结果作为对应平台部署证据，不用作者现有机器的运行结果代替。

本文不执行源码打包、上传或仓库发布；需要这些操作时应作为单独明确任务处理。

## 19. 源码依据与进一步说明

遇到本文与后续源码不一致时，以当前交付版本的真实合同为准，并在部署记录说明差异。

| 主题 | 仓库内依据 |
| --- | --- |
| 项目运行规则与隔离要求 | [AGENTS.md](AGENTS.md) |
| 产品范围与快速启动 | [README.md](README.md) |
| Node、pnpm 与脚本 | [Harness package.json](upstream/deepseek-harness/package.json) |
| Workspace 与依赖构建许可 | [pnpm-workspace.yaml](upstream/deepseek-harness/pnpm-workspace.yaml) |
| 完整构建流程 | [build.ts](upstream/deepseek-harness/scripts/build.ts) |
| 无 Git 元数据时的提交哈希处理 | [client-build-environment.ts](upstream/deepseek-harness/scripts/client-build-environment.ts) |
| 示例数据与导入合同 | [素材说明](source-materials/fde-agent/README.md)、[load.mjs](source-materials/fde-agent/load.mjs) |
| 实验室安装、模型与限制 | [实验室说明](upstream/deepseek-harness/packages/fde/discovery-lab/README.zh.md) |
| 实验室来源与素材许可边界 | [SOURCE.md](upstream/deepseek-harness/packages/fde/discovery-lab/SOURCE.md) |
| 实验室授权素材导入 | [import-assets.py](upstream/deepseek-harness/packages/fde/discovery-lab/scripts/import-assets.py) |
| Semantica 可选运行环境 | [Semantica 说明](upstream/deepseek-harness/packages/fde/semantica/README.zh.md) |
| 凭据读取与保存规则 | [Credentials 说明](upstream/deepseek-harness/packages/credentials/credentials-local/README.zh.md) |

---

`@赋范空间 独家研发`

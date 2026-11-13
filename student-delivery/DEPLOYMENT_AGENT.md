# Agent 部署手册（学员源码包）

先读取 README.md、AGENTS.md、SOURCE_VERSION.json。默认范围为工作台、内置 Skills、门店仿真示例、五案例实验室素材和中文挑战；只有 Python 计算环境与真实模型需要按能力配置。本文件不授权改业务代码、升级依赖或访问既有凭证。

## 1. 先检查

从解压根运行 `node verify-source.mjs`，核对包内摘要与五案例必需文件。检查 Node 24.x（至少 24.9.0）、Corepack、可用磁盘及 3080 端口。缺工具先报告安装方案；不要擅自 sudo、关闭系统安全或重装全局 Node。确保解压目录不在另一个 Git 仓库中，以免安装钩子误作用于外层仓库。

源码包没有 .git，这是正常情况。完整构建必须使用 SOURCE_VERSION.json 的 sourceCommit 作为公开构建信息；该变量不能放 API Key。

## 2. macOS / Linux

从解压根开始，在同一终端逐步执行：

```bash
node verify-source.mjs
export FDE_REPO_ROOT="$PWD"
export DSH_CLIENT_COMMIT_HASH="$(node -p 'require("./SOURCE_VERSION.json").sourceCommit')"
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm run build
cd "$FDE_REPO_ROOT"
node --test source-materials/fde-agent/load.test.mjs source-materials/fde-agent/project/backend/tests/workflow.test.mjs
node source-materials/fde-agent/load.mjs
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
DSH_HOME="$FDE_REPO_ROOT/.runtime/fde-agent-sample/dsh-home" \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

安装需要网络。必须保留安装脚本与仓库声明的依赖构建许可，不加 --ignore-scripts。任何一步非零就停止后续步骤，处理首个真实错误。不要为了消除错误切到全局 Harness、裸 Vite 或其他版本。

## 3. Windows PowerShell

从解压根开始，逐条执行；外部命令失败时检查 `$LASTEXITCODE` 并停止：

```powershell
node verify-source.mjs
$FdeRepoRoot = (Get-Location).Path
$env:DSH_CLIENT_COMMIT_HASH = (Get-Content -Raw .\SOURCE_VERSION.json | ConvertFrom-Json).sourceCommit
Set-Location (Join-Path $FdeRepoRoot 'upstream/deepseek-harness')
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm run build
Set-Location $FdeRepoRoot
node --test source-materials/fde-agent/load.test.mjs source-materials/fde-agent/project/backend/tests/workflow.test.mjs
node source-materials/fde-agent/load.mjs
Set-Location (Join-Path $FdeRepoRoot 'upstream/deepseek-harness')
$env:DSH_HOME = Join-Path $FdeRepoRoot '.runtime/fde-agent-sample/dsh-home'
corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

Windows 原生未在本轮实测。若需要本机编译原生依赖，依据具体错误说明所需工具链，再由用户确认安装；不删除原生模块。样例导入器要求保留文件时间精度，目标盘不支持时应停止导入并换用支持的本地目录，不能重新签摘要。

## 4. 访问、核对与使用

- 首次通过 Host 输出的授权链接建立 Cookie，随后才能访问普通 3080 地址。不得将授权参数、Cookie、API Key 粘贴到公共消息或提交。
- 授权后的首页应为 200 且含 `__DSH_BOOT__`，其中包括 ui-fde-project、ui-fde-discovery-lab 等实际插件；请求其中的同源资源应成功。未认证的 curl 响应不代表 Host 失败。
- 新建默认配置的 Boot Manifest 应包含唯一 `dsh-context`，无需再次安装上下文洞察。默认皮肤为“官方原版”；恢复已有数据时保留合法个人皮肤和插件禁用配置，不强制重置。
- 新导入的 `.runtime/fde-agent-sample/dsh-home/storages/workspace.json` 仅登记本次门店示例，项目路径在本包的 `.runtime/fde-agent-sample/project`。不应出现讲师个人项目或其他实例。
- 工作台没有约定 `/api/health`；这个接口属于可选维修业务系统的 4177 端口。
- 打开平台、进入示例、阅读资料与 Skills 不需要模型。让用户人工查看导航、阶段材料及设置，不能把 HTTP 200 宣称为全部视觉或模型能力验收。
- 学员在本机设置中配置自己的模型服务。调用前获得费用与数据外发授权，不读取编程 Agent 已登录账号或既有凭证库。

## 5. 实验室与可选运行能力

实验室素材随源码完整提供，无需另行下载 ZIP。从解压根检查：

```bash
node upstream/deepseek-harness/packages/fde/discovery-lab/scripts/verify-assets.mjs
```

应通过 5 案例、234 份引用资料、248 文件校验；授权后 `/api/fde-discovery-lab/cases` 必须返回这五个案例，503 不能跳过。计算需要 Python 3.9+，可用 `FDE_PYTHON` 指定路径；访谈和报告需要用户自己的模型。实验室模型路由独立于项目选择器，详见 `upstream/deepseek-harness/packages/fde/discovery-lab/README.zh.md`。

如只需空白工作台，跳过样例导入，显式使用根目录 `.runtime/dsh-home` 启动；不要再要求空白运行区出现门店样例。Semantica 重建另行准备，不影响已有图谱阅读。

## 6. 停止、重启与问题处理

在本次启动终端按 Ctrl+C，只停止本进程。重启复用同一 DSH_HOME；不重复安装、构建或导入，除非源码或依赖确实变化。关闭窗口不等于删除数据，.runtime 应单独备份；更新版本请解压到新目录，再安排明确的数据迁移。

| 现象 | 最小处理 |
|---|---|
| authentication required | 使用本次进程输出的授权链接，不能关闭鉴权 |
| 缺少 Git 提交信息 | 从包内 SOURCE_VERSION.json 设置 DSH_CLIENT_COMMIT_HASH |
| 包缺文件、摘要不符 | 重新领取或解压 ZIP，不能忽略校验继续部署 |
| 依赖下载失败 | 核对网络、公共注册表与锁定 GitHub URL，不要求原私有 OpenAPI 权限 |
| 示例目标已存在 | 复用已成功导入目录，或明确另选新目录；不覆盖 |
| 端口占用 | 改本次端口，不杀死其他服务 |
| 构建后界面旧 | 确认启动的是本包目录，完成完整 build 后重启并刷新 |
| 实验室未就绪 | 检查内置素材完整性；重新获取完整源码、构建并重启，不删除训练历史，不跳过验收 |

最终向学员报告：实际源码版本与路径、系统/Node/pnpm、安装/构建/测试结果、访问方式、DSH_HOME、停止重启命令、模型/实验室等未配置项。未经要求不继续开发或发布。

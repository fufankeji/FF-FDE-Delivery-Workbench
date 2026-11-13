# FF - FDE 交付工作台 · 学员源码包

先向助教领取 ZIP，解压到自己有写权限的本地目录，进入唯一根目录 `FDEDeliveryWorkbench`，再进行环境检查、安装与启动。不要把新包覆盖到已有项目或数据目录中。

本包包含当前 FF-FDE 工作台、五案例实验室完整运行素材、中文场景挑战和门店仿真示例。实际源码提交由打包时写入的 `SOURCE_VERSION.json` 记录；底层锁定 DeepSeek Harness 0.2.2-rc.2。

## 交给自己的 Agent

复制以下任务，并提供实际解压路径：

```text
请部署此文件夹中的 FF - FDE 交付工作台。
先读取根目录 AGENTS.md、SOURCE_VERSION.json、DEPLOYMENT_AGENT.md。
默认本机访问，导入附带的连锁门店示例，安装锁定依赖并完整构建。
先核对环境和源码完整性，告诉我将使用的端口、运行目录和缺失依赖。
不改业务源码，不升级依赖，不开放公网，不读取我的既有凭证。
没有我的明确授权，不调用付费模型或向外发送项目资料。
完成最小技术检查后，给我首次授权访问方式、普通地址、数据目录、
停止与重启命令，以及哪些能力仍未配置。不要只输出部署教程，请实际执行。
```

## 系统要求

- 使用 Node.js **24.x，至少 24.9.0** 和 Corepack，工程锁定 pnpm **11.28.5**；不要随意升级到其他大版本。
- 首次安装需要访问公共 npm 注册表及锁定的 GitHub 下载地址，源码包不等于离线安装包。原私有 `dsh-openapi` 已随源码放入 `third-party/dsh-openapi`。
- 依赖与构建会占用数 GiB，先检查磁盘；本包不带 `node_modules`、编译产物或浏览器环境。
- 默认本机 Web 使用不需要数据库服务、Docker 或付费模型。真实 Agent 对话和模型评估需要学员自己的模型服务。
- 实验室计算需要 Python 3.9+；五案例静态内容已随包提供，案例浏览与中文挑战不需要模型密钥或额外素材 ZIP。
- macOS 本轮执行独立解压验收；Linux、Windows 的命令见手册，目标机器仍须验证原生依赖，不能把命令可写等同于跨平台实测。

工具来源：[Node.js](https://nodejs.org/en/download)、[pnpm](https://pnpm.io/installation)。仍以本包的版本声明为准。

## 从解压目录开始

所有以下命令都从解压根目录执行；macOS/Linux：

```bash
node --version
corepack --version
node verify-source.mjs
export FDE_REPO_ROOT="$PWD"
export DSH_CLIENT_COMMIT_HASH="$(node -p 'require("./SOURCE_VERSION.json").sourceCommit')"
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm run build
```

每一步退出码为 0 后才继续。完整的 Windows PowerShell 命令、认证检查和故障处理见 [Agent 部署手册](DEPLOYMENT_AGENT.md)。不需要把示例 API Key 保存为 .env；本包没有预置真实配置，模型凭证在启动后由学员通过设置自行填写。

### 导入与启动

```bash
cd "$FDE_REPO_ROOT"
node source-materials/fde-agent/load.mjs
cd "$FDE_REPO_ROOT/upstream/deepseek-harness"
DSH_HOME="$FDE_REPO_ROOT/.runtime/fde-agent-sample/dsh-home" \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

首次打开终端输出的带授权参数链接，之后使用 `http://127.0.0.1:3080`。直接访问普通地址可能显示 `authentication required`，不是启动失败。若端口占用，换空闲端口并同步访问地址，不终止其他服务。重启时只重复启动命令，不再次导入。

在启动终端按 `Ctrl+C` 停止，`.runtime/fde-agent-sample` 内的项目、会话和后续记录保留。它不是缓存，不能作为清理依赖的一部分删除。备份时同时保留其中的 `project` 与 `dsh-home`。

### 开始使用

1. 点击“进入平台”，在总览或项目中心打开门店示例。
2. 示例初始位置为第八阶段，可回看第一至八阶段的资料、产物和证据。历史结果不是本机刚刚执行的测试，也不代表真实客户签收。
3. 在技能中心阅读或下载完整 Skills；创建自己的项目后，由自己的模型配置驱动项目内 Agent。
4. 进入实验室即可选择五个业务案例，或进行中文五分钟挑战。案例、资料、计算脚本与报告字体均已包含；不需要向助教再索取旧素材 ZIP。
5. 发起真实 Agent 对话前，在设置中配置学员自己的服务；不要把编程 Agent 的账号与工作台的模型配置混为一谈。

### 构建、测试与示例业务系统

在解压根目录运行：

```bash
node --test source-materials/fde-agent/load.test.mjs source-materials/fde-agent/project/backend/tests/workflow.test.mjs
```

完整构建仍使用前述 `corepack pnpm run build`。不把全仓测试作为基础部署前置条件；其部分测试需要额外素材或特定环境。

完成导入后，可在第二个终端运行附带的维修业务系统：

```bash
cd .runtime/fde-agent-sample/project
node backend/server.mjs
```

访问 `http://127.0.0.1:4177`，健康接口为 `/api/health`。它采用本地规则，不调用模型、不执行正式派单。工作台 3080 与示例业务 4177 是两个独立进程；各自用 `Ctrl+C` 停止。业务端口冲突可设置 `REPAIR_PORT`。

## 明确边界

- 不含作者凭证、个人会话、真实客户数据库或正在运行的项目副本。
- 五案例实验室素材必须通过包内校验，缺失或损坏时重新领取完整源码，不删除训练记录。访谈、核对和报告生成仍需要自己的模型配置。
- 查看已有图谱不需要 Semantica；重新构建图谱需另行准备其兼容环境，不在本次基础部署验收内。
- 保留第三方许可证和声明；仅在课程授权范围使用，不因领取源码而取得所有素材的公开再分发权。
- 源码测试中的虚拟路径、门店仿真样例中的历史路径不是运行配置；不按这些路径寻找讲师文件，不修改历史摘要。

`@赋范空间 独家研发`

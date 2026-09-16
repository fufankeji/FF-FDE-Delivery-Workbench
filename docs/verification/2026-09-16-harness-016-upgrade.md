# 官方 Harness 0.1.6-alpha.1 升级验证

日期：2026-09-16。状态：实现与无密钥验证完成，待人工界面验收；未切换 main 工作台，未推送远端。

实现提交：`d3879e03c4`。提交钩子提示 `Can't find lefthook in PATH`，因此不声称钩子已运行；本文列出的构建与检查均已单独执行。普通源码的 diff whitespace 检查通过；pnpm 生成的补丁包含格式必需的空格前缀和 Tab 上下文，不能用改写这些字节的方式消除 patch 文本告警，补丁应用与运行代码已另行验证。

产物在提交前构建，构建记录保留当时的 `337cd32` 与 `GIT_DIRTY=true`，不是该提交的干净构建标记；实际在线 Bundle 已与对应构建代码核对。没有仅为提交重复构建。

## 输入与隔离

- 下游基线：`337cd32a63a7042ccfd2ade412619ee41441f4c1`。
- 官方基线：`b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` → `0a15e36e7f82b6ed45af6fa9759f29b40dcd965d`。
- 分支：`feature/harness-016`；工作区：`.worktrees/harness-016`。
- 主工作树原有 README 改动和未跟踪 DEPLOYMENT_AGENT.md 保留，原 3080 服务未停止或切换。
- 隔离项目来自 `/Users/muyu/FDE-Agent/fde-agent`，247 个文件、19,557,301 字节，逐文件内容和纳秒修改时间一致。
- 仅复制该项目的两条历史会话及对应 Workspace/阶段登记。会话只在隔离副本改写首个 header frame 的 cwd，后续压缩 frame 原字节保留；没有复制模型凭据。

## 构建与接口适配

| 检查 | 结果 |
| --- | --- |
| `corepack pnpm install --no-frozen-lockfile` | pnpm 10.34.5 成功；已更新锁文件。11.7.0、11.24.0 均复现 peer 解析器异常，未修改全局包管理器源码 |
| `build:native-system` | darwin-arm64 原生模块构建成功 |
| `build:lib:host` | Host 类型检查及全部 Host 包打包成功 |
| `build:lib:client`、`build:web` | Client 类型检查、打包及 Web 构建成功 |
| 完整构建记录 | 按根 build 同一环境完成上述阶段，生成包含 270 个 Client 产物的 `.dsh-build/client-build-environment.json`；版本为 0.1.6-alpha.1 |
| `build:fde-integrations` | 固定的 eval 0.4.0 Git 源码编译成功；识别 v3 会话文件 |
| `tsc -b tsconfig.host.json tsconfig.client.json` | 后续接口与测试夹具调整后的聚合类型检查通过 |
| `verify-client-packages` | 59 个 Client 包通过包模式与模块请求检查 |
| 官方 Agent Loop | 当前 8 个 src 文件逐字节匹配官方目标提交，未添加下游 Loop 修改 |

首次根 build 在大量升级变更下遇到 `git status` 输出超过 spawnSync 缓冲区，已将该具体调用缓冲区提高到 16 MiB。随后原生与 Host 阶段通过，Client 的 compiler face 问题修复后续跑 Client/Web 阶段并生成相同格式的完整构建记录；最后的空白会话呈现修正仅重新构建 Conversation 包并更新记录。没有把失败命令标成通过。

## 定向回归

- Client：项目入口、最近会话选择、工作区创建/排序、阶段、资料入口、独立实验室导航、预览 Origin/allowlist、终端定位等共 104 项定向测试最终通过。仅重跑失败或输入变化的项。
- Conversation：22 项壳层测试通过，覆盖空白会话、正文切换、输入框稳定性、项目文案、无 Preview 标签、交互与回退。
- 用量活动：3 项通过，覆盖最终回执替换、跨日归属、取消及缓存恢复；测试夹具已使用新格式的 assistant/attempt 和嵌入 stream。
- 实验室业务规则：33 项最终通过；其中 4 项原生接口夹具随异步历史读取和 stat 接口调整后定向重跑通过。
- 实验室 Loader 组合：真实 Agent Loop、Tools、Session、JSONL、HTTP，加离线 LLM，验证角色隔离、资料授权、访谈、核对、普通项目工具保留和重启恢复。另由实际 eval 收集器读取该测试生成的 `session.v3.jsonl`，正确提取回答和工具调用。
- 未运行付费模型、浏览器自动化、截图、录屏或全量 E2E。

## 在线实例

实例使用本 worktree 的 `upstream/deepseek-harness/` 与显式 `DSH_HOME=../../.runtime/dsh-home`，仅绑定 `127.0.0.1:3082`，OpenTelemetry 禁用。首次访问按官方登录链接取得 Cookie。

- 配置中的 Host 插件无未激活告警；最初无法导入的 eval、observe 已修复并重启验证。Client 的真实视觉体验仍待人工确认。
- 已认证首页 HTTP 200。
- 阶段 open、项目 snapshot、资料 list、用量和实验室 cases 接口返回 HTTP 200。
- 项目资料 35 份：31 ready、1 unsupported、3 needs-ocr，无复制引入的 stale；后两类属于既有解析边界。
- 两条旧格式会话都成功通过官方迁移读取，用量均为 ready；不以重新创建空会话替代历史恢复。
- 实验室返回五案例，读取列表未创建训练轮次或发送消息。
- Boot Manifest 中六个 FDE Client 包、Better Sidebar 和 File Review 的实际在线代码与本地构建一致。服务器会追加结尾分号并改写 sourceMappingURL，比较时只去除这两项传输包装。
- 最终监听 PID 74189，cwd、显式 DSH_HOME 与单一 Workspace 登记均为升级隔离区；最终 Conversation 包也已重新核对在线代码。

## 交付边界与清理

人工界面与真实模型体验仍待用户确认。尤其应确认新版官方右侧面板布局、项目阶段空白页与对话切换、文件审查和终端/预览交互。当前验收不代表付费 Eval、实际模型访谈或生产部署已运行。

升级说明见[架构记录](../architecture/harness-016-upgrade.md)。main 与原数据仍是事实源；不要把隔离预览数据误当成主运行区。完成源码合并和人工验收、保存任何独有新数据后，可移除整个升级 worktree；依赖、构建、实验室素材和 `.runtime` 都可重建。清理前须检查提交包含关系和 tracked/untracked 状态。

依赖、构建和运行日志被 Git 忽略；没有提交生成的 lib、dist、源码 ZIP 或媒体。Corepack 下载的 pnpm 10.34.5 位于用户 Corepack 缓存中，可在不再需要该版本时删除并按需重新下载；共享 pnpm 内容仓库不应随本次工作区直接删除。

| 持久目录 | 大小 | 用途与安全清理条件 |
| --- | --- | --- |
| `/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.worktrees/harness-016` | 约 2.6 GB | 本次源码、依赖、构建和隔离预览；合并、验收并保存独有新数据后按 worktree 规则移除 |
| `/Users/muyu/.cache/node/corepack/v1/pnpm/10.34.5` | 约 22 MB | Corepack 缓存；不再使用该工具版本后可删，后续可重新下载 |

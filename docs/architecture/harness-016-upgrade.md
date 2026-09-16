# 官方 Harness 0.1.6-alpha.1 适配

状态：实现与无密钥验证完成，等待人工界面验收。用户于 2026-09-16 授权升级。主工作台未切换；隔离实例使用 3082。

## 固定输入

- 下游基线：337cd32a63a7042ccfd2ade412619ee41441f4c1。
- 旧官方提交：b150a551b8d465e31e418e1b2eaf5e79bbb7d28e（0.1.1-rc.2）。
- 目标：dsh-v0.1.6-alpha.1，0a15e36e7f82b6ed45af6fa9759f29b40dcd965d。
- 独立工作区：.worktrees/harness-016；主运行区与未提交文件保持原状。

## 行为与实施边界

保留项目中心、多会话、V1 六阶段与 V2 八阶段、资料识别、人工决定、运行预览、API 文档、架构、用量、评估、主题和独立实验室。升级不授权新计费调用或开启遥测外发。先移入官方新源码，再适配直接受影响插件与配置。官方默认改变若涉及现有产品合同，保持现有行为并明确记录。

因官方树位于下游子目录，将旧、新官方树各包裹到 upstream/deepseek-harness/，使用 git merge-tree --merge-base=<旧映射树> 对当前下游树与新映射树做三方合并。以完整旧树做冲突合并，不依赖浅克隆中不完整的祖先关系；记录精确基线使后续升级可重复。冲突逐文件处理，不整体覆盖 FDE 改动。

## 验收

- 新版本完整安装与构建通过。
- FDE 与直接修改的公共扩展接口通过无密钥定向检查。
- 隔离服务启动，实际在线 Client Bundle 与构建一致，历史数据恢复和项目归属检查通过。
- 人工界面验收待用户确认；不运行浏览器自动化或真实模型。
- 验证结果、迁移限制和回退条件写入 docs/verification/；验证通过后更新当前官方基线。

## 已确认接口变化

- client-runtime 拆分到 Client Store、API Session/Workspace Controller 与 Slot Renderer，FDE 导入和声明随之迁移。
- Better Sidebar 更新至 0.19.1，File Review 更新至 0.5.0，以适配官方右侧面板与会话事件。保留 Files/Editor/Git/Review 和按需 Terminal/Browser 的产品合同；旧补丁按新版代码重新核对。
- 官方 Conversation 拆分出 ui-chat，FDE 继续通过项目空白页、Session View、Header Utilities 扩展接入；保留会话范围内的程序化 View 选择。

## 工具链、插件与数据

- pnpm 11.7.0 和 11.24.0 在本组合的 peer 解析中均发生 `inheritedParentPkgBreaksPeerDiamond` 异常；10.34.5 成功安装，已固定到 package.json。保留锁文件安装，不要求操作者全局切换包管理器。
- 观测升级到 `dsh-observe@0.2.12`，保持 disabled。官方新增的 `session-log-deepseek` 请求上报在 Web Bundle 中显式关闭；验证实例同时禁用 OpenTelemetry 外发。
- `dsh-eval-harness` 保留原 Git SHA。其安装包缺少 lib 入口，`scripts/build-fde-integrations.ts` 从原源码确定性编译；唯一运行补丁是识别新版 `session.vN.jsonl[.zstd]`。真实离线 Session 产物已由该评估收集器读取验证。
- Better Sidebar 新版已经使用官方右侧面板；持久 Agent 终端位于其 bottomSplits。预览的精确父 Origin 判断和默认开关保留为 `patches/dsh-better-sidebar@0.19.1.patch`，不再使用旧 0.16.1 补丁。文件刷新使用官方 Workspace Files 变更流及插件公开的刷新事件。
- 会话格式由 0 升至 3。官方内置相邻格式的流式迁移链，读取历史时迁移，写入时发布新的版本文件；不是仅修改 header 的版本号。已在隔离副本读取两条真实旧会话，并得到正常用量投影。
- 用量活动按新格式中的 assistant/message 与 assistant/attempt 统计；重试、取消和最终回执不重复计数，活动缓存版本提升为 2。
- 项目空白页、阶段、人工审批、资料和原始文件保持原有合同。实验室改用异步持久化读取，保留角色工具隔离、证据与恢复行为。

## 下次如何更新

1. 检查主工作树状态，从已提交 main 创建独立 worktree；读取 lock 中的当前官方提交。
2. `git fetch upstream tag <精确发布标签>`，记录解析后的提交，不自动跟随 master。
3. 将旧、新官方树分别映射到 `upstream/deepseek-harness/`，用旧映射树作为 `git merge-tree --merge-base` 的基线，与当前下游树三方合并。映射只用于 Git 合并，不额外维护一套源码目录。
4. 处理 FDE 扩展、少量公共 UI 修改和固定第三方插件的接口变化；检查运行默认值及历史数据格式。
5. 完成构建、直接受影响的无密钥测试和隔离数据恢复，交给用户人工验收；然后合并到 main、更新 lock 和本次验证记录。推送另按用户授权执行。

普通 `git pull --ff-only` 只接收本工作台 origin 的发行更新，不执行以上官方适配流程。

## 隔离预览与回退

从本 worktree 的 `upstream/deepseek-harness/` 运行：

```sh
DSH_HOME=../../.runtime/dsh-home DSH_TELEMETRY_DISABLED=1 \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3082
```

首次访问使用终端输出的本地登录链接取得浏览器 Cookie；不要公开该链接。没有复制模型凭据，因此真实模型请求和最终视觉体验仍待人工确认。

事实源是原 main、原 FDE-Agent 项目和原主运行区。本 worktree 的依赖、lib、dist、.assets 与 .runtime 为本次隔离构建和验收产物；源码合并、人工验收完成且保存独有新数据后可以清理。清理前必须检查 tracked/untracked 状态与提交归属。原主工作台未升级，当前回退只需停止隔离实例；正式切换后，不能用旧代码直接继续写新格式会话。

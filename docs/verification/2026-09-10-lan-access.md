# 局域网访问启用验证

用户明确要求开放局域网访问，不新增登录流程。主工作树 `upstream/deepseek-harness/` 使用原隔离运行区，启动命令：

```bash
DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --lan --port 3080
```

## 已完成

- 增加显式 `--lan` 开关，默认本机模式不变。FDE 项目、阶段、资料、Semantica 和用量路由共用本机 IPv4／实际端口及同源校验；没有改动全局空信任表或特权 RPC 限制。
- 真实 Loader 启动、Connection 请求权限及 Host 通道的 22 项定向测试通过。
- Connection Host、Web App、四个 FDE 包的 TypeScript 检查和目标构建通过。
- 监听进程为 `*:3080`，工作目录及打开的运行文件均位于 canonical 仓库及其 `.runtime/dsh-home/`。3081 未操作。
- `http://192.168.110.19:3080` 与本机 `http://127.0.0.1:3080` 首页均返回 200。
- 局域网 IP 上的 `host.describe`、`session.list`、项目快照、阶段、项目元数据、资料列表和用量接口返回 200。资料为原有 35 份，阶段仍为 improvement。
- `events.mux` 和 `events.host` 两条 WebSocket 均通过携带该 IP Origin 的实际握手。Semantica GET 请求到达业务路由并按预期返回 405，未执行抽取、建图或付费模型。
- 局域网调用 `settings.describe` 返回 403；跨来源请求 FDE 用量返回 403。
- Workspace 登记文件前后 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，没有切换项目数据区或迁移阶段。

## 边界

该模式无身份认证，只供可信局域网使用；没有配置路由器公网映射。凭据和原生桌面操作仍限本机，独立业务项目的 `*.localhost` 内嵌预览未对外发布。实际另一台设备的防火墙／网络连通性与页面视觉由用户验收；未做自动浏览器回放。

IP 取决于当前网卡，换网后重新启动并使用日志打印的地址。撤销局域网访问时停止该进程，以同一 `DSH_HOME`、`--host 127.0.0.1 --port 3080` 重启，不删除项目数据。

## 浏览器兼容修复：项目数为零与首页白字

用户在局域网 HTTP 页面发现项目数为 0。回归测试移除安全上下文的 `crypto.randomUUID`，保留浏览器仍可用的 `getRandomValues`，真实 WebApiClient 在发请求前复现 `TypeError: crypto.randomUUID is not a function`。普通 API 继承的 ID 方法与通用 RPC 的兼容 UUID 方法不一致，导致就绪握手失败，Workspace 基线未加载。

修复在 WebApiClient 的既有 `mintRpcId` 扩展点复用 `randomUuid`，不改核心 API、Host 权限、页面入口或项目数据。首页移除把浅色画布正文改成白字的旧深色变量覆盖，保留产品示意窗口配色；项目基线读取中／失败不再显示伪零值。

- Connection 的 14 项测试、首页组件与配色约束的 14 项测试通过；错误用例先复现失败，再验证修复通过。
- Connection Client 与 FDE Project 类型检查通过；两个 Client 包实际打包完成。Connection 使用包目录内 `corepack pnpm exec tsdown`，该包没有 `bundle` 脚本，根目录只筛选父配置也不会生成其子 Client Bundle。
- 在线 Client Bundle 在 VM 内以真实浏览器 API 载体执行，仅模拟局域网平台缺少 `randomUUID`：从 `http://192.168.110.19:3080` 读取真实项目数为 3，真实就绪握手与两条下行连接成功。该检查不打开浏览器、不创建 Agent 或业务消息。
- 在线 Connection revision `de26ca3605c7`，SHA-256 `58a0c1c2182c2863424755bbc6d14dbe6eda5210a182723fa60ffae0917692cc`；在线 FDE Project revision `20df92ec4293`，SHA-256 `742d472c065b8d1eb700d75abfaf242927cdc907d9a84759b05da5db0e4fa123`。两者均与本地构建逐字节一致。
- Workspace 登记哈希仍为上述原值。主环境以 `--lan --port 3080` 重启，未操作 3081。首页视觉由用户强制刷新后确认，未宣称已做像素验收。

## 全局主题接续修复

用户继续发现侧栏浅底白字、聊天区域却变成深色。确认两地址的 Host HTML 均嵌入 `light`，但 ThemeRuntime 独立初始化为 `system`；局域网 SettingsScope 使用内存模式，无法像回环访问一样通过 Host 设置补回 `light`，导致系统深色偏好意外接管。

修复仅在主题引导与 ThemeRuntime 之间传递已公开的 `light`／`dark`／`system` 原始值，不开放 settings RPC、不写用户偏好、不修改业务页面。上一轮首页局部配色补丁已撤销，恢复主线配色；保留已验证的 UUID 修复和加载状态说明。

- 主题引导、ThemeRuntime、Host 注册的 29 项测试通过，覆盖浅色偏好对深色操作系统的优先级、三种原始偏好、后续 Host 快照和用户切换；类型检查通过。
- ui-theme 的 Host/Client 与 ui-fde-project 重新构建，3080 继续 LAN 监听。
- 使用实际在线 HTML 引导和在线 ThemeRuntime Bundle，在“系统深色、远程设置为空”的 VM 条件下验证：Host 偏好 `light`、Runtime 偏好 `light`、最终 colorScheme `light`，无设置写入。DOM 外壳和非执行的渲染依赖为测试替身，并非完整浏览器视觉验收。
- 在线 theme revision `43c20f1822d7`，SHA-256 `666b280e890790a715aad00be183e5fb5d9ccff5a9c6a4ca563b885a62b01271`；Project revision `daa0223fc8a3`，均与本地构建一致。Workspace 登记哈希仍未改变。

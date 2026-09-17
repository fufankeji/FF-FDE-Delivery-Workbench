# 局域网免授权访问验证

## 授权与边界

用户明确要求其他设备通过局域网 IP + 端口直接访问，并进一步要求关闭首次浏览器授权。现有 `--lan` 只开放监听，升级后的 Connection 仍统一要求 cookie，导致裸 IP 首页 401。本轮让显式 `--lan` 同时关闭浏览器会话要求，普通启动仍使用原鉴权，不删除凭据、不迁移运行数据，不开放独立业务预览端口。

必须将能连接该端口的设备视为可信操作者：当前后台没有按用户或方法划分的权限，免授权包含完整 Host API、设置与 Agent 工具。既有 README 关于后台设置/凭据仍限本机的描述不准确，已纠正；界面隐藏本机入口不是安全隔离。仅用于可信局域网，不做公网映射。

## 实现

- Connection 增加默认 true 的 `browserAuthentication` 配置；关闭时不初始化 BrowserAuth、不读取或改写浏览器签名记录，首页、RPC、WebSocket 共用免授权策略，启动 URL 不含 token。
- Web 组合只根据显式 `--lan` 解析出的 startup host 设置 false；单独声明 trusted host 或通过其他配置覆盖监听地址不会关闭鉴权。没有新增 CLI 参数或 UI 开关。
- Host/Origin/Fetch-Metadata 校验继续应用于数据接口和 WebSocket，并覆盖免授权首页；默认认证模式代码保留。
- 更新对应包 README、公开类型说明、配置目录条目及上游要求的成对决策记录；项目架构与本记录只保留简体中文一份。

## 验证结果

从 `upstream/deepseek-harness/` 执行：

| 检查 | 结果 |
|---|---|
| `corepack pnpm exec vitest run packages/client/connection/tests/node-half.host.spec.ts packages/bundle/web-app/tests/startup.spec.ts` | 退出 0，24 项通过；包括默认 401、有效 cookie、显式免授权、Host/Origin/跨站 403 和 CLI opt-in/冲突参数 |
| `corepack pnpm exec tsc -b packages/client/connection/tsconfig.host.json` | 退出 0 |
| 在 `packages/client/connection/` 执行 `corepack pnpm exec tsdown --config tsdown.config.ts` | 退出 0，Host 及对应 Client bundle 更新；没有全仓重建 |
| 定向中英配对检查 | Connection README、配置目录、新决策记录与旧记录链接共四对通过 |

全仓配置目录生成器被既有 FDE project/semantica 六个缺失 JSDoc 的字段阻断，未修复无关源码；使用同一官方 `collectConfigCatalog`/`render` 在临时单包目录生成 Connection 条目，回填对应英文条目并同步中文版本。临时目录仅链接主仓源码，完成后已清理，没有复制源码或新增持久运行区。不能声称全仓配置目录新鲜度检查通过。

## 在线检查

验证无 token、无 cookie、无 Authorization header 的请求：

| 地址 | 首页 | `/api/fde-stage/skills` | `/api/remote.mux` | 跨站首页/接口 |
|---|---|---|---|---|
| `http://127.0.0.1:3080` | 200，未设置 cookie | 200，第一阶段七方法 | WebSocket 101 | 403 / 403 |
| `http://192.168.110.19:3080` | 200，未设置 cookie | 200，第一阶段七方法 | WebSocket 101 | 403 / 403 |

当前监听 PID `33166`，主仓 cwd，显式 `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`，启动为 `dsh web --no-open --lan --port 3080`。启动输出为不含 token 的地址。重启前后 `workspace.json` SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，Workspace 登记未变化。

以上网络检查从本机访问实际 LAN 地址完成；没有假称已经操作另一台设备。未自动启动浏览器、截图或执行计费调用。复用原被忽略的包 `lib/` 与 `.runtime/workbench-web.log`，无新增大型产物、worktree、提交或推送。取消 `--lan` 并使用 `--host 127.0.0.1` 重启即可恢复本机鉴权模式。

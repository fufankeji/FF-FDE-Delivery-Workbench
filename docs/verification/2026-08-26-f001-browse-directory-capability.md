# F001 · Browse 目录能力修复验证记录

- 日期：2026-08-26
- 状态：能力修复完成，待用户人工重试创建项目
- 运行地址：http://127.0.0.1:3080

## 根因

Web Bundle 原先使用官方 `directory-picker-auto`。在本地 macOS、loopback 启动条件下，auto 解析为 `native`：它可以弹出系统目录选择器，但不实现 `host.createDirectory`。结构化项目表单选择父目录后需要创建 ASCII 子目录，因此 Host 正确返回 `directory-picker-unavailable`。

## 修复

- Web Bundle 固定组合官方 `@deepseek-ai/dsh-host-directory-picker-browse`。
- 同时组合匹配的 `@deepseek-ai/dsh-client-ui-directory-picker-browse`。
- 增加该 Client package 的源码路径映射，保持源码启动和构建一致。
- 未修改 API 权限判断，也未在前端吞掉或伪造创建成功。

## 已执行证据

| 检查 | 结果 |
|---|---|
| `corepack pnpm run verify-cordis-config` | 130 个配置文件全部通过 |
| `corepack pnpm run build` | 退出状态 0 |
| 首页 HTTP | `/` 返回 200 |
| 运行实例只读 RPC：`host.listDirectory` | `result.ok: true`，确认实际 Host 提供 browse 能力 |

按 `AGENTS.md` 的人工优先规则，本次未自动创建测试目录，也未运行浏览器回放；请用户刷新页面后重新执行一次真实项目创建。

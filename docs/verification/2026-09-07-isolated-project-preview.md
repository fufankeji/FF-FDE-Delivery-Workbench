# 平台级本地项目预览修复

## 原因与本轮范围

- 4177 的业务服务只允许 3080 作为父页面，当前工作台为 3081。此前建议逐个项目补白名单不能满足通用平台要求，本轮没有采用。
- Better Sidebar `embeddabilityOf()` 原先把全部非 `*` 的 frame-ancestors 都判为禁止，遗漏真实父来源匹配。现通过既有 pnpm 受控补丁同时修正源文件和发布 bundle；复杂表达式返回 unknown，仍由浏览器执行安全策略。
- 实现在 `fde-project` Host 与 `ui-fde-project` 共享运行入口，原有阶段状态、启动与停止工具不变。未修改 `/Users/muyu/FDE-Agent/fde-agent` 源码、图谱、项目运行记录或业务数据；未重启 4177 或 main 的 3080。

## 方案

- 可信 POST 接口仅接受 Workspace ID，不接受任意目标 URL。Host 从该项目 running 记录读取原地址，为项目分配随机 `fde-<随机值>.localhost` 主机名及 OS 分配端口，监听 127.0.0.1。不同项目有不同来源，不只依赖端口隔离 Cookie。
- HTTP 正文原样流式传输，支持根路径资源、API 请求和 WebSocket 升级。只适配本地嵌入父来源、请求 Origin/Referer、同目标重定向及 Cookie Domain，不改 HTML/JS 或业务源码。原有脚本等 CSP 限制保留。
- 精确 Host、Origin 与运行目标检查保护代理；不代理任意外部地址、当前工作台端口或已创建预览端口，不跟随外部重定向。每个请求重新核对项目记录，已有长连接每秒检查有效性。重新绑定关闭旧监听，卸载关闭所有监听、计时器和连接。
- 页头新增显式“外部打开”原地址备选。默认仍使用当前 Session 的内置 Browser；沙箱不全局关闭。
- 通过 product-spec Skill 增量补齐 PSC-007/PSC-019，并同步共享 Feature 与既有架构说明，没有新增第二套运行状态或批量展开其他阶段。

## 验证结果

在隔离 worktree 的 `upstream/deepseek-harness/` 执行：

- `tsc -b packages/fde/project/tsconfig.json packages/client/ui-fde-project/tsconfig.json --pretty false` 通过。
- 4 个直接相关文件合计 16 项测试通过：Host `project-preview.spec.ts`（4），Client `project-preview.client.spec.ts`（2）、`project-runtime-header.client.spec.tsx`（6，其中新增的显式外部打开单独执行，复用此前 5 项通过结果）、`project-runtime-sidebar.client.spec.ts`（4）。新测试覆盖不同项目／端口、资源正文、流式结果、POST 来源映射、重定向、Cookie Domain、未授权请求、失效与重绑、WebSocket 双向字节传输及运行失效后断开。首轮测试服务的升级连接未在清理时销毁导致 hook 超时，修正测试服务的连接生命周期后通过。
- `tsdown --filter @deepseek-ai/dsh-fde-project` 与 `pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` 通过。Sidebar 补丁通过 `pnpm patch-commit` 更新既有 patch 与锁文件，未增加第三方依赖版本。
- PRD 前置校验与总 Spec confirmed 校验通过；本轮 3 组既有 README/Agent Note 配对检查通过。
- 普通源码 `git diff --check` 通过。pnpm 生成的 `.patch` 中存在 diff 上下文前缀和文件头制表符，普通 whitespace 检查会报格式警告；这是 patch 语法上下文，不改写为失效补丁。

## 真实运行检查

- 仅重启 3081，监听进程 `65358` 使用 `DSH_HOME=../../.runtime/dsh-home`，全部登记 Workspace 位于当前 worktree 的 `.runtime/workspaces/`。3080 仍返回 HTTP 200。
- 通过可信新接口为现有 4177 项目创建临时隔离预览（本次 OS 分配端口 61323，不写死在代码或项目记录）。首页、`/app.js`、`/style.css` 和 `/api/overview` 全部返回 200，代理正文与原服务相同；响应 frame-ancestors 允许当前 3081 和同预览来源。未调用真实业务写入接口。
- 首页 Boot Manifest 在线 `ui-fde-project` revision `d82aef7e684f` 包含新预览接口；`dsh-better-sidebar` revision `5e4a272854c8` 包含实际父来源判断，服务不是旧 bundle。
- 携带预览来源 Origin 调用真实工作台管理接口返回 403，未执行项目状态写入。

## 未执行与边界

- 按项目人工优先规则，没有打开浏览器或运行 UI 自动化。HTTP 转发验证与 WebSocket 传输测试不冒充浏览器渲染、实际 Vite 热更新或登录流程验收；用户需要刷新工作台，关闭旧直连页签后重新点“预览项目”。
- 当前网关用于本机 HTTP 工作台。硬编码绝对地址、跨来源 OAuth/Cookie、HTTPS 工作台及不支持 `*.localhost` 的客户端不承诺透明兼容，应使用显式外部打开；不删除外部网站的安全策略。
- 临时包编辑副本 `/tmp/fde-sidebar-preview.cSo3fJ` 约 15 MB，应用并构建完成后已清理；源码改动保存在既有 pnpm patch 中，可由 `pnpm patch dsh-better-sidebar@0.16.1` 重建。运行监听随 Host 退出释放，未创建新 worktree 或持久代理状态。

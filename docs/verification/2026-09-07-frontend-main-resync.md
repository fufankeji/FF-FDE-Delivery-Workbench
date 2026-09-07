# 前端分支合并与运行区同步

## 代码

- 本轮前端提交：`6eb5da90e3`，包含项目中心布局、多项目分页及第一阶段完成回看布局。
- 合并提交：`bdc072a841`，同时保留 main 的第五阶段工作台提交 `0672f045c3`；无冲突。
- `git pull --ff-only origin main` 返回 Already up to date；当前开发分支随后快进到 main。未推送远端。
- Git 提交时提示 PATH 中没有 lefthook，未把提交成功视为 Hook 检查通过。

## 数据

- 继续使用既有单向实时同步进程，事实源为 `/Users/muyu/FDE-Agent/fde-agent`，目标为当前 worktree 的 `.runtime/workspaces/fde-agent`。
- 两侧均为 189 个文件；相对路径、大小、SHA-256 和 mtimeMs 无差异。
- 两侧 35 份 Source 均无 stale；原件大小和修改时间与 Source 登记一致。
- FDE-Agent 的 2 个 Session ID 一致，事件帧字节一致；目标独立 header frame 指向隔离 Workspace。
- 当前预览登记的 3 个 Workspace 均位于本 worktree 的隔离运行目录。未覆盖其他项目数据、未修改事实源。

## 检查与启动

- 项目中心与阶段工作台两份定向 Vitest：34 项通过。
- Client 包类型构建、FDE Project/Stage 两个 Host 包类型构建通过；分别构建 Client Bundle 和 Host Bundle。Host 包没有 package-local bundle 命令，使用根 tsdown 配置按包名过滤。
- 检查中发现仅构建 Client 类型不会更新 FDE Host 的 JS 输入，因此显式构建两个 Host 包后再打包，不能用旧 lib 的打包成功替代最新源码构建。
- 当前预览使用 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3081`。main 的 3080 服务和实时数据同步进程保持不动。
- 最终监听 PID 52631，显式 DSH_HOME 正确，首页 HTTP 200；Boot Manifest 的 Client `rev=aa9e81544118` 包含项目分页、历史页居中和第五阶段布局；Host 产物包含 `project_evaluation_get`。
- 本轮未运行浏览器自动化，视觉效果仍由用户手动确认。

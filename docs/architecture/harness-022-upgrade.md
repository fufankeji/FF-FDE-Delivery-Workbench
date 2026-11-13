# 官方 Harness 0.2.2-rc.2 兼容升级

状态：2026-11-12 兼容实现、构建和本机桌面启动已完成，待用户手动验收；没有推送 GitHub。范围见 [F030 Spec](../specs/F030-harness-022-compatibility/spec.md)、[Plan](../specs/F030-harness-022-compatibility/plan.md) 和 [Tasks](../specs/F030-harness-022-compatibility/tasks.md)，真实命令及限制见[验证记录](../verification/2026-11-12-harness-022-compatibility.md)。

旧官方基线为 `687f282e8625c6b8d11ff58211a90524be2e4317` / `0.2.1-rc.2`；目标为 `ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c` / `dsh-v0.2.2-rc.2`。当前 FDE 功能先保存为本地提交 `53bb3e0dc8`，不推送 GitHub。使用现有主工作树，通过映射子树的显式三方合并适配，禁止直接覆盖官方目录或新建 worktree。

当前两代都使用 Session v4，但 Store 写入生命周期、投影句柄、工具执行器和追加重载等 API 已变化；同代不能据此认定所有扩展兼容。升级保持 FDE 的项目身份、人工阶段决定、角色资料权限、中文题目、完整 Skills、原生 fetch 调用和 macOS 标题栏避让，不改 Agent Loop。

只复制 `.runtime/harness-021-validation/` 中必要的非秘密项目与运行数据到 `.runtime/harness-022-validation/`；原件作为回退来源保留。验证复制保持项目 hash 和高精度 mtime，只改副本登记与 Session 首帧的隔离目录。凭据、环境文件、浏览器状态和 profiles 依赖不复制。新桌面使用显式绝对 DSH_HOME，避免工作目录变化误读全局数据。

空间预算：起始可用约 7.3 GiB，数据副本约 22 MiB；源码恢复使用 Git 对象，依赖和桌面运行时只在当前源码下更新，不保留重复依赖树。`.runtime/harness-022-upgrade/` 保存本轮树 ID、清单和日志，验收及回退窗口结束后可清理；运行数据不是缓存。

## 当前运行与回退

实际桌面使用 `.runtime/harness-022-validation/dsh-home` 和同级 `desktop-user-data`，已打开原连锁门店项目。3083 的独立 Web 验证进程已停止；桌面内置 Host 使用随机本机端口，不与 Web 共写同一 home。重启使用源码内 `start:desktop`，显式设置上述两个绝对路径；不得打开另一个项目或全局 Harness 代替本实例。

完成技术验证时，原运行区 250 个文件和 14 份会话代际文件摘要均未变化；新版读取了 11 个唯一 Session，包括 3 个原项目会话和 8 个实验室岗位会话。训练 SQLite 完整性检查通过，中文挑战的 1 条历史记录保留。副本中的新操作不自动回写旧版。

回退须先退出本桌面，恢复检查点 `53bb3e0dc8` 所对应的源码/依赖并重建，再使用旧 `.runtime/harness-021-validation`；不能只换旧代码读取新版写过的副本。不要以 `reset --hard` 或清理运行目录代替回退。

本轮新增运行副本约 24 MiB、验证日志约 552 KiB；复用的依赖目录约 2.9 GiB，桌面构建/解释器目录约 707 MiB。日志在验收与回退窗口结束后可删除；新运行区若已有操作记录，必须先确认保留方式，不能当缓存清理。依赖和桌面产物可在停止应用后按锁文件重建；本轮未删除旧数据或创建 worktree，结束时磁盘约余 4.3 GiB。

# 官方 Harness 0.2.2-rc.5 兼容升级

2026-11-21 用户授权修复项目布局/入口并升级最新官方发布版，随后推送。目标为 [dsh-v0.2.2-rc.5](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.5)，提交 `9c2670d3bce5275e0d1610272958121af87787bb`；此前基线为 `ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c`（rc.2），产品检查点为 `2e9abf4b547ac735a7ab286b12d4db2ddd567b01`。不追未发布 master。

使用旧官方树和 rc.5 差异，在现有主树以带目录映射的 `git apply --3way --index` 整合。没有创建 worktree、复制源码 checkout 或覆盖目录。七个交叠冲突围绕 Sidebar、Workspace 与生成目录处理：保留 FDE 共享导航、无全局 New Session 按钮、项目创建降级行为；同时保留新版 session-action 扩展和 workspace.picker Factory。源与生成目录分别维护，后者重新生成。

官方差异涉及版本标记、可选 DeepSeek 会话导入、搜索提供方路由、模型拒绝错误以及 Windows/LiveShare 修复。新增可选插件保持官方的默认关闭，不自动导入会话。Session 格式常量仍为 4，格式目录未出现代码代际变更；这不是对所有历史数据已全量验证的声明。

FDE 修复归属原功能插件：详情页负责滚动与响应式重排，阶段打开传递 Workspace 隔离的只读浏览选择；ui-fde-sources 通过共享 Factory 提供零会话可用的上传，复用保存/识别/刷新而非广播寻找隐藏控件。Composer 仍由官方 ConversationContent 持有，FDE 的布局标记限定底部占位及正文滚动，普通聊天、运行轨迹和只读阶段不改。

依赖树只在原 Harness 目录更新。File Review 补丁使用精确 rc.5 声明，不放宽所有插件版本检查；上下文洞察、Eval、OpenAPI 和 Better Sidebar 的固定版本保留。Node/pnpm 基线不变。`.runtime/harness-0225-upgrade` 是可再生成的合并/下载/验证记录，不是产品源码或运行事实源。

验证使用隔离运行区和公开门店样例，不读取凭据库或写入原 `.runtime/harness-022-validation`。冻结安装、11 项完整构建、定向回归和在线资源核验通过；文档总检查存量问题、未执行项和人工体验边界见[本轮验证记录](../verification/2026-11-21-project-layout-harness-0225.md)。回退须停止本轮实例、按上述检查点恢复本轮准确源码/锁文件并重建；不得使用 reset --hard 或删除真实运行数据。桌面旧源码 ZIP 不因本次 GitHub 推送而自动替换。

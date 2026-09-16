# FDE 下游适配官方 0.1.6-alpha.1

Status: implemented

官方 Client Runtime 拆分、Conversation 重组和 Session 格式变化影响已有 FDE 项目入口、用量、实验室及第三方插件。通过子目录映射三方合并保留产品扩展，不修改官方 Agent Loop。

FDE Client 改用当前 Controller、Store 和 Renderer；保留项目空白页、会话内 View 选择及人工阶段决定。实验室使用异步持久化读取。旧会话由官方相邻格式迁移链读取，不直接改写版本号；只在隔离副本验证。

Better Sidebar、File Review 与 observe 更新到兼容版本。固定 eval Git 插件的缺失构建入口由仓库脚本生成，并适配版本化 Session 文件名。观测和会话上报保持显式关闭。

完整说明与命令位于唯一中文[升级记录](../../../../../../docs/architecture/harness-016-upgrade.md)，实际结果位于[验证记录](../../../../../../docs/verification/2026-09-16-harness-016-upgrade.md)。人工视觉与真实模型验收不由无密钥检查代替。

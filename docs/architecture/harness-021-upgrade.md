# 官方 Harness 0.2.1-rc.2 兼容升级

状态：2026-10-23 实现、定向检查、构建和隔离运行验证完成，3082 待用户人工确认；原运行区未切换。范围与验收以 [F027 Spec](../specs/F027-harness-021-compatibility/spec.md)、[Plan](../specs/F027-harness-021-compatibility/plan.md)、[Tasks](../specs/F027-harness-021-compatibility/tasks.md) 为准。

唯一源码为现有 main 工作树，不创建 worktree 或重复 checkout。本次从 `0a15e36e7f82b6ed45af6fa9759f29b40dcd965d` / `0.1.6-alpha.1` 升至精确发布提交 `687f282e8625c6b8d11ff58211a90524be2e4317` / `0.2.1-rc.2`。源码三方合并使用当前实际工作树，包含已有未提交内容；不修改官方 Agent Loop。

升级重点为退役 invariant companion、Connection 授权扩展、项目 Hero/Sidebar/View 补丁、Session v4 读取和第三方插件组合。阶段与人工门不变；PRD 和 Product Spec 已记录用户确认的具体 IP 授权访问、只读运行输出与独立手动终端。新上游默认值不能悄悄开启会话上报、模型执行或公网监听。

首次进入行为由 Web 组合控制：`ui-settings-models` 的 `welcomeNotice` 与 `credentialOnboarding` 均关闭。前者取消预览声明注册，后者复用官方自动引导开关；模型设置与显式登录/API Key 编辑保留，不写确认记录、不改凭证和访问授权。

旧 `.runtime/dsh-home` 和 FDE-Agent 原目录为数据事实源；首次迁移在 `.runtime/harness-021-validation/` 的非秘密数据副本中执行并使用 3082。只创建一次验证数据副本，保留源字节与 mtime；桌面源码 ZIP 不被当成运行数据备份。人工验收前不切换原运行区。源码和数据两部分均具备恢复来源后才开始替换。

持久临时状态仅包括 `.runtime/harness-021-upgrade/` 的 Git 树 ID、清单与日志，以及 `.runtime/harness-021-validation/` 的验证数据。源码事实源仍是当前仓库；这些目录用于本次验证和回退，待人工验收及回退窗口结束后可清理。实际大小和命令写入[验证记录](../verification/2026-10-23-harness-021-compatibility.md)。

旧升级说明 `harness-016-upgrade.md` 保留为历史；其中自动创建 worktree 的操作建议不适用于本轮，当前根 AGENTS 的主工作树规则优先。

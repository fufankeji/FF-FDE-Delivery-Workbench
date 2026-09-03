---
document: feature-plan
feature: F014
status: ready
updated: "2026-08-27"
---

# F014 · 用量分析实施计划

## 现有上下文与复用

- 官方 Session Log 是模型、工具、审批、压缩和插件事件的权威来源；官方 Trajectory 已提供当前 Session 逐事件查看，F014 不复制其职责。
- 直接集成 `dsh-observe@64791ff93ac01bac5bb6e6a14f48d072b479464b`（Apache-2.0）。该插件明确测试当前 `0.1.1-rc.2`，从 `session/event` 构建 Turn/Step/Tool/LLM spans 与 Token/成本指标，发送前脱敏，支持 Langfuse 和 OTLP、异步批次、有界 storage-domain 离线缓冲、指数退避和运行时状态 Remote；锁定源码当前有 119 项通过测试。
- Langfuse 仍是可选完整后端，不自动部署。未配置时 FDE 页面以本地 Session/Stats 和 `dsh-observe` 状态为依据。
- `dsh-maze` 关注度高且擅长单次运行路径与比较，但当前首版已有 Trajectory，先不引入第三个重叠视图。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| Web Bundle 第三方依赖 | 无 `dsh-observe` | 固定提交，默认关闭并注册可选 Remote 状态 | AC-F014-002～003 |
| `packages/client/ui-fde-project/` | 项目交付页面 Client | 增加从项目开发阶段开放的“用量分析”View，按 Workspace membership 聚合项目运行列表与既有 Stats/Token 指标 | AC-F014-001～004 |
| Session stats/telemetry seams | 官方运行事实与统计 | 只读复用，不修改 Agent Loop 或 Session Log | AC-F014-001, AC-F014-003 |
| Bundle/聚合/第三方声明 | FDE 组合 | 加入 Host/Client 与固定外部插件许可 | 全部 |
| Architecture/Agent Note/验证记录 | 技术事实与证据 | 记录数据流、隐私、失败注入和真实状态 | 全部 |

## 实现方案

将 `dsh-observe` 加入 Web Profile，但保持 `enabled: false`、无后端且关闭 Prompt/Completion 采集，避免安装即采集或外发。插件 disabled 时会在注册 Remote 以前返回，因此当前 FDE 页面明确显示“本地观测可用，外部导出未启用”，不猜测后端健康、队列或缓冲。启用配置继续由部署层提供，届时再联调 Remote 状态映射。

F014 Client 通过当前 Session membership 解析 WorkspaceId，再从官方 Workspace `sessionIds` 和 Session 摘要中的 `sessionStats`、`tokenUsage` 形成项目运行列表。它只使用公开对象层投影，不解析私有 UI DOM 或 Session 文件。

页面顶部显示本地运行数量、运行中/失败和可得 Token；主体显示 Session 运行表与状态；侧区显示 `dsh-observe` 是否启用、后端、队列/缓冲、最近成功/失败。外部详情 URL 只来自明确配置并通过同源 Host 投影，不携带凭据。

## 实施顺序

1. 固定并安装 `dsh-observe`，验证当前 Web Profile 的依赖、Bundle 和 Remote 合同。
2. 建立 Workspace 级本地运行摘要和项目隔离，覆盖加载、损坏和项目切换。
3. 接入 `dsh-observe` enabled/backend/queue/buffer/error 状态，保持默认不外发。
4. 实现“用量分析”View、项目开发阶段可见门、项目运行列表、指标、空/失败和外部详情动作。
5. 做脱敏/缓冲/后端失败注入测试，证明 Agent 与 Session 主路径不受影响。
6. 完成组合、构建、重启与用户可见运行验证，记录证据。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 外部插件低 Stars 但新生态 | 社区使用信号有限 | 依赖精确 rc.2、114 测试、许可和源码证据，不以 Stars 单独决策 | T001 |
| `dsh-observe` 无 Trace UI | 只安装看不到项目页面 | 新增薄 FDE View，本地事实来自官方服务，外部详情可选 | T002～T004 |
| 官方跨 Session usage 公开面不足 | 不能完整显示成本/步骤 | 只显示可证明字段；未知显示未配置，不扫描私有文件格式冒充稳定合同 | T002 |
| 后端/凭据未配置 | 无远端 Trace | 本地观测仍成立，插件保持关闭，页面明确状态 | T003～T004 |
| 外发敏感数据 | 企业数据风险 | 默认关闭、先脱敏/截断、凭据 Host-only、有界缓冲 | T005 |

## 回退策略

移除 FDE Host/Client rows 后现有对话和 Trajectory 保持可用；移除 `dsh-observe` Bundle row 后不删除 Session Log 或项目文件。外部导出默认关闭，因此回退不需要发送或清理远端数据；已经产生的受控缓冲由插件自己的移除/保留合同处理并在验证记录说明。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F014-001 | 项目开发阶段开放的 Workspace 运行汇总 | Host 聚合＋Client membership/阶段可见性测试 | development 起可见、同项目跨会话、跨项目隔离、真实状态 |
| AC-F014-002 | 显式启用与先脱敏 | 固定插件配置/脱敏测试 | 默认无外发、敏感值不进入队列/请求 |
| AC-F014-003 | 缓冲与失败隔离 | 外部插件既有测试＋组合失败注入 | 后端失败时 Agent/Session 正常、状态真实 |
| AC-F014-004 | 三种视图边界 | Slot/组件测试＋人工检查 | Trajectory、用量分析、外部详情不混用 |

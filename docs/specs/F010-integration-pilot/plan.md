---
document: feature-plan
feature: F010
status: ready
updated: "2026-08-31"
---

# F010 · 阶段 6：企业集成与受控 Pilot 实施计划

## 现有上下文与复用

- 当前实现与入口：项目启动／停止、终端、内置浏览器、API 文档和观测页可承载 Pilot 操作与观察。
- 直接复用点：F009 候选快照与验证结论，F003 工具授权，F007 动作边界与治理记录。
- 必须保持的现有行为：本地开发运行继续可用，但明确与 Pilot／生产状态分离。
- 必须保持的 Product Spec 合同：PSC-003, PSC-005, PSC-006, PSC-019, PSC-021, PSC-022, PSC-023。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/fde/runtime` | 项目启动和运行状态 | 增加 PilotScope、授权、接管、回滚和结果状态 | AC-F010-001, AC-F010-002 |
| `packages/fde/project` | 项目 Artifact | 适配 Readiness、Runbook、Adoption Plan、Pilot 记录和证据 | AC-F010-002 |
| `packages/skill/*` | 发布与运行路由 | 接入方法与集成／SHIP 能力 | AC-F010-001 |
| `packages/host` | 启停和外部动作 | 强制授权范围并记录运行／回滚 | AC-F010-001 |
| `packages/client/ui-fde-stage` | 当前阶段工作台 | 呈现就绪、授权、范围、监控、接管和业务结果 | AC-F010-001, AC-F010-002 |

## 实现方案

在开发运行状态之外建立独立 PilotRun 聚合，绑定 CandidateSnapshot、PilotScope、Approval 和 ToolPolicy。Host 只接受当前授权范围内的生产影响 operation。阶段工作台沿用统一骨架，中心区域专门投影 Pilot 范围、就绪状态、真实运行时间线、业务／技术双信号、采用、接管与回滚；观测页提供可下钻的运行证据。

## 实施顺序

1. 固定阶段 6 方法、模板、Schema 和工程 Skills。
2. 建立 Readiness、PilotScope、Approval、Run 与 Adoption Artifact。
3. 实现预审、授权、集成、部署和观察路由。
4. 扩展 Host 启停为受控 Pilot operation。
5. 构建 Pilot 工作面、接管／回滚与 FDE 决定。
6. 用未授权、正常、触发停止和结果不可测场景验证。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 开发运行状态被当作生产 | 虚假就绪 | 独立状态模型与醒目标识 | 状态测试 |
| 授权变化未使运行失效 | 越权操作 | Approval／Scope 版本绑定 | Host 权限测试 |
| 只监控技术信号 | 无法判断价值 | 强制关联业务结果指标 | Pilot 报告测试 |

## 回退策略

Pilot 失败时按已批准 Runbook 接管或回滚，保留全部运行证据和旧稳定版本；平台状态回到待评审或已停止，不自动回到开发成功，也不删除失败记录。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F010-001 | 只有授权范围可启动并持续记录真实状态 | 运行 Host 授权与 Pilot 状态定向测试 | 未授权拒绝、授权内运行、越界停止、信号可见 |
| AC-F010-002 | 运行证据包和阶段决定相互独立 | 运行 Artifact、回滚和决定测试 | 技术健康不替代业务结果，非人工事件不推进 |

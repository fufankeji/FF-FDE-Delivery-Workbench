---
document: feature-plan
feature: F010
status: ready
updated: "2026-09-07"
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

AC-F010-004 导航收口：ProjectContextSidebar 与 StageWorkbench 复用相同的浏览阶段解析函数；联动测试同时挂载侧栏和正文，并订阅真实浏览控制器，验证自动进入、从两个入口切换和退出重入，不以手动改测试 props 替代联动。

AC-F010-004：移除 deliveryDemo 读取、类型、前端分支与开关，只消费 v2Stages 和项目生命周期。当前验证项目通过现有 complete 接口逐次提交；不直接写 Storage，不改全局门槛。侧栏与正文以当前阶段及 improvementCycles/lastReviewedAt 展示状态；定向验证无演示入口、历史回看及已完成轮数。


Pilot 失败时按已批准 Runbook 接管或回滚，保留全部运行证据和旧稳定版本；平台状态回到待评审或已停止，不自动回到开发成功，也不删除失败记录。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F010-001 | 只有授权范围可启动并持续记录真实状态 | 运行 Host 授权与 Pilot 状态定向测试 | 未授权拒绝、授权内运行、越界停止、信号可见 |
| AC-F010-002 | 运行证据包和阶段决定相互独立 | 运行 Artifact、回滚和决定测试 | 技术健康不替代业务结果，非人工事件不推进 |

## 2026-09-07 授权实施切片

本轮只实施 AC-F010-003，并保持已有评审与返回。共享读取器放在 `upstream/deepseek-harness/packages/fde/project/src/delivery-workbench.ts`，接入已有 `v2-stage-surface.ts`；浏览器沿现有 props 和快照控制器接入 `DeliveryStagePanel.tsx`，不新增全局服务或另一套运行状态。固定类别呈现 授权、接入、恢复、技术、业务结果，页签为 概览、接入与准备、运行与问题、试点评审。

状态文件新增可选 `delivery` 记录，版本 1；旧记录仍能看到原产物但显示专用证据未登记，不自动满足新评审条件。文件摘要变动撤销有效通过；范围、版本、来源与 Owner 必须下钻可见。Stage Skill 同步最小写入格式，不把缺失信息填为成功。读取客户项目真实前序产物，仅创建有来源的阶段准备记录，不运行客户项目的写操作。

顺序：更新合同 → 文件读取与定向测试 → 页签与证据详情 → 接入真实准备数据 → 构建主端口预览。验证仅采用读取器测试、组件交互测试、客户端构建与在线快照；人工视觉验收留给用户。回退时保留 delivery 和全部证据，恢复旧只读展示，不删除项目数据。

生产执行器、实时监控、客户签收工作流、独立 Semantica 生产查询属于未完成项，不因本轮页面交付勾选原 T001–T006。

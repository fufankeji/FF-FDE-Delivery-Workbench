---
document: case-manifest
case_id: CASE-SMWO-001
status: ready-to-start
updated: "2026-09-03"
---

# 案例素材与提示词清单

## 素材释放原则

素材按阶段分批释放，用来模拟真实 FDE 项目中信息逐步出现的过程。后续阶段素材不是前序阶段已知事实；提前导入会破坏调查、重新界定和证据门的真实性。

| 步骤 | 允许导入的素材 | 对应提示词 | 主要观察点 |
|---|---|---|---|
| 新建项目 | `materials/00-project-creation/01-project-card.md` | `prompts/00-project-creation.md` | 项目身份、独立目录、周期待确认 |
| 阶段 1 | `materials/01-discovery/` | `prompts/01-stage-01-discovery.md` | 资格判断、现场冲突、责任与代表案例 |
| 阶段 2 | `materials/02-definition/` | `prompts/02-stage-02-definition.md` | 基线、目标、范围、可行性、估算和停止条件 |
| 阶段 3 | `materials/03-investigation/` | `prompts/03-stage-03-investigation.md` | 数据、系统、访问、动作权限和治理边界 |
| 阶段 4 | `materials/04-design/` | `prompts/04-stage-04-design.md` | 机制选择、生产设计、合同、NFR 和纵向切片 |
| 阶段 5 | `materials/05-evaluation/` | `prompts/05-stage-05-evaluation.md` | 固定候选、代表案例、负向案例和可复现证据 |
| 阶段 6 | `materials/06-pilot/` | `prompts/06-stage-06-pilot.md` | 试点范围、授权、接入、恢复和现场结果 |
| 阶段 7 | `materials/07-production/` | `prompts/07-stage-07-production.md` | 发布、观察、采用、验收和责任移交 |
| 阶段 8 | `materials/08-improvement/` | `prompts/08-stage-08-improvement.md` | 生产证据、改进复测、受控发布和复用边界 |

## 素材来源 ID

所有素材均为 `simulation` 类型。导入工作台后，以工作台生成的真实 SourceId 为准，并在运行台账中建立映射。

| 案例来源 ID | 文件 | 声明角色 | 首次可用步骤 |
|---|---|---|---|
| SRC-SIM-0001 | `00-project-creation/01-project-card.md` | 项目发起摘要 | 新建项目 |
| SRC-SIM-0101 | `01-discovery/01-customer-original-brief.md` | 项目发起人原始简报 | 阶段 1 |
| SRC-SIM-0102 | `01-discovery/02-representative-cases.md` | 近期正常与异常案例 | 阶段 1 |
| SRC-SIM-0103 | `01-discovery/03-first-interview-notes.md` | 门店、运维和区域负责人访谈 | 阶段 1 |
| SRC-SIM-0201 | `02-definition/01-baseline-and-target-discussion.md` | 业务分析和目标讨论 | 阶段 2 |
| SRC-SIM-0202 | `02-definition/02-scope-constraints-and-dependencies.md` | 范围、资源和依赖讨论 | 阶段 2 |
| SRC-SIM-0301 | `03-investigation/01-systems-access-and-ownership.md` | IT 系统与访问清单 | 阶段 3 |
| SRC-SIM-0302 | `03-investigation/02-data-sample-and-dictionary.md` | 脱敏数据样例和口径 | 阶段 3 |
| SRC-SIM-0303 | `03-investigation/03-policy-security-and-governance.md` | 合同、权限与治理说明 | 阶段 3 |
| SRC-SIM-0401 | `04-design/01-solution-constraints.md` | 架构与集成约束 | 阶段 4 |
| SRC-SIM-0501 | `05-evaluation/01-evaluation-case-pack.md` | 独立评估案例包 | 阶段 5 |
| SRC-SIM-0601 | `06-pilot/01-pilot-boundary-and-observations.md` | Pilot 授权与观察记录 | 阶段 6 |
| SRC-SIM-0701 | `07-production/01-production-adoption-handoff-evidence.md` | 生产、采用和交接证据 | 阶段 7 |
| SRC-SIM-0801 | `08-improvement/01-operation-signals-and-improvement-candidates.md` | 生产信号和改进候选 | 阶段 8 |

## 预期方法来源分工

| 阶段 | `fde-guide` 主要责任 | 工程仓主要责任 | 产品内置责任 |
|---|---|---|---|
| 1 | 资格判断、重大冲突重新界定 | 定向、访谈、责任和系统勘察 | 项目与人工阶段门 |
| 2 | 价值工程和必要回退 | 需求、可行性、估算、计划和重谈 | 固定结果合同 |
| 3 | 数据适用性和 AI 动作边界 | 访问、流程追踪、数据与历史调查 | 治理分类 |
| 4 | 机制选择和生产级 AI 系统设计 | ADR、接口、NFR、安全改动和适配 | 纵向切片状态 |
| 5 | 产品主张评估 | 验证计划、测试数据、NFR、安全和 CI | 评估确认门 |
| 6 | 生产就绪预审 | 变更流程和部署回滚 | 试点范围、接入、恢复和证据复盘 |
| 7 | 运营模型和客户接管 | 发布、观察、交付包、实操、切换与退役 | 验收与责任记录 |
| 8 | 现场经验产品化 | 事故和可观测性缺口 | 证据复盘、优先级、复测和发布控制 |

## 真实性边界

- 素材中的数字是案例输入，不是 Agent 已经验证的事实。
- “客户说”“访谈记录”“系统日志”“政策规定”必须保留不同证据类型，不能互相替代。
- 阶段 5 评估案例包可以作为固定夹具，但测试通过只能证明该夹具范围内的行为。
- 阶段 6～8 的记录是仿真客户后续提供的观察证据，不是本地真实企业系统运行证明。
- 若工作台无法执行某项动作，应记录为 blocked 或 unverified，不能用案例文本假装工具已经执行。

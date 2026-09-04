---
document: stage-02-runbook
case_id: CASE-SMWO-001
status: ready-to-run
updated: "2026-09-04"
---

# 阶段 2 操作手册：怎样定义结果、范围与责任

## 目标

把阶段 1 已确认的高价值工作流转成可承担责任的业务合同：建立带口径限制的现状基线，区分候选目标与承诺结果，明确 owner、独立验证者、范围、非目标、可行性缺口、成本、依赖、停止条件和风险优先的交付顺序。

阶段 2 不是开始设计 Agent 或承诺生产日期。完成目标是形成三个可审阅的固定 Artifact，并让 FDE 能够依据真实证据决定进入调查、要求修订、收窄或停止。

## 操作前检查

1. 继续使用阶段 1 的同一个工作台项目，不新建第二个项目。
2. 当前阶段显示“阶段 2：定义结果、范围与责任”，并且推进动作来自 FDE 的人工决定。
3. 阶段 1 的三个必需 Artifact 已存在：
   - `fde-deliverables/01-requirement-research/requirement-research-report.md`
   - `fde-deliverables/01-requirement-research/confirmation-checklist.md`
   - `fde-deliverables/01-requirement-research/requirement-baseline.md`
4. 阶段 1 已上传资料及其 SourceId 继续保留在当前项目中，不重复上传。阶段 2 需要引用阶段 1 的访谈、工单、设备台账和政策 PDF。
5. 不上传 `materials/03-investigation/` 及后续目录，也不把本手册或 `STAGE-02-FILE-MANIFEST.json` 上传到项目。

如果换了一个全新项目或阶段 1 Artifact 不存在，先停止。阶段 2 不能只靠本阶段材料替代已经确认的工作流与边界。

## 第一批：建立可追溯的价值基线

### 上传文件

按以下顺序逐个上传。每上传一个文件，先确认保存、预览和识别状态，再继续：

| 顺序 | 文件 | 证据角色 | 预期预览 | 预期识别 |
|---:|---|---|---|---|
| 1 | `materials/02-definition/01-baseline-and-target-discussion.md` | 业务分析和候选目标汇总 | 文本 | ready |
| 2 | `materials/02-definition/upload-pack/03-baseline-metric-export.json` | 三个月基线明细、分母与限制 | 文本 | ready |
| 3 | `materials/02-definition/upload-pack/04-triage-workload-observation.xml` | 一周工作量观察与月度外推 | 文本 | ready |
| 4 | `materials/02-definition/upload-pack/05-cost-assumptions.yaml` | 人工、错误派单和未知成本口径 | 文本 | ready |
| 5 | `materials/02-definition/upload-pack/06-owner-verifier-workshop.txt` | Owner 与验证者候选讨论 | 文本 | ready |

### 输入提示词

复制 [`prompts/02-stage-02-definition.md`](prompts/02-stage-02-definition.md) 中的 Prompt A。

### 预期方法路由

- 主方法：`engineer-ai-value`（界面中文为“算清当前成本和问题影响”）。
- 信息不足时可以按需返回 `qualify-ai-workflow`，但不应把阶段 1 全部重新做一遍。

### 重点观察

- 1,246 条事件是客户提供的一次性离线分析，不是系统已经持续监测的事实。
- 46 分钟时间基线只覆盖 71% 成功匹配的消息与工单，不能丢掉分母限制。
- 286 小时是汇总材料中的四舍五入值；XML 由一周 67.5 小时乘 4.24 得到 286.2 小时，两者不是冲突证据。
- 每小时 120 元和每次错误派单 260 元都不是正式财务标准，不能生成确定 ROI。
- 工作坊中的人员只是候选责任人；参会和表达意愿不等于正式确认。
- 输出应区分已测数据、手工估算、客户目标、项目预测和未知项，并在负责人未确认时保持阻塞。

## 第二批：把结果转成可验收范围并探查可行性

### 上传文件

| 顺序 | 文件 | 证据角色 | 预期预览 | 预期识别 |
|---:|---|---|---|---|
| 1 | `materials/02-definition/02-scope-constraints-and-dependencies.md` | 首期范围、非目标和依赖汇总 | 文本 | ready |
| 2 | `materials/02-definition/upload-pack/07-first-phase-scope.json` | 允许输入、候选输出和禁止动作 | 文本 | ready |
| 3 | `materials/02-definition/upload-pack/08-resource-and-dependency-register.xml` | 客户资源、等待时间和外部依赖 | 文本 | ready |
| 4 | `materials/02-definition/upload-pack/09-current-system-consumption-notes.txt` | 工单草稿的现有人工流程落点 | 文本 | ready |

### 输入提示词

上传完成后，复制阶段 2 Prompt B。

### 预期方法路由

- `requirements-to-spec`（“把成功标准写成可验收要求”）。
- `feasibility-probe`（“检查现有条件是否做得到”）。

### 重点观察

- “人工复制或录入工单草稿”已有一次人工演示；“自动写入工单系统”没有接口、权限或 Sandbox 证据。
- 首期范围明确禁止自动派单、通知、费用承诺和关闭工单。
- Sandbox、信息安全、设备匹配、合同权威版本和账号权限仍是依赖或未知，不能写成已验证。
- 要求应包含角色、触发条件、预期结果、失败回退、非目标和证据取得方式，而不是技术框架清单。

## 第三步：不上传新文件，完成估算和风险计划

### 输入提示词

直接复制阶段 2 Prompt C。本步继续使用阶段 1 资料、前两批阶段 2 资料和已经生成的候选 Artifact，不上传新文件。

### 预期方法路由

- `estimation`（“按证据给出工作量区间”）。
- `delivery-plan`（“按风险排出交付顺序”）。
- 如果三个月期望与范围、资源、治理条件不能同时成立，才按需使用 `escalation-and-renegotiation`。

### 重点观察

- 估算必须是区间，并单列假设、客户等待时间、外部依赖、风险缓冲和置信度。
- 应先安排可能推翻项目的验证：工单草稿是否真正节省时间、设备匹配、合同权威性、Sandbox 与人工复核容量。
- “三个月看到成果”不能自动变成生产上线日期。
- 本步可以给出少量重谈选项，但 Agent 不能代替客户选择，也不能自动推进阶段。

## 第四批：输入正式责任确认并准备人工阶段门

### 上传文件

上传：

`materials/02-definition/upload-pack/10-role-and-boundary-confirmation.md`

这份材料确认 owner、验证者、首期动作边界和停止权限，但故意不确认 Sandbox、接口、设备匹配率、正式成本与生产日期。

### 输入提示词

复制阶段 2 Prompt D。

### 重点观察

- 是否把“候选责任人”更新为已确认责任，同时保留确认来源。
- 是否仍把 15 分钟、12% 和 2% 表达为 Pilot 候选目标，而不是生产承诺。
- 是否更新三个固定 Artifact，而不是新建随意命名的替代文件。
- 是否把尚未解决的系统、数据、权限和成本问题转入下一阶段调查清单。
- Agent 只能报告是否具备人工评审条件；最终 Go、Revise、Narrow 或 Stop 必须由 FDE 点击决定。

## 阶段 2 固定产物

人工评审前检查以下文件：

| 文件 | 最少应包含 |
|---|---|
| `fde-deliverables/02-outcome-scope/outcome-contract.md` | 业务结果、指标口径、范围、非目标、owner、验证者、风险和停止条件 |
| `fde-deliverables/02-outcome-scope/value-case.md` | 当前基线、数据限制、候选收益、完整成本缺口、基本／下行情景和继续投入条件 |
| `fde-deliverables/02-outcome-scope/delivery-plan.md` | 风险优先工作包、区间估算、客户等待、依赖、负责人、证据和决策节点 |
| `.fde/stages/definition.json` | `stage` 固定为 `definition`，真实 SourceId、Artifact 状态、阻塞和 revision |

文件存在不等于内容合格，更不等于阶段自动完成。

## 人工阶段门

FDE 至少核对：

1. 工作流仍是阶段 1 已确认的“人工确认前的分诊与工单草稿”，没有恢复自动派单。
2. 所有重要数字都带分母、窗口、来源和限制。
3. Owner、独立验证者、风险 owner 与停止权限有明确来源。
4. 交付顺序先验证高风险假设，并且不伪造外部访问或日期承诺。
5. 下一阶段要调查的系统、数据、接口、安全和组织问题仍然清晰可见。

满足后，由 FDE 在工作台人工选择 Go；否则选择 Revise、Narrow 或 Stop，并把决定、理由、时间和 revision 写入 [`records/execution-ledger.md`](records/execution-ledger.md)。

## 文件核对

阶段 2 所有输入文件的字节数、SHA-256 和预期识别状态见 [`STAGE-02-FILE-MANIFEST.json`](STAGE-02-FILE-MANIFEST.json)。该清单是操作者核对材料完整性的依据，不上传到案例项目。

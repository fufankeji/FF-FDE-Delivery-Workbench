---
document: stage-03-runbook
case_id: CASE-SMWO-001
stage: investigation
status: ready-to-run
updated: "2026-09-04"
---

# 阶段 3 操作手册：调查数据、系统、接口、安全与组织

## 开始条件

- 继续使用阶段 1、2 的同一个案例项目，不新建项目。
- 阶段 2 已由 FDE 人工决定进入阶段 3；文件存在不等于已经放行。
- 阶段 2 的 `outcome-contract.md`、`value-case.md`、`delivery-plan.md` 均可打开。
- 保留前两阶段所有 SourceId，不重复上传已有的政策 PDF。
- 本阶段只调查事实与边界，不设计架构、不构建本体、不写生产系统、不使用凭据。

## 第一步：账号、访问和数据事实

上传以下 5 个文件：

1. `materials/03-investigation/01-systems-access-and-ownership.md`
2. `materials/03-investigation/02-data-sample-and-dictionary.md`
3. `materials/03-investigation/upload-pack/04-access-request-register.json`
4. `materials/03-investigation/upload-pack/05-field-dictionary.xml`
5. `materials/03-investigation/upload-pack/06-data-profile.yaml`

上传后发送 `prompts/03-stage-03-investigation.md` 的 Prompt A。

重点检查：

- 是否把“能认证、能读取、获准用于当前调查、能写、能执行正式动作”分开。
- 是否识别 `report_id`、`message_id`、候选事件、`asset_id` 和 `work_order_id` 不是同一身份。
- 是否使用 1246 条总体剖析，而没有把 12 条样本外推为总体比例。
- 是否明确 `final_domain`、`final_priority` 只能用于独立评估，不能泄漏进候选生成。
- 是否把“忽略政策”等报修文本当作不可信数据，而不是指令。

## 第二步：真实链路、接口合同和独立读回

上传以下 4 个文件：

1. `materials/03-investigation/upload-pack/07-nanjing-incident-timeline.json`
2. `materials/03-investigation/upload-pack/08-workorder-api-openapi.yaml`
3. `materials/03-investigation/upload-pack/09-sandbox-readback-log.txt`
4. `materials/03-investigation/upload-pack/10-system-version-difference.md`

上传后发送同一提示词文件中的 Prompt B。

重点检查：

- 是否从告警、两条报修、两张工单、人工去重到恢复逐步追踪，并保留未知环节。
- 是否区分 7.4 文档声明、7.3.1 Sandbox 已观察行为和完全未验证的生产环境。
- 是否承认只读 GET 成功、草稿 POST 返回 403、正式派单根本未执行。
- 是否说明每次未来写动作都要有 `operation_id`、幂等键、审计记录和权威系统独立读回。
- 当前没有源码或提交历史，不应为了调用 Skill 而假装进行 Git 历史调查。

## 第三步：分领域治理收口

上传以下 3 个文件：

1. `materials/03-investigation/03-policy-security-and-governance.md`
2. `materials/03-investigation/upload-pack/11-access-boundary-matrix.xml`
3. `materials/03-investigation/upload-pack/12-governance-review-notes.txt`

上传后发送同一提示词文件中的 Prompt C。

重点检查：

- 信息安全、隐私、法务、采购、财务、区域运营和设备运维是否分别记录。
- 是否没有用“隐私通过”替代安全、法务或采购批准。
- 是否保留 P0 人工升级、设备不确定时人工接管和正式派单禁止边界。
- 是否区分“影响当前调查／下一阶段设计”的阻塞与“未来生产上线前才必须解决”的条件。
- 是否只形成阶段 3 固定产物和状态，没有提前写阶段 4 方案。

## 本阶段固定产物

执行 Prompt C 后，检查以下 3 个文件均存在并可打开：

```text
fde-deliverables/03-environment/data-readiness.md
fde-deliverables/03-environment/system-access-map.md
fde-deliverables/03-environment/governance-review.md
```

同时检查 `.fde/stages/investigation.json`：

- `stage` 必须是 `investigation`；
- `status` 只能是 `working`、`blocked` 或 `review-ready`；
- `workItems` 必须是数组，准确记录 `data`、`systems`、`access`、`owners`；
- `blockers` 中高或严重且未解决的事项必须真实存在；
- `recommendation` 只能是 `pending`、`go`、`revise`、`narrow` 或 `stop`。

只有固定产物存在、工作项准确且没有未解决的高／严重阻塞时，状态才可以是 `review-ready`。这仍然不等于已进入阶段 4，最后由 FDE 人工决定。

## 学习对照

| 操作 | 预期方法能力 | 主要来源 |
|---|---|---|
| 第一步 | 访问与入场、数据适用性评估、数据考古 | 工程仓＋`fde-guide` |
| 第二步 | 真实流程追踪、安全 AI 动作边界 | 工程仓＋`fde-guide` |
| 第三步 | 分领域治理复核并收口环境调查 | 产品内置治理分类＋前述方法 |

预期路由只供学习复盘，不是通过条件。实际加载了什么 Skill，必须按工作台结果记录到 `records/execution-ledger.md`。

## 文件核对

`STAGE-03-FILE-MANIFEST.json` 记录本阶段 12 个输入文件的大小和 SHA-256，只供操作者核对，不上传到项目。

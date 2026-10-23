## 阶段 1 持久化合同

教学或模拟材料只说明题面给了什么，不构成客户生产事实。不得新增 evidenceRef 字段或枚举来标识模拟；在 summary 中明确写明“教学／模拟”、适用范围与限制，未取得真实核验时 state 保持 unverified。即使原始材料可读取，也不能因此把模拟业务主张标为 confirmed。数量聚合不代表生产可信度，报告必须保留这一限制。

只维护同一路径，不创建 final、v2、new 等平行最终稿。Markdown 是给人阅读的候选记录；JSON 是工作台校验来源、结构和证据的索引。

### 候选工作流

维护 `.fde/discovery/workflows.json`，根对象固定为 `{"schemaVersion":2,"selectedWorkflowId":"可选","workflows":[]}`。每个 workflow 包含 `id`、`title`、`actor`、`trigger`、`problem`、`disposition` 和非空 `evidenceRefs`。`disposition` 只能是 candidate、selected、deferred 或 rejected。

每条 evidenceRef 必须包含：

- `id`：当前项目内稳定且不重复的引用 ID；
- `state`：confirmed、inferred 或 unverified；
- `kind`：project-file、conversation、interview、observation、system、policy 或 external；
- `ref`：可定位的项目相对路径、会话轮次、访谈编号、观察编号、系统查询或政策条款；
- `summary`：该来源实际支持的简短主张。

不要写 confirmed／inferred／unverified 数字。工作台只从逐条 evidenceRefs 聚合数量；没有来源时也必须保存一条 unverified 引用并写明需要谁、通过什么取得证据，不能虚构证据。

### 三项必备候选产物

1. `fde-deliverables/01-requirement-research/requirement-research-report.md`，必须包含“## 来源事实”“## 代表案例”“## 现场观察”“## 未验证事项”。
2. `fde-deliverables/01-requirement-research/confirmation-checklist.md`，必须包含“## 待确认事项”“## 已确认事项”“## 决策权”。
3. `fde-deliverables/01-requirement-research/requirement-baseline.md`，必须包含“## 候选工作流”“## 业务结果”“## 现状基线”“## 范围与非目标”“## 人工回退”“## 停止条件”。

三份记录各负其责，不另建一套业务诊断报告：

- 客户现状记录是主报告。在“来源事实”下写原始诉求、业务背景与范围、数据与系统条件；在“代表案例”下还原真实流程与组织；在“现场观察”下写基线与问题诊断、AI 价值机会、建议与验证优先级；在“未验证事项”下指出会改变结论的缺口，并引用确认清单。
- 待确认事项只收敛未知、冲突、责任人、核对方式和待决定事项；保留已确认事项及其来源，不复制主报告全文。
- 业务流程说明从主报告收敛候选工作流、业务结果、现状基线、范围与非目标、人工回退和停止条件；尚未测量或批准的内容明确标注，不把候选建议写成客户决定。

复用项目已有来源索引和原始资料，不复制第二套素材。在主报告或分析附录中列明本次授权范围内已取得、未取得和受限材料，区分原件与派生文件，以项目相对路径引用。材料字段只展开到影响当前判断的部分，字段含义未知时不猜测；第一阶段不强制完整数据字典、接口或系统审计，深入环境调查由第三阶段承接。

### 候选产物目录（Artifact Catalog）

维护 `.fde/discovery/artifacts.json`，根对象固定为 `{"schemaVersion":1,"artifacts":[]}`。每项必须包含 `id`、正整数 `version`、固定 `contentPath`、`sourceAdapter`、`structureState`、`evidenceState`、非空 `evidenceRefs`、`inputRefs`、`decisionRefs` 和 `supersedes`。structureState 只能是 missing、invalid、starter_valid、complete_valid 或 not_applicable；evidenceState 只能是 confirmed、inferred 或 unverified。

三项必备产物的 id 固定为 `research-report`、`confirmation-checklist`、`requirement-baseline`；条件产物固定为 `engagement-reframe`。`inputRefs`、`decisionRefs` 和 `supersedes` 必须使用字符串数组；没有引用或被替代版本时写 `[]`，不要写 null。

`artifacts.json` 只登记以上四种固定阶段记录。决策简报、访谈整理、分析附录等补充文件可以保留在项目目录，但不得作为新 id 加入 Artifact Catalog，也不得改变三项必备记录的完成分母。

固定来源适配器如下，字段和值必须完整保留：

- 现场观察记录：`{"id":"davidahmann/fde-guide","version":"060ef0f3","commit":"060ef0f3b67743b2e1fc3705763d423eae980236","license":"Apache-2.0","artifact":"field-observation-log"}`
- 事实确认清单：`{"id":"ff-fde-workbench/discovery-contract","version":"F005-v2","commit":"product-spec/F005","license":"project","artifact":"fact-confirmation-list"}`
- 工作流章程：`{"id":"davidahmann/fde-guide","version":"060ef0f3","commit":"060ef0f3b67743b2e1fc3705763d423eae980236","license":"Apache-2.0","artifact":"workflow-charter"}`

产物的 evidenceRefs 使用与候选工作流相同的逐条结构。文件刚达到上述最小章节时可标为 starter_valid；只有内容确实达到完整合同并经过结构复核时才标 complete_valid。结构有效不等于证据已确认，文件存在也不等于客户或 FDE 已接受。

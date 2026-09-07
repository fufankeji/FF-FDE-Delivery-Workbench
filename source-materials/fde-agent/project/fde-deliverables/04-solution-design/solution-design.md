# 方案设计（候选记录，阶段 4 / design，solution-design）

> 状态说明：候选方案设计，供 FDE 人工审阅。**本体已发布(0.1.1-preview)并在项目空间构建出验证图谱快照 `.fde/design/knowledge-graph.json`；已跑通一条最窄纵向切片（见 §八）。本体/图谱已真实构建≠已通过 Schema 验证/能力问题/阶段验收，仍需 FDE 人工确认；未写生产、未派单。** 分**业务规则**（schema）与**真实数据**，绝不把具体记录写进规则。final_domain/final_priority/final_owner/final_vendor/final_decision **不读取、不参与生成/抽取**（`src_60b7…`/`src_fbbc…`；`src_fdc5…`）。

## 一、六类必答业务问题（写成可查询可验证的形式）

来源 `02-semantic-capability-workshop.md`（SRC-SIM-0402，`src_fdc5…`）。每条是“输入→可证输出”，非空泛“支持多跳”。

| # | 问题（可验证） | 判定/证据 |
|---|---|---|
| CQ-01 | 给定报修 A 与 B（如 R-1002 18:10、R-1003 18:12），能否返回“可能重复候选”（是否同 store 同设备候选、症状相近、≤2h、指向既有工单）？只标候选，**不得自动合并/删除** | 输出重复候选+证据列表；`duplicate_of` 仅作评估不自动写入 |
| CQ-02 | 给定一个报修编号（R-1002），能否列出其消息、门店、设备候选、网络告警、工单与人工决定，并对每条关系标 confirmed/inferred/unknown？ | 逐条事件链，状态可核（南京链 `src_aa42…`） |
| CQ-03 | 给定事件时间、门店、区域、设备类别，能否找出当时适用维修商与合同，并指出合同正文/元数据/值班表冲突？候选不得表达为“已批准派单” | 冲突项并列（杭州案例 `src_4ff1…`/`src_daa3…`） |
| CQ-04 | 若设备身份、合同有效期或政策版本改变，能否指出哪些候选建议/关系/上下文需重估，而非静默保留旧结论？ | 输出受影响对象+重估需求 |
| CQ-05 | 给定 P0/合同不明/费用超限/跨区域请求，能否返回固定人工升级路径与禁止动作，并证明查询未扩大阶段 3 权限？ | 权限结果 ⊆ 已批矩阵（`src_1acf…`） |
| CQ-06 | Agent 生成分诊建议时，能否只返回必要实体/关系/规则/来源/有效时间/置信度/未知项，而非注入整图或历史最终答案？ | 最小上下文契约；不含 final_* |

## 二、整体解决方案

**执行（沿用已 selected 的 hybrid）**：规则硬门 + 普通软件流程 + 检索/语义上下文 + 有界单 Agent 候选 + 人工确认 +（获批后）本地草稿。
**语义（本阶段已建图谱，非空壳）**：本体/知识图谱提供 CQ-01~06 需要的**跨来源统一身份、时间有效性、来源/置信度、变化影响与权限感知上下文**。图谱已用项目隔离 Provider(semantica 0.6.7) 写入 `.fde/design/knowledge-graph.json`（56 节点/56 边/10 社区，ontologyVersion 0.1.1-preview）。**图谱构建成功≠ Schema 验证/能力问题/纵向切片已通过，最终结论仍由 FDE 确认。**

### 组成部分与数据流
- **入口（人工上传）**：脱敏报修文本+可选设备号+SourceId → 存入工作台（不接企业消息平台）。
- **规则硬门（无模型）**：P0/费用阈值/权限/跨区域/重复候选/不可信输入/幂等。
- **语义/本体上下文层（候选）**：解析身份、关联关系、时间窗、来源/置信度，为候选生成提供受控上下文（图谱若建成后；当前仅概念设计）。
- **有界单 Agent/LLM**：抽取门店/设备/症状/影响→故障域/优先级候选→补全建议；输出附证据引用，禁入 final_*。
- **软件流程**：建议→人工复核工作台→草稿生命周期→审计。
- **输出**：建议+引用（工作台）；仅获批后在 Sandbox 本地写草稿并独立 GET 读回。
- **不写**：正式派单/生产/消息通知（forbidden）。

### 各部分负责
- 数据库/接口：字段表存储真实记录与 SourceId。
- 固定规则：确定性硬门（P0/费用/权限/重复提示/幂等）。
- 大模型：自由文本抽取与候选生成（人确认）。
- Agent：按状态调读工具、请求补信息、本地草稿。
- 人工：最终确认、P0/费用/身份/合同不明/跨区域的升级与接管。

### 接口（读/写）
- 读取（已批）：历史工单导出(AR-301)、AssetBook(AR-302)、ContractHub 摘要(AR-303)、江苏区域 Sandbox GET(AR-305 只读已批)。
- 写入：Sandbox 草稿 AR-305 pending——当前运行终点=本地草稿+明确未执行外部写入。
- 禁止写入：生产/正式派单(AR-306)、企业消息(AR-307)、跨区域。**不探测生产。**

## 三、权限与人工确认点
见阶段三 governance-review：P0/费用>500/>5000/设备身份不明/合同不明/跨区域/草稿提交一律人工；execute 全 denied；草稿写 conditional-on-AR-305。

## 四、失败恢复
- P0 提示 5 秒内且不依赖外部模型（规则门独立）。
- 外部失败→降级“信息不足+≤3 个关键问题”→人工；草稿写超时→标 unknown、按 operation_id 读回不重复创建。
- 冲突/设备合同不明→人工，不自动补全。

## 五、NFR（性能/安全/可靠性候选，`src_3b35…`）
- P0 提示 ≤5s 不依赖模型；P1/P2 建议 ≤30s，失败有降级。
- 2h 重复提示不得自动合并；所有外部读写绑定项目/用户/区域/operation_id；写幂等。
- 最小权限；凭据不入提示词/日志；报修文本/合同正文为不可信输入；日志留 SourceId/操作人/决策/读回，不含敏感正文。

## 六、语义设计（本体候选；供人工审阅，未发布）

### 业务对象清单（仅当前案例用到）
门店 Store、设备 Asset、设备类型 AssetType、故障事件（现实故障，无权威主键，用候选）、告警 Alert、报修记录 Report、消息 Message、工单 WorkOrder、合同 Contract、维修商 Vendor、值班安排 Duty、审批规则 Policy/Rule、用户 User、Agent、数据来源 DataSource。

### 对象关键字段（规则层，示例不含具体门店）
- Store: store_id
- Asset: asset_id, label_status, type, location, store
- Report: report_id, reported_at, asset_text, symptom, impact, source
- Message: message_id, report_id?, time, text
- Alert: alert_id, time, asset?, device_type
- WorkOrder: work_order_id, status, store, asset?, priority_candidate, duplicate_of?
- Contract: contract_id, coverage(region/type), valid_from, valid_until, status_meta, source(doc)
- Vendor: vendor_id, categories, regions, duty
- Policy/Rule: rule_id, version, effective
- DataSource: source_id, SourceId, file, retrieved_at
- User/Agent: id, scope, permission

### 关系（对象间，含基数/必填/时间/来源冲突）
（见下方各关系表——为可读，分列）

| 关系 | 从→到 | 多重 | 必填 | 可空 | 建联字段 | 生效时间 | 冲突处理 |
|---|---|---|---|---|---|---|---|
| 拥有设备 | Store→Asset | 1:N | 门店可有 | 可空(无设备) | store_id | 否 | 台账为准，现场标签冲突→人工 |
| 发生故障 | Asset→FaultIncident | 1:N | 否 | 可空 | asset_id 候选 | 事件时间 | 设备候选多映射→人工 |
| 对应故障 | Report→FaultIncident | N:1 | 否(候选) | 可空 | 时间+店+设备+症状(2h) | 否 | 只标候选，不自动合并 |
| 告警来源 | Alert→Asset | N:1 | 否 | 可空 | asset/网络 | 告警时间 | StoreNet 未批→unknown |
| 处理故障 | WorkOrder→FaultIncident | N:1(重复可 N) | 否 | 可空 | 关联推断 | 开单/关闭时间 | duplicate_of 不自动写 |
| 合同覆盖 | Contract→(Store/AssetType) | M:N | 否 | 可空 | region/type/asset | valid_from/until | 元数据 vs 正文→采购/人工 |
| 维修商负责 | Vendor→Region/AssetType | M:N | 否 | 可空 | region/category | 值班表日期 | 值班表不单独作批准 |
| 权限 | User/Agent→对象/动作 | 1:N | 有 | — | scope | — | 权限矩阵为准，不扩大 |
| 来源记录 | 任意实体→DataSource | 1:1..N | 每条重要事实 | 有 SourceId | source_id | 产生时间 | 冲突并列保留 |

### 跨系统身份、去重/合并、可信度/时间/来源规则（规则层，分离真实数据）
- 门店编号对应：同 store_id（主数据）；不同系统文本一致但**不自动合并**（`src_60b7…`）。
- 设备识别：asset_id 唯一标签为准；old-label/多映射/现场 vs 台账 retired→**人工确认**，不据名称相似合并。
- “可能重复”条件：同店同设备候选+症状相近+≤2h+指向既有工单 → 仅候选。
- 确认同一对象：权威主键匹配+人工确认（如 Asset 现场照片+资产管理员；policy）。
- 交人工：设备/优先级/合同/区域任一不明（humanFallback，`src_1acf…`）。
- 低置信度：标 confidence 低，保留来源，不进确定结论。
- 冲突：并列保留来源与版本，不静默选方便值（`src_4ff1…`）。
- 被拒数据：记录 SourceId+拒绝原因。
- 生效时间：contract valid_from/until、保修候选为候选值（PDF 正文权威）；Alert/Report 用产生时间；政策版本用生效版本。
- 可信程度：来源+是否人工确认；无权威读回时标 unknown。
- **规则 vs 数据严格分离**：以上对象/字段/关系/规则 = schema/规则层；南京 S-NJ-011、具体设备、R-1002/R-1003、某合同编号等 = 真实数据实例，绝不写入规则定义。

### 本体构建边界（未做，防误判）
- 图谱**已构建**（快照 `.fde/design/knowledge-graph.json`，56 节点/56 边）；但仍须通过 Schema 验证/能力问题/切片验收，由 FDE 人工确认后才可视为通过。
- 不用演示节点/全局 Demo 填充；不把 final_* 当答案。

## 七、当前发现冲突（并列保留）
- 值班表 V-HVAC-02 active vs 采购提示到期（`src_daa3…`）。
- ContractHub 元数据 vs PDF 正文（正文权威，`src_4ff1…`）。
- 文档 7.4 vs Sandbox 7.3.1（`src_bfd4…`）。
- 设备旧标签 vs 台账 retired（杭州/南京，`src_701f…`/`src_fbbc…`）。

## 八、必须人工确认的内容
本体类/关系/基数/约束；六类问题的判定口径；跨系统身份是否合并；设备身份/合同不明；冲突裁决；权限是否可写草稿；任何写动作。所有候选待 FDE 人工审阅后才 draft/publish。

## 九、纵向切片实测（最窄端到端，南京收银中断主线）

**contextRunId**：`run_f5c64296-09cd-450e-a74a-e4b4d94dd443`（来自已验证图谱的受控查询，seed=INC-CAND-NJXJK-20260821-01）。
**切片运行**：`node fde-deliverables/04-solution-design/vertical-slice/run_slice.js` → exit 0，8 项断言全 PASS。
**产物**：`vertical-slice/run_slice.js` + `vertical-slice/slice-result.json`；`semantic_slice_report` 已提交 succeeded，runId `run_16349213-1635-4222-ba3d-d59d10efc5b1`。

- 输入：真实报修文本 R-1003「收银全挂了！请马上派收银机维修师傅！」（`src_a44e…`）。
- 判定：重复候选 true（同店 NJ-003、间隔 2 分钟、within 120min，候选→WO-88419/R1002，不自动合并）；P0/全店停业人工升级门触发；dispatch=false（AR-306 未授权）。
- 候选生成不含 final_domain/final_priority/final_owner/final_vendor/final_decision；草稿 `OP-SLICE-NJXJK-001` status=local_pending_human（本地草稿、未写 WorkOrder、未派单、未发通知、未承诺费用）；独立读回与写入一致。
- **结果边界**：本切片只验证南京链路 R2/R3 类判断与本地草稿；杭州合同覆盖/设备身份未命中该 input，仍标需人工。**图谱构建与切片成功≠能力问题/阶段验收通过；不替代 FDE 阶段决定。**

## 结论
本设计走本体+知识图谱候选路线，并已构建出项目隔离图谱且跑通一条最窄切片（证据 `src_fdc5…` + 图谱快照 + slice 产物）。**仍需 FDE 人工确认 Schema 验证、六类能力问题与切片是否通过**；若 FDE 判定 schema 足够可回退。人工确认前保持候选草稿。

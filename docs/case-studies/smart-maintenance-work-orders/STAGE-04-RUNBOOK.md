---
document: stage-04-runbook
case_id: CASE-SMWO-001
stage: design
status: ready-to-run
updated: "2026-09-04"
---

# 阶段 4 操作手册：双轴机制、本体与纵向切片

## 开始条件

- 继续使用阶段 1～3 的同一个案例项目，不新建项目。
- 阶段 3 已由 FDE 人工决定进入阶段 4；三个阶段 3 固定产物均可打开。
- 前三阶段已上传材料继续由项目 Workspace 保存，本阶段按 SourceId 绑定，不重复上传。
- Semantica Provider 尚未可用时可以完成机制判断与本体草稿，但构建、验证和纵向切片必须保持未完成，不能伪造结果。
- `STAGE-04-EXPECTED-EVIDENCE.md` 是操作者答案基准，绝对不要上传给 Agent。

## 第一步：双轴机制判断

上传：

1. `materials/04-design/01-solution-constraints.md`

然后发送 `prompts/04-stage-04-design.md` 的 Prompt A。

检查：

- 是否分别比较“如何执行”和“如何表达／查询领域事实”。
- 是否保留普通 Schema、不构建和人工流程等更简单路线。
- 若选择本体路线，理由必须来自跨来源身份、关系、时间、来源冲突和能力问题，而不是因为 Semantica 已安装。
- 此时只能写“需要／不需要／证据不足”，不能写 `validated`。

## 第二步：定义能力问题与候选 Ontology

上传：

1. `materials/04-design/upload-pack/02-semantic-capability-workshop.md`

在当前项目中绑定以下代表材料，不重新上传：

```text
SRC-SIM-0104  报修聊天
SRC-SIM-0105  工单抽样
SRC-SIM-0106  设备台账
SRC-SIM-0107  维修商值班表
SRC-SIM-0109  分级与审批政策
SRC-SIM-0302  数据样例与口径
SRC-SIM-0305  字段词典
SRC-SIM-0307  南京事件链
SRC-SIM-0311  权限边界
SRC-SIM-0313  门店跨系统身份映射
SRC-SIM-0314  合同覆盖与有效期快照
SRC-SIM-0401  方案约束
SRC-SIM-0402  能力问题工作坊
```

然后发送 Prompt B。

Agent 展示候选能力问题、Schema、来源／时间／置信度规则和冲突后，由你人工检查：

- Schema 与实例是否明确分开。
- 类、关系和约束是否都能回到当前项目材料。
- 是否没有把历史 `final_*` 标签放进候选生成上下文。
- 是否将低置信度、冲突和高风险关系保留为候选。

确认无误后，在工作台发布当前 Ontology 版本。没有这一步，不执行 Prompt C。

## 第三步：构建并验证最小知识图谱

不上传新文件。发送 Prompt C。

检查系统是否分别留下：

1. 当前项目与材料绑定版本；
2. Ontology、来源规则、时间规则和 Provider 版本；
3. 解析／抽取候选；
4. 图谱构建运行；
5. 独立结构校验；
6. 六个能力问题的真实查询。

若 Provider 不可用、项目隔离失败、查询未真实运行或任一必答问题失败，保持 `validation_failed` 或 `insufficient_evidence`，不要继续假装已验证。

## 第四步：用图谱上下文跑通业务切片

不上传新文件。发送 Prompt D。

检查：

- P0 是否由确定性规则立即提示人工应急。
- `R-1002`／`R-1003` 是否只标为重复候选，不自动合并。
- 设备、告警和合同不确定项是否保留来源与置信度。
- Agent 是否只得到相关子图，而不是全部图谱或历史最终答案。
- 输出是否止于“有引用的建议＋本地工单草稿”。Sandbox 写入、正式派单、通知和费用承诺必须是“未执行”。

## 第五步：整理给 FDE 评审

不上传新文件。发送 Prompt E，然后使用 `STAGE-04-EXPECTED-EVIDENCE.md` 人工核对。

固定产物：

```text
fde-deliverables/04-solution-design/mechanism-selection.md
fde-deliverables/04-solution-design/solution-design.md
fde-deliverables/04-solution-design/vertical-slice-record.md
.fde/stages/design.json
```

状态要求：

- `stage` 必须是 `design`；
- `workItems` 必须是数组，准确包含 `mechanism`、`architecture`、`slice`、`decision`；
- 本体机制结论只能是 `not_required`、`validated`、`validation_failed` 或 `insufficient_evidence`；
- 本体机制结论和 FDE 的 `Go`／`Revise`／`Narrow`／`Stop` 决定必须分别保存；
- 只有当前版本的结构校验、六个能力问题查询和受控上下文业务切片都有真实证据时，才能候选为 `validated` 和 `review-ready`。

最后仍由你在工作台人工决定是否进入阶段 5。

## 文件核对

`STAGE-04-FILE-MANIFEST.json` 只核对本阶段新增的两个上传文件及复用 SourceId；它和操作者验收基准都不上传。

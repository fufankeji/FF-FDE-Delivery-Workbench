# 阶段 2 手动测试：定义结果、范围与责任

测试项目：本地知识库。按顺序复制下面四段提示词；每次等 Agent 完成并回到“项目工作台”核对状态，再发送下一段。

## 1. 说清楚成功是什么

```text
进入第二阶段。请基于第一阶段已经确认的记录，先整理这个本地知识库项目做到什么才算成功：谁使用、解决什么工作、当前基线、目标、由谁验证。不要补造未知信息；未知项标为待确认。把结果写入 fde-deliverables/02-outcome-scope/outcome-contract.md，并同步更新 .fde/stages/definition.json 的第一步状态。
```

## 2. 划清范围和不做什么

```text
请继续明确本地知识库首版要做和不做的范围、责任人、主要风险、成本上限、停止条件。把结论补充到 outcome-contract.md，并在 fde-deliverables/02-outcome-scope/value-case.md 中记录价值依据、假设和待确认项；更新 definition.json 的第二步状态。
```

## 3. 排出交付顺序

```text
请把已经确认的范围拆成按风险排序的交付计划，说明每个里程碑的结果、负责人、验证方式和依赖。写入 fde-deliverables/02-outcome-scope/delivery-plan.md，并更新 definition.json 的第三步状态。不要因为文件写完就宣称阶段通过。
```

## 4. 整理给 FDE 评审

```text
请核对 outcome-contract.md、value-case.md 和 delivery-plan.md 是否相互一致，列出仍未确认的事实和会阻止继续的条件。材料齐备时把 .fde/stages/definition.json 更新为待 FDE 评审，但不要推进项目阶段，也不要替客户或 FDE 作决定。
```

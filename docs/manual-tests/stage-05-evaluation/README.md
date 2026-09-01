# 阶段 5 手动测试：运行 PoC 与 Eval

测试项目：本地知识库。所有结果必须绑定同一候选版本、数据和运行环境。

## 1. 生成验证方案

```text
进入第五阶段。请固定当前本地知识库候选版本，基于结果合同和方案建立验证计划，包含正常问题、边界问题、失败问题、权限边界、来源引用和人工接管条件。写入 fde-deliverables/05-poc-eval/evaluation-plan.md，并更新 .fde/stages/evaluation.json 的第一步状态。缺少客户样例或阈值时明确标记。
```

## 2. 确认评估边界

```text
请核对评估计划中的候选版本、数据范围、阈值、评分方式和验证人，把尚未确认的项列清楚。确认可运行的部分，更新 evaluation.json 的第二步状态；没有正式阈值的结果只能作为探索性结果。
```

## 3. 运行并记录真实结果

```text
请按已确认的 evaluation-plan.md 运行当前项目能够执行的验证，逐项记录通过、失败、未运行和例外及证据。写入 fde-deliverables/05-poc-eval/evaluation-report.md；把可复现的候选版本和结论写入 evaluation-baseline.md；更新 evaluation.json 的第三步状态。不要把没有证据的项目记为通过。
```

## 4. 整理给 FDE 评审

```text
请核对 evaluation-plan.md、evaluation-report.md 和 evaluation-baseline.md，确认结果都对应同一候选版本，并列出关键失败、旧结果和未运行项。材料齐备时把 .fde/stages/evaluation.json 更新为待 FDE 评审，不要自动判定项目成功。
```

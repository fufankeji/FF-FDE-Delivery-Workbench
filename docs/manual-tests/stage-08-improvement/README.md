# 阶段 8 手动测试：持续改进并沉淀可复用能力

测试项目：本地知识库。阶段 8 是持续运行状态，不是一次性完成页。

## 1. 收集生产信号

```text
进入第八阶段。请从当前项目已有记录中整理业务结果、事故、用户反馈、成本、漂移和现场差异，区分已确认、推断和待验证。写入 fde-deliverables/08-improvement/field-learning-register.md，并更新 .fde/stages/improvement.json 的第一步状态。
```

## 2. 形成改进候选

```text
请选择一项证据最清楚的信号，判断它属于一次异常、配置问题、产品缺陷、新需求还是可复用模式，记录影响范围、责任人、预期结果、风险、回归案例和回滚方式。写入 fde-deliverables/08-improvement/improvement-record.md，并更新 improvement.json 的第二步状态。
```

## 3. 复测并受控发布

```text
请只对当前项目能安全验证的候选执行复测；记录复测结果、审查、批准、发布范围和回滚状态。写入 fde-deliverables/08-improvement/controlled-release-record.md，并更新 improvement.json 的第三步状态。缺批准或复测失败时不得写成已发布。
```

## 4. 整理本轮改进决定

```text
请核对 field-learning-register.md、improvement-record.md 和 controlled-release-record.md，列出需要返回阶段 1 到 7 的工作，以及可复用内容的适用和禁止边界。把 .fde/stages/improvement.json 更新为待 FDE 评审；不要把客户数据、凭据或专有事实沉淀为跨项目资产。
```

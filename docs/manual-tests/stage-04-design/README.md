# 阶段 4 手动测试：设计方案并完成端到端纵向切片

测试项目：本地知识库。目标是选出最合适的机制并证明最窄链路能真实运行。

## 1. 比较可行机制

```text
进入第四阶段。请基于结果合同和现场调查，比较规则、普通软件、全文检索、向量检索、RAG、LLM 或 Agent 等方案，也保留“不构建”的选项。把选择依据和淘汰理由写入 fde-deliverables/04-solution-design/mechanism-selection.md，并更新 .fde/stages/design.json 的第一步状态。
```

## 2. 设计系统边界和合同

```text
请为选中的本地知识库方案整理组件、数据流、接口、身份权限、人工确认、失败处理、降级和回滚方式。写入 fde-deliverables/04-solution-design/solution-design.md，并更新 design.json 的第二步状态。方案不得扩大第三阶段确认的权限。
```

## 3. 跑通最窄纵向切片

```text
请只实现或验证一条最窄链路：选择一份允许使用的文档，完成导入、检索、回答和来源引用，并保存实际命令、结果和失败点。把运行记录写入 fde-deliverables/04-solution-design/vertical-slice-record.md，并更新 design.json 的第三步状态；没有真实运行就标为未完成。
```

## 4. 整理给 FDE 评审

```text
请核对 mechanism-selection.md、solution-design.md 和 vertical-slice-record.md 是否对应同一方案与范围，列出未知合同、未跑通链路和新增风险。材料齐备时把 .fde/stages/design.json 更新为待 FDE 评审，不要自动进入下一阶段。
```

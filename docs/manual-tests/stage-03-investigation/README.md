# 阶段 3 手动测试：调查数据、系统、接口、安全与组织

测试项目：本地知识库。按顺序复制，未知权限和客户事实必须保留为待确认。

## 1. 列出要调查的现场

```text
进入第三阶段。请基于已确认的结果和范围，列出本地知识库涉及的数据来源、应用、接口、代码目录、使用人和责任人，只调查完成首版所必需的范围。把数据调查写入 fde-deliverables/03-environment/data-readiness.md，并更新 .fde/stages/investigation.json 的第一步状态。
```

## 2. 核对真实系统和访问条件

```text
请在当前项目内做只读调查，记录实际目录、启动方式、数据流、接口、账号或权限缺口，不要扫描工作区外目录。把系统和访问关系写入 fde-deliverables/03-environment/system-access-map.md，并更新 investigation.json 的第二步状态。声明与观察不一致时两者都保留。
```

## 3. 核对安全、隐私和法务边界

```text
请整理本地知识库对客户文档、模型调用、日志、导出和人工审批的安全、隐私、法务边界，三类审查分别记录，不互相代替。写入 fde-deliverables/03-environment/governance-review.md，并更新 investigation.json 的第三步状态；没有有权确认人的项目保持待确认。
```

## 4. 整理给 FDE 评审

```text
请核对 data-readiness.md、system-access-map.md 和 governance-review.md，列出缺权限、无责任人、事实冲突和治理阻塞。材料齐备时把 .fde/stages/investigation.json 更新为待 FDE 评审，但不要推进阶段或代替任何批准人确认。
```

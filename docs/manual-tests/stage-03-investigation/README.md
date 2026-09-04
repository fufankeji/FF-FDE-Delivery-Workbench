# 阶段 3 手动测试：调查数据、系统、接口、安全与组织

测试项目：本地知识库。按顺序复制，未知权限和客户事实必须保留为待确认。第三阶段只做真实环境尽职调查，不构建本体、不设计系统架构、不选择模型，也不开始开发。

每轮都必须把 `.fde/stages/investigation.json` 的 `workItems` 写成四项数组，并维护 `investigation` 对象中的五组数组：`systems`、`connections`、`actionBoundaries`、`dataFindings`、`governanceReviews`。没有证据的项目保持空数组或 `pending`，不得用示例业务数据补齐驾驶舱。

## 1. 列出要调查的现场

```text
进入第三阶段。请基于已确认的结果和范围，列出本地知识库涉及的数据来源、应用、接口、代码目录、使用人和责任人，只调查完成首版所必需的范围。把数据调查写入 fde-deliverables/03-environment/data-readiness.md，并更新 .fde/stages/investigation.json：第一步完成后，将真实数据发现写入 investigation.dataFindings；缺少证据的值保持 pending。
```

## 2. 核对真实系统和访问条件

```text
请在当前项目内做只读调查，记录实际目录、启动方式、数据流、接口、账号或权限缺口，不要扫描工作区外目录。把系统和访问关系写入 fde-deliverables/03-environment/system-access-map.md，并用真实稳定 ID 更新 investigation.systems 与 investigation.connections。连接只能引用已登记节点；声明与观察不一致时两者都保留。
```

## 3. 核对安全、隐私和法务边界

```text
请分别核对本地知识库对客户文档、模型调用、日志、导出和人工审批的读取、生成建议、写草稿与正式执行边界，并整理安全、隐私、法务、采购、财务和业务责任。写入 fde-deliverables/03-environment/governance-review.md，更新 investigation.actionBoundaries 与 investigation.governanceReviews；每类动作和审查独立记录，没有有权确认人的项目保持 pending。
```

## 4. 整理给 FDE 评审

```text
请核对 data-readiness.md、system-access-map.md 和 governance-review.md，列出缺权限、无责任人、事实冲突和治理阻塞，并补齐 investigation 中所有已有证据的结构化投影。只有四个 workItems 全部 complete、三份固定产物真实存在、investigation 对象有效且没有未解决的 high／critical 阻塞时，才把状态更新为 review-ready；不要推进阶段或代替任何批准人确认。
```

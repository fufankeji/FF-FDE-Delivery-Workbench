---
document: feature-spec
feature: F006
title: 产物血缘、可视化与版本化报告
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 分析证据可复核并形成不可变报告版本
updated: 2026-08-27
---

# F006 · 产物血缘、可视化与版本化报告

## 用户结果

用户可以从查询、派生数据、代码、图表、模型、预测和报告回看父级证据，并把经过选择的项目产物组织为可持续修订、恢复和导出的报告版本。

## 行为规格

1. Artifact 记录 ProjectId、类型、名称、路径、SHA-256、状态、metadata、lineage 和创建时间。
2. 产物页按当前项目展示对象和父子关系，下载/数据读取必须再次校验项目与路径。
3. 图表保存结构化规格和父 ArtifactId，交互数据来自受控项目产物。
4. 创建报告时必须提供当前项目真实 ArtifactId；Evidence Audit 标记缺少证据、质量或可解释性项。
5. 报告 Markdown、引用产物、note、based_on_version 和可选 RunId 按版本保存。
6. revise 和 restore 均创建新版本，历史版本内容、文件和元数据不可变。
7. 指定版本可以生成 HTML；渲染失败不破坏 Markdown 版本，用户可以重试。
8. 图表数据以内联安全 JSON 嵌入，Markdown/HTML 处理防止脚本内容突破页面。

## 边界与失败

- 其他项目 ArtifactId、不存在文件或跨项目 Run 不能进入报告。
- 报告不能从明细样本自动推断业务排名或结论；证据不足必须显式标记。
- HTML 是 Markdown 版本的派生表现，不能反向覆盖报告正文。

## 验收

用户可创建 v1、修订出 v2、从 v1 恢复出 v3，三版均可读取；报告引用真实图表并通过安全序列化，渲染失败后版本仍可恢复。

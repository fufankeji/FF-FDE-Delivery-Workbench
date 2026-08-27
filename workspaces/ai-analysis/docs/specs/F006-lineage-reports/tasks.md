---
document: feature-tasks
feature: F006
title: 产物血缘、可视化与版本化报告
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 分析证据可复核并形成不可变报告版本
updated: 2026-08-27
---

# F006 任务与证据

- [x] T001 建立 Artifact 哈希、元数据和 lineage 合同。
  - Evidence: `models.py::Artifact`、`Repository.add_artifact`。
- [x] T002 实现项目产物列表、数据/视觉读取和下载。
  - Evidence: `api.py` artifacts/data/visuals/download 路由、`ArtifactsPage.tsx`。
- [x] T003 实现图表 Artifact 与父数据关系。
  - Evidence: `query_service.py::write_chart_spec`、图表 API 与测试。
- [x] T004 实现报告证据审计和 Markdown 创建。
  - Evidence: `ReportService.evidence_audit`、`ReportService.create`。
- [x] T005 实现修订、恢复和不可变版本。
  - Evidence: `ReportService.revise/restore`、报告版本测试。
- [x] T006 实现 HTML 渲染、失败恢复和安全图表嵌入。
  - Evidence: `report_service.py`、`test_reports_skills.py` 的渲染/注入用例。
- [x] T007 实现报告画布与版本审阅页面。
  - Evidence: `ReportsPage.tsx`、`ReportCanvas.tsx` 及组件测试。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

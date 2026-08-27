---
document: feature-tasks
feature: F003
title: 数据质量、清洗与特征工程
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 派生数据处理链可追溯
updated: 2026-08-27
---

# F003 任务与证据

- [x] T001 建立受控表格 Artifact 加载器。
  - Evidence: `backend/northlight/analysis_service.py::load_tabular_artifact`。
- [x] T002 实现数据质量画像产物。
  - Evidence: `AnalysisService.profile`、`backend/tests/test_analysis.py`。
- [x] T003 实现非覆盖式数据清洗。
  - Evidence: `AnalysisService.clean`、`backend/tests/test_analysis.py`。
- [x] T004 实现非覆盖式特征工程。
  - Evidence: `AnalysisService.engineer_features`、`backend/tests/test_analysis.py`。
- [x] T005 持久化父产物、参数、哈希和 lineage。
  - Evidence: `AnalysisService._persist_derived`、`Repository.add_artifact`。
- [x] T006 在探索与产物页面暴露处理结果。
  - Evidence: `frontend/src/pages/ExplorePage.tsx`、`ArtifactsPage.tsx`。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

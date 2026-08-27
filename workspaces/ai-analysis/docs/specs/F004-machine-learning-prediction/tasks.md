---
document: feature-tasks
feature: F004
title: 机器学习训练与预测
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 三类模型训练与预测可复现
updated: 2026-08-27
---

# F004 任务与证据

- [x] T001 建立统一预处理和训练输入校验。
  - Evidence: `backend/northlight/ml_service.py::build_preprocessor`、`MLService.run`。
- [x] T002 实现分类、回归和聚类算法路径。
  - Evidence: `classification_estimator`、`regression_estimator`、`MLService._cluster`。
- [x] T003 记录指标、参数、特征重要性和复现代码。
  - Evidence: `MLService._persist`、`reproduction_code`。
- [x] T004 实现后台 ModelJob 状态、超时与取消。
  - Evidence: `model_jobs.py`、`api.py` model-jobs 路由、取消测试。
- [x] T005 实现模型预测并登记 Predictions Artifact。
  - Evidence: `MLService.predict`、`backend/tests/test_agent_ml.py` 聚类预测用例。
- [x] T006 实现模型配置与状态审阅页面。
  - Evidence: `frontend/src/pages/ModelPage.tsx`。
- [x] T007 覆盖分类/软投票、聚类、取消和可复现性。
  - Evidence: `backend/tests/test_agent_ml.py`。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

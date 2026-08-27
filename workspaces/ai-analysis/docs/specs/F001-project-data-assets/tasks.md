---
document: feature-tasks
feature: F001
title: 项目与数据资产管理
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 项目隔离与多数据源接入可用
updated: 2026-08-27
---

# F001 任务与证据

- [x] T001 建立项目、来源、资产与绑定关系模型。
  - Evidence: `backend/northlight/models.py`、`repository.py`。
- [x] T002 实现项目 workspace 创建、重命名/归档、导出与受控删除。
  - Evidence: `repository.py`、`workspace.py`、`backend/tests/test_workspace_repository.py`。
- [x] T003 实现 CSV、Excel、SQLite、MySQL 画像与指纹。
  - Evidence: `data_sources.py`、`backend/tests/test_data_query.py`。
- [x] T004 实现全局资产登记、预览、字典、绑定和使用中删除保护。
  - Evidence: `data_assets.py`、`backend/tests/test_data_assets.py`。
- [x] T005 实现首页、数据资产和项目来源操作界面。
  - Evidence: `HomePage.tsx`、`DataPage.tsx`、`SourcesPage.tsx`。
- [x] T006 覆盖跨项目隔离、来源变化、损坏和大小边界。
  - Evidence: `test_workspace_repository.py`、`test_data_query.py`。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

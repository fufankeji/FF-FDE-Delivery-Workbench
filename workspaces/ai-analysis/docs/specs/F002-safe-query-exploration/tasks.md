---
document: feature-tasks
feature: F002
title: 安全查询与数据探索
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 只读查询与图表探索可用
updated: 2026-08-27
---

# F002 任务与证据

- [x] T001 实现只读 SQL AST 校验和 LIMIT 重写。
  - Evidence: `backend/northlight/query_service.py::validate_read_only_sql`、`apply_limit`。
- [x] T002 限定文件查询和 MySQL 表访问范围。
  - Evidence: `validate_file_query_scope`、`validate_mysql_query_scope`、对应测试。
- [x] T003 实现四类 Source 查询执行与超时/大小限制。
  - Evidence: `QueryService`、`backend/tests/test_data_query.py`。
- [x] T004 持久化查询 Artifact、SQL 元数据和 lineage。
  - Evidence: `QueryService.run`、`Repository.add_artifact`。
- [x] T005 实现结果分页、排序、筛选、下载与图表创建。
  - Evidence: `api.py` artifact data/download/chart 路由、`ExplorePage.tsx`、`ChatPage.tsx`。
- [x] T006 覆盖写语句、多语句、越界文件函数、未登记表和超时失败。
  - Evidence: `backend/tests/test_data_query.py`。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

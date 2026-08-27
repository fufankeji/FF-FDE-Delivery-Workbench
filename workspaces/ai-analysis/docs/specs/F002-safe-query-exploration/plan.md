---
document: feature-plan
feature: F002
title: 安全查询与数据探索
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 只读查询与图表探索可用
updated: 2026-08-27
---

# F002 实施计划

## 实施切片

1. 用 SQLGlot 冻结只读 AST 与单语句合同。
2. 为 CSV、Excel、SQLite、MySQL 建立数据源特定执行器和范围校验。
3. 应用行数、时间、文件大小和数据库表边界。
4. 将结果原子写入项目 Artifact，保留 SQL、哈希、元数据与 lineage。
5. 提供服务端分页/排序/字面筛选与下载接口。
6. 在探索页和对话结果面板提供 SQL、表格与图表操作。

## 影响范围

`query_service.py`、`api.py`、`ExplorePage.tsx`、`ChatPage.tsx`、`api.ts`、Artifact 存储。

## 风险与回退

- SQL 方言差异：校验与实际执行使用对应 dialect，无法可靠解析时拒绝。
- 大结果内存压力：服务端强制 LIMIT，预览与下载走已保存 Artifact。
- SQLite CPU 查询超时：使用可中断执行；超时不登记 ready 结果。

## 验证

以 `backend/tests/test_data_query.py` 的只读、范围、LIMIT、超时、Excel Join、分页和来源恢复用例为主要证据。

---
document: feature-spec
feature: F002
title: 安全查询与数据探索
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 只读查询与图表探索可用
updated: 2026-08-27
---

# F002 · 安全查询与数据探索

## 用户结果

用户可以对当前项目已绑定来源执行可复核的只读 SQL，查看有界结果，并把结果保存为查询产物或图表，而不会写入生产数据或读取未登记主机文件/数据库表。

## 行为规格

1. 查询必须指定当前项目 SourceId，服务端再次校验项目归属和 ready 状态。
2. SQLGlot 解析后只允许一条只读查询，拒绝 DDL、DML、事务和多语句。
3. CSV/Excel 使用受控 DuckDB 视图；SQLite 在只读/超时边界内执行；MySQL 只允许 Source 中登记的表。
4. 用户提供的较小 LIMIT 保留，过大或未提供的结果被服务端上限截断。
5. 结果写入项目 Query Artifact，记录 SQL、SourceId、行列、路径、哈希和 lineage。
6. 用户可分页、排序、字面筛选、下载结果，并基于查询/表格产物保存柱状、折线、散点等图表规格。

## 安全边界

- 禁止 DuckDB `read_csv`、`read_parquet` 等任意主机文件函数越过当前 Source。
- MySQL 即使数据库账号可见更多表，也只允许已导入资产/Source 的表集合。
- 查询超时或取消不发布成功 Artifact；错误信息不回显秘密连接串。

## 验收

- 写语句、多语句、主机文件函数和未登记 MySQL 表均被拒绝。
- CSV、Excel 多 Sheet 和 SQLite 合法查询返回真实结果并形成 Artifact。
- 结果分页/筛选不改变原始 Artifact，图表引用明确父产物。

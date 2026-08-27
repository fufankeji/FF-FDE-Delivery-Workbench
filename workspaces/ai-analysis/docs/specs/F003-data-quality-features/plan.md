---
document: feature-plan
feature: F003
title: 数据质量、清洗与特征工程
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 派生数据处理链可追溯
updated: 2026-08-27
---

# F003 实施计划

## 实施切片

1. 统一从项目 Artifact 加载表格数据并校验项目归属。
2. 实现质量画像并把摘要保存为独立 Artifact。
3. 实现参数化清洗，输出新文件与影响统计。
4. 实现参数化特征工程，输出新列和转换元数据。
5. 统一写入 SHA-256、父 ArtifactId 和 lineage。
6. 在探索页提供显式动作和新产物反馈。

## 影响范围

`analysis_service.py`、`repository.py`、`api.py`、`ExplorePage.tsx`、`ArtifactsPage.tsx`。

## 风险与回退

- 数据类型推断可能改变业务含义：所有转换必须来自显式参数，保留上游供回退。
- 大表处理资源占用：继续服从项目来源与执行上限；失败不覆盖旧产物。
- 质量摘要被误当业务结论：UI 和报告保留“证据/结果”语义，不自动确认。

## 验证

使用 `backend/tests/test_analysis.py` 验证画像、清洗、特征的产物数量、类型、lineage 和文件存在性。

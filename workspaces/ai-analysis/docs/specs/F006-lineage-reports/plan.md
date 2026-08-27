---
document: feature-plan
feature: F006
title: 产物血缘、可视化与版本化报告
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 分析证据可复核并形成不可变报告版本
updated: 2026-08-27
---

# F006 实施计划

## 实施切片

1. 统一 Artifact 类型、SHA-256、metadata 和 lineage 合同。
2. 提供项目范围的产物列表、数据/视觉读取和下载能力。
3. 建立报告证据审计和基于明确 Artifact 的默认 Markdown。
4. 使用 report_key + 单调 version 保存创建、修订和恢复结果。
5. 以 Jinja/Markdown 渲染指定版本 HTML，并安全嵌入图表数据。
6. 在产物页、对话结果和报告画布中提供审阅、选择、版本与导出。

## 影响范围

`models.py`、`repository.py`、`report_service.py`、`query_service.py`、`api.py`、`ArtifactsPage.tsx`、`ReportsPage.tsx`、`ReportCanvas.tsx`。

## 风险与回退

- 报告文本夸大证据：Evidence Audit 和默认模板明确缺口，不从样本推断结论。
- HTML 注入：Markdown 渲染、图表 JSON 和模板均采用安全编码。
- 版本覆盖：只追加新版本；渲染失败不更新旧记录。
- 文件丢失：Artifact/Report 路径在项目根内校验，错误明确暴露。

## 验证

以 `backend/tests/test_reports_skills.py` 的版本、跨 Run 约束、渲染恢复、证据审计、图表嵌入与脚本安全用例，以及前端 ReportCanvas 测试为证据。

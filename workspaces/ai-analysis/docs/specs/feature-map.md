---
document: feature-map
title: DS4-AI 数据分析系统 Feature Map
status: completed
updated: 2026-08-27
---

# DS4-AI 数据分析系统 Feature Map

| Feature | 用户结果 | 依赖 | 当前状态 | 主要源码/测试证据 |
|---|---|---|---|---|
| F001 项目与数据资产管理 | 建立隔离项目，登记并复用真实数据源 | 无 | completed | `repository.py`、`data_assets.py`、`data_sources.py`、`HomePage.tsx`、`DataPage.tsx`、`test_workspace_repository.py`、`test_data_assets.py` |
| F002 安全查询与数据探索 | 对项目来源执行受控只读查询并生成表格/图表 | F001 | completed | `query_service.py`、`ExplorePage.tsx`、`test_data_query.py` |
| F003 数据质量、清洗与特征工程 | 在不覆盖上游的前提下形成可追溯派生产物 | F001, F002 | completed | `analysis_service.py`、`ExplorePage.tsx`、`test_analysis.py` |
| F004 机器学习训练与预测 | 训练分类/回归/聚类模型并形成预测与复现证据 | F001, F003 | completed | `ml_service.py`、`model_jobs.py`、`ModelPage.tsx`、`test_agent_ml.py` |
| F005 Agent 对话、运行与 Skills | 用自然语言和可装配 Skills 驱动真实分析运行 | F001-F004 | completed | `agent_runtime.py`、`skill_service.py`、`ChatPage.tsx`、`SkillsPage.tsx`、`test_agent_ml.py`、`test_reports_skills.py`、`test_skill_sandbox_integration.py` |
| F006 产物血缘、可视化与版本化报告 | 复核数据/图表/模型关系并持续生成不可变报告版本 | F002-F005 | completed | `report_service.py`、`ArtifactsPage.tsx`、`ReportsPage.tsx`、`ReportCanvas.tsx`、`test_reports_skills.py` |
| F007 运行配置、沙箱与系统管理 | 安全配置模型/数据库并可安装、启动、诊断、停止系统 | F001-F006 | completed | `settings.py`、`connection_settings.py`、`runtime_probe.py`、`SettingsPage.tsx`、`scripts/`、`test_settings.py`、`test_model_connection_api.py`、`test_sandbox_contract.py` |

## 依赖顺序

```text
F001 项目/数据
  └─→ F002 查询/探索
       └─→ F003 清洗/特征
            └─→ F004 模型/预测
F001-F004 ─→ F005 Agent/Skills
F002-F005 ─→ F006 血缘/报告
F001-F006 ─→ F007 运行与管理边界
```

Feature 是用户可独立验收的结果，不按前端、后端或数据库层拆分。`completed` 表示存在 as-built 源码和测试证据；本轮是否已经重新执行全部命令以研发基线为准。

# 源码与测试证据台账

> 生成日期：2026-08-27  
> 用途：记录本轮逆向研发文档所依据的可核查项目事实。

| 领域 | 源码证据 | 测试/运行证据 |
|---|---|---|
| 项目隔离与生命周期 | `backend/northlight/repository.py`、`workspace.py`、`models.py`、`frontend/src/pages/HomePage.tsx` | `backend/tests/test_workspace_repository.py` |
| 数据资产与来源 | `data_assets.py`、`data_sources.py`、`DataPage.tsx`、`SourcesPage.tsx` | `test_data_assets.py`、`test_data_query.py` |
| 只读查询与图表 | `query_service.py`、`api.py`、`ExplorePage.tsx` | `test_data_query.py` |
| 画像/清洗/特征 | `analysis_service.py`、`ExplorePage.tsx` | `test_analysis.py` |
| 模型与预测 | `ml_service.py`、`model_jobs.py`、`ModelPage.tsx` | `test_agent_ml.py` |
| Agent 运行 | `agent_runtime.py`、`ChatPage.tsx`、SQLAlchemy `AnalysisRun`/`RunStep` | `test_agent_ml.py` |
| Skills 与沙箱 | `skill_service.py`、`backend/northlight/skills/`、`SkillsPage.tsx`、`scripts/build-sandbox.sh` | `test_reports_skills.py`、`test_skill_sandbox_integration.py`、`test_sandbox_contract.py` |
| 报告与血缘 | `report_service.py`、`ArtifactsPage.tsx`、`ReportsPage.tsx`、`ReportCanvas.tsx` | `test_reports_skills.py`、前端 ReportCanvas 测试 |
| 设置与凭据 | `settings.py`、`connection_settings.py`、`runtime_probe.py`、`SettingsPage.tsx` | `test_settings.py`、`test_model_connection_api.py`、`test_lan_access.py` |
| 安装与运行 | `pyproject.toml`、`frontend/package.json`、`scripts/start.sh`、`scripts/stop.sh`、`.env.example` | README/INSTALL 中的健康检查与测试命令；本轮执行结果见研发基线 |

## 未作为完成证据的内容

- `MANIFEST.json` 证明交付包曾登记文件哈希，不等于当前机器重新运行通过。
- README/INSTALL 的命令说明不等于本轮已经执行这些命令。
- 页面组件存在不等于真实 API 调用成功，仍需对应后端测试或手动旅程验证。
- 已有 FDE 需求/方案产物可解释产品意图，但本轮 Feature 完成状态以当前源码和测试文件为主。

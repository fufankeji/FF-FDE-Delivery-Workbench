---
document: feature-tasks
feature: F005
title: Agent 对话、运行与 Skills
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 自然语言分析运行可观察且可扩展
updated: 2026-08-27
---

# F005 任务与证据

- [x] T001 实现意图路由并隔离普通对话与数据工具。
  - Evidence: `agent_runtime.py::classify_intent`、普通聊天不调用工具测试。
- [x] T002 持久化 Message、Run、Step、取消、重试和 Artifact 关系。
  - Evidence: `models.py`、`repository.py`、`test_agent_ml.py`。
- [x] T003 接入流式在线 Agent 和 SQLite Checkpointer。
  - Evidence: `AgentRuntime.respond_events`、`get_agent_checkpointer`。
- [x] T004 实现 Skills 安装、检查、默认、启用、升级、禁用和卸载。
  - Evidence: `skill_service.py`、`api.py`、`test_reports_skills.py`。
- [x] T005 防止 Skill 路径穿越与权限升级。
  - Evidence: `test_skill_archive_rejects_path_traversal`、`test_skill_manifest_requires_permissions_and_rejects_permission_escalation`。
- [x] T006 实现无网络脚本沙箱与项目产物回收。
  - Evidence: `SkillService.run_script`、`scripts/build-sandbox.sh`、沙箱测试。
- [x] T007 实现对话运行与 Skill 管理界面。
  - Evidence: `frontend/src/pages/ChatPage.tsx`、`SkillsPage.tsx`。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

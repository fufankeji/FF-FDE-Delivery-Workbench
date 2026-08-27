---
document: feature-plan
feature: F005
title: Agent 对话、运行与 Skills
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 自然语言分析运行可观察且可扩展
updated: 2026-08-27
---

# F005 实施计划

## 实施切片

1. 建立意图分类与普通对话/分析运行分离合同。
2. 为分析运行持久化 Message、AnalysisRun、RunStep、来源、Skill 和 Artifact 关系。
3. 装配受控数据/模型/报告工具并实现 SSE 事件规范化。
4. 接入 SQLite Agent Checkpointer、失败恢复、取消与 Run 重试。
5. 建立 Skill 内容格式、安装目录、版本哈希、权限和项目启用关系。
6. 为脚本型 Skill 增加无网络 Docker 沙箱与项目产物发布边界。
7. 在对话/Skills 页面展示运行、工具、产物和管理动作。

## 影响范围

`agent_runtime.py`、`skill_service.py`、`repository.py`、`models.py`、`api.py`、`ChatPage.tsx`、`SkillsPage.tsx`、内置 Skills、沙箱脚本。

## 风险与回退

- 模型不稳定或重复工具调用：Run/Step 先持久化，产物以服务端登记为准，可取消/重试。
- 隐藏推理泄漏：只记录用户可见计划、工具与结果，不保存 chain-of-thought。
- 第三方 Skill 恶意文件/脚本：归档路径、权限和容器网络/文件系统三层限制。
- 模型不可用：本地确定性功能不受影响，在线聊天明确提示配置。

## 验证

以后端 `test_agent_ml.py`、`test_reports_skills.py`、`test_skill_sandbox_integration.py` 和 `test_sandbox_contract.py` 为主，前端对话页测试验证展示与交互。

---
document: feature-plan
feature: F004
title: 机器学习训练与预测
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 三类模型训练与预测可复现
updated: 2026-08-27
---

# F004 实施计划

## 实施切片

1. 建立当前项目表格 Artifact 加载与训练字段校验。
2. 组合数值/类别预处理和分类、回归、聚类算法适配。
3. 记录拆分、随机种子、调参、指标、特征重要性与复现代码。
4. 将训练包装为可查询、可取消的 ModelJob。
5. 持久化 Model Artifact，并实现对新数据的 Predictions Artifact。
6. 在模型页提供任务配置、状态轮询、取消和结果审阅。

## 影响范围

`ml_service.py`、`model_jobs.py`、`api.py`、`ModelPage.tsx`、Artifact/Job 运行文件。

## 风险与回退

- 数据泄漏和指标误读：显式区分目标/特征，保存完整配置与多指标。
- 训练耗时：后台 Job、超时和取消，不阻塞 API 主线程。
- 反序列化/跨版本：模型只在受控本地项目中读取，保存复现代码和库版本线索。

## 验证

以 `backend/tests/test_agent_ml.py` 中分类、软投票、聚类原始特征预测、复现代码和取消用例为证据；性能基准另行执行。

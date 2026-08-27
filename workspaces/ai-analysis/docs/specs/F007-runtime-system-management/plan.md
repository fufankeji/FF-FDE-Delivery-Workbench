---
document: feature-plan
feature: F007
title: 运行配置、沙箱与系统管理
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 本地安装运行、配置与诊断边界可用
updated: 2026-08-27
---

# F007 实施计划

## 实施切片

1. 固定 Python/Node 版本、依赖锁和公开 `.env.example`。
2. 实现前后端启动、PID/日志、健康等待、端口覆盖和精确停止。
3. 实现运行概况、模型状态、MySQL 检查/导入 API 和设置页。
4. 为模型配置写操作增加同 Host Origin、Secret 请求、连接测试和原子凭据保存。
5. 为 Skill 脚本建立 Docker 构建与无网络/只读根约束。
6. 提供可选 MySQL/Olist/benchmark 脚本和明确依赖说明。
7. 冻结静态检查、类型、单元、构建和 e2e 命令。

## 影响范围

`settings.py`、`connection_settings.py`、`runtime_probe.py`、`main.py`、`api.py`、`SettingsPage.tsx`、`scripts/`、`.env.example`、`pyproject.toml`、`frontend/package.json`。

## 风险与回退

- 凭据泄漏：最小字段写入权限文件，状态/异常/导出统一脱敏。
- 启停误杀其他进程：只读取本项目 PID 文件并校验，停止不按端口广泛杀进程。
- CORS 与多人访问混淆：私网 Origin 仅用于页面访问，不宣称已实现账号鉴权。
- Docker 不可用：脚本 Skill 明确失败，其他能力不受影响。

## 验证

使用 `test_settings.py`、`test_model_connection_api.py`、`test_lan_access.py`、`test_sandbox_contract.py` 和安装说明中的健康/构建命令；本轮实际执行结果写入研发基线。

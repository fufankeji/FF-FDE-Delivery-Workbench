---
document: feature-tasks
feature: F007
title: 运行配置、沙箱与系统管理
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 本地安装运行、配置与诊断边界可用
updated: 2026-08-27
---

# F007 任务与证据

- [x] T001 固定 Python/Node 依赖与测试命令。
  - Evidence: `pyproject.toml`、`uv.lock`、`frontend/package.json`、`frontend/pnpm-lock.yaml`。
- [x] T002 实现前后端启动、日志、健康等待、端口覆盖和停止。
  - Evidence: `scripts/start.sh`、`scripts/stop.sh`、README/INSTALL。
- [x] T003 实现运行概况和设置页面。
  - Evidence: `runtime_probe.py`、`api.py::system_overview`、`SettingsPage.tsx`。
- [x] T004 实现模型连接测试、同 Host 保护和受控凭据保存。
  - Evidence: `connection_settings.py`、模型连接 API、`test_model_connection_api.py`、`test_settings.py`。
- [x] T005 实现 MySQL 检查和明确表导入。
  - Evidence: `api.py` MySQL inspect/import 路由、`SettingsPage.tsx`。
- [x] T006 实现 Skill Docker 沙箱构建和路径/网络限制。
  - Evidence: `scripts/build-sandbox.sh`、沙箱测试。
- [x] T007 提供可选 MySQL、Olist 和性能诊断脚本。
  - Evidence: `scripts/mysql-local.sh`、`scripts/prepare_olist.py`、`scripts/benchmark_million.py`。
- [x] T008 覆盖 CORS、配置上限、凭据不回显与沙箱边界。
  - Evidence: `test_lan_access.py`、`test_settings.py`、`test_model_connection_api.py`、`test_sandbox_contract.py`。

> 勾选表示源码和对应测试文件证据存在；本轮重新执行状态见研发基线。

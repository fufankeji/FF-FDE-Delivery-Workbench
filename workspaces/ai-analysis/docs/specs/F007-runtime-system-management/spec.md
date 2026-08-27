---
document: feature-spec
feature: F007
title: 运行配置、沙箱与系统管理
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 本地安装运行、配置与诊断边界可用
updated: 2026-08-27
---

# F007 · 运行配置、沙箱与系统管理

## 用户结果

用户可以在本机安装、启动、检查和停止系统，查看运行概况，安全配置模型服务或 MySQL 导入，并在需要时构建无网络 Skill 沙箱，而不会把凭据写入源码或公开响应。

## 行为规格

1. Python 3.12/uv 和 Node.js 22+/pnpm 是固定基础环境；依赖安装与服务启动分开。
2. `start.sh` 启动 Uvicorn 和 Vite，记录本项目 PID/日志；支持 API/Web 端口环境覆盖。
3. `stop.sh` 只停止本项目记录的进程，不删除 `.runtime` 数据。
4. 健康接口返回组件能力和真实运行状态；设置页显示运行根、资源/版本和模型配置状态。
5. 模型连接修改只接受同 Host 浏览器 Origin；新配置必须提供必要新 Key 并通过测试后保存。
6. API Key 保存到权限为 600 的本地运行文件；状态接口只返回 `configured`、模型名、Base URL、来源和测试摘要。
7. MySQL 检查使用 Secret 类型请求并返回数据库/表摘要；导入只登记用户明确选择的表。
8. Docker 沙箱镜像由用户显式构建，脚本运行禁用网络、限制宿主路径和写入范围。
9. macOS 本地 MySQL、Olist 准备和百万行 benchmark 是可选脚本，不属于基础启动成功条件。

## 边界与失败

- 启动脚本不自动安装依赖；端口占用、后端未就绪和前端失败分别记录。
- 公开 Origin 不能修改模型连接；状态和异常不能回显旧/新 Key。
- 没有 Docker/MySQL/Olist/在线模型时，相应可选能力降级，主路径继续运行。
- Windows 当前要求 WSL2；PowerShell 原生不宣称通过。

## 验收

默认或覆盖端口可启动并通过 API/前端检查；停止后运行数据保留。模型连接跨 Host 请求被拒绝，保存后状态不含 Key；沙箱测试证明无网络和宿主根写入。

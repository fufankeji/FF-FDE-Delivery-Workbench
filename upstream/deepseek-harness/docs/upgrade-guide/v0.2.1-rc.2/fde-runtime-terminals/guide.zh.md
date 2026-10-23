---
kind: upgrade-guide
description: FDE 运行输出改为只读，人工命令使用独立的官方用户终端。
---

# FDE 运行输出与手动终端

[English](guide.md) | 中文

## 变更

FDE 项目工作区区分只读“运行输出”和“手动终端”。Agent 运行使用官方持久终端工具，不再使用已经移除的 Sidebar 工具。项目启动停止操作和真实预览核验规则保持。Host 重启不能恢复已丢失的 PTY 或旧输出。

## 迁移

1. 使用“运行输出”查看项目记录中的 Agent 进程。该动作不创建替代终端，也不发送命令。人工命令使用“手动终端”；它的 shell 状态和记录独立，但项目文件及端口共享。
2. 自定义项目指令使用 `terminal_open`，参数为 `type: shell`、`name: 项目运行`，随后使用 `terminal_send`、`terminal_read`、`terminal_list` 和 `terminal_signal`。替换旧 `terminal_create`、`terminal_wait_for` 指令。超时或空闲提示不代表服务健康，调用 `project_runtime_report` 前须核验真实项目。
3. 手动改变服务后，请让 Agent 重新核验项目真实状态。运行输出缺失或独立手动 shell 均不能证明项目已停止。
4. 使用锁文件安装时保留固定的 File Review 补丁。它适配 Host/Client 严格 codec，并只声明已验证的 Harness 版本；不要关闭全局兼容检查或授予宽泛版本豁免。

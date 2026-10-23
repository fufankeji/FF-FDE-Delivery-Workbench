---
kind: upgrade-guide
description: FDE Web 组合退役免授权的 --lan 访问，改为指定监听 IP 并要求浏览器授权。
---

# FDE 局域网浏览器授权

[English](guide.md) | 中文

## 变更

FDE 下游 Web 组合不再通过 `--lan` 提供全网卡免授权访问。该参数会在监听前退出并提示迁移。`--host` 接受具体本机 IP，浏览器请求由 Connection 认证。FDE 项目、阶段、资料、语义和训练 HTTP 接口均要求已认证的 owner 身份；有限权限的 API 身份不能访问这些接口。

## 迁移

1. 继续显式指定 `DSH_HOME`。升级 Harness 时，先在隔离验证副本中确认，再让新版打开原始会话数据。
2. 将 `--lan` 替换为 `--host <本机局域网IP>`。例如在 FDE 仓库的 `upstream/deepseek-harness` 目录执行 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 192.168.1.20 --port 3080`，其中 IP 必须替换为本机实际地址。
3. 在每台获准设备上打开该进程打印的授权链接。该链接属于凭据，不应公开。授权前直接访问裸 IP 收到认证错误属于预期行为。
4. 确认授权后的工作台和项目接口可用，未认证和跨来源请求仍被拒绝。不要恢复 `browserAuthentication: false`，不要使用通配监听地址，也不要将本地部署映射到公网。

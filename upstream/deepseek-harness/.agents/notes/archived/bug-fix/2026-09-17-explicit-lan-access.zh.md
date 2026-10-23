# Agent Note: 显式局域网免授权访问

Status: implemented
Archived: 2026-10-23

[English](2026-09-17-explicit-lan-access.md) | 中文

## 问题

下游 `--lan` 选项承诺可信设备可直接访问，但共享浏览器会话要求让新设备打开公布的 IP 地址时收到 401。操作者明确选择局域网免授权访问，而不是逐台分发启动令牌。

## 决定

Connection 的 `browserAuthentication` 默认为 true。随附 Web 组合仅在显式 `--lan` 时传入 false，依据 CLI 只为该选项解析出的启动 host；单独覆盖监听地址或声明可信 Host 不会关闭授权。其他情况保留默认[浏览器会话策略](../architecture/2026-08-24-browser-token-authentication.zh.md)。

免授权模式跳过浏览器会话初始化和令牌 URL，允许可信 index/API/WebSocket 请求不带 cookie，但保留 Host、Origin 和 Fetch-Metadata 校验。不改写或删除已有凭据记录，恢复普通启动即恢复鉴权。

## 曾考虑的替代方案

**逐台发送启动令牌。** 保留默认安全策略，但不能满足操作者明确提出的直接 IP 访问要求。

**全局关闭鉴权或仅放开首页。** 全局关闭会影响无关组合；只放开首页则 RPC 和实时流仍不可用。因此由传输所有者对三者应用同一显式策略。

## 后果

通过请求校验的调用者可操作完整 Host API，包括设置和可执行工具的 Session。仅 UI 的回环限制不构成授权层。此模式要求可信网络且不做公网端口映射；Host/Origin 校验不代表调用者身份。定向测试保留默认 401 行为与免授权模式的 403 校验；在线请求覆盖无凭据首页、只读 FDE 接口及 WebSocket upgrade。

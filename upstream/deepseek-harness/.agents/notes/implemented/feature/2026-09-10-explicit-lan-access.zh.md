# Agent Note: 显式启用 FDE 工作台局域网访问

Status: implemented

[English](2026-09-10-explicit-lan-access.md) | 中文

## 决策

下游 Web 启动器以 `--lan` 表达部署者对无鉴权网络访问的显式许可。默认仍只监听本机；缺少许可的全接口 `--host` 和冲突参数在监听前报错。可达客户端能够操作 Agent 工具及项目文件，因此部署者必须使用可信网络且不做公网转发；此模式不是多人权限系统。

FDE 项目、阶段、资料、Semantica 和用量路由调用 Connection 的 `createWebRequestTrust`，仅在全接口监听时采集本机 IPv4 与实际端口，保留原有 Host、Origin 和 Fetch-Metadata 检查。普通 RPC 与 WebSocket 复用既有 WebRuntime 局域网信任。设置、凭据及原生桌面 RPC 仍限回环，独立项目预览仍仅本机监听。

## 替代方案与影响

仅改监听地址会使项目路由继续返回 403。全局接受任意 Host 或改变空信任表语义，会影响其他特权方法。登录系统不属于本次明确要求的可信局域网模式。实现不写入业务数据或项目专用 IP。

## 验证

普通 HTTP 局域网不提供仅安全上下文可用的 `crypto.randomUUID`。浏览器 WebApiClient 在既有关联 ID 扩展点复用 Connection 的 `getRandomValues` UUID 方法，与通用 RPC 一致；不修改核心 API 即可恢复就绪握手及 Workspace 读取。首页区分未加载基线与真实零项目。单独的 HTTP 200 或 WebSocket 握手不能证明浏览器请求成立，必须把实际在线 Client Bundle 放在缺少 `randomUUID` 的环境中连接真实局域网服务验证。

主题引导将非敏感 Host 偏好写入 `data-dsh-theme-preference`，ThemeRuntime 在解析系统配色前接续该值。远程设置继续只保留在内存，但初始空值不能把已接受的 Host 主题重置成 `system`；后续本机 Host 快照和用户显式选择仍有最终效力。这样保留原有页面配色，不逐页追加对比度覆盖，也不向远程开放特权设置。

真实 Loader 启动测试覆盖显式开关及冲突参数。Connection 测试覆盖本机 IP 与精确端口、默认仅本机、不可信 Host/Origin 和特权 RPC 限制。运行中的 3080 通过局域网地址核对项目读取及两条 WebSocket；不需要模型调用或项目阶段迁移。

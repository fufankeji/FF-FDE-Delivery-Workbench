# Agent Note: Harness 0.2.1 下的 FDE 授权与终端归属

Status: implemented

[English](2026-10-23-fde-harness-021-boundaries.md) | 中文

## 问题

FDE 工作台适配新版 Connection 和终端 API 时，必须保留项目身份和人工阶段决定。旧 LAN 例外允许未认证调用方访问，而旧 Sidebar 终端工具已经不存在。

## 决定

操作者确认采用具体 IP 监听和浏览器授权。FDE HTTP 路由消费 Connection admission 并要求 owner 身份。退役的 `--lan` 拒绝启动并提示 `--host`；此决定取代[历史 LAN 例外](../../archived/bug-fix/2026-09-17-explicit-lan-access.md)。

运行输出只读取已登记项目运行记录指定的 Agent PTY。查看不激活 Agent、不创建替代终端，也不接受输入。手动终端独立复用官方用户终端服务。二者共享项目文件和端口，手动改变服务后需重新健康检查。启动停止保留原 operation-id 规则；停止临时持有原 Session 引用，直到指令排队完成。

File Review 保持 0.5.0 并附带有版本的下游补丁：Host 与 Client 的严格 codec 提供当前延迟工厂，兼容声明只标明已验证的 0.2.1-rc.2。全局插件兼容检查保持启用。Sidebar、Review 和 Observe 的 DSH peers 均解析到本 workspace 的单一运行时身份。

## 考虑过的替代方案

**保留免认证 LAN。** 操作者已批准移除；FDE 单独绕过会破坏统一授权策略。

**人工和 Agent 输入同一个 PTY。** 这需要明确的输入归属和交接协议。本次升级由操作者选择独立手动终端。

**为 File Review 授予版本豁免。** 豁免无法修复旧严格 codec。包补丁和真实注册、撤销检查才明确当前支持范围。

## 影响

升级验证不改动原运行数据。隔离会话迁移保留旧代字节、身份、助手正文、轮次和工具调用数量。Host 输出缺失明确显示，不伪造恢复。定向测试覆盖授权、只读输出、项目范围、引用持有、插件注册和可逆文件编辑；真实模型质量和最终视觉验收仍由人工确认。

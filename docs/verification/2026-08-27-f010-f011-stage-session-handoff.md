# F010/F011 阶段同步与项目会话入口验证记录

## 验证范围

- 需求调研人工门成功后，只发送发生变化的 WorkspaceId；项目交付阶段控制器据此重新读取 Host 持久阶段。
- “进入项目交付”按 `updatedAt` 打开目标 Workspace 最新的非归档普通 Session。
- 子 Agent、归档和其他项目 Session 不参与默认选择；无可恢复 Session 时才调用官方 Workspace 连接流程。

## 真实证据

| 检查 | 结果 | 可观察证据 |
|---|---|---|
| 聚焦测试 | 通过 | 4 个测试文件、10 项测试通过；覆盖阶段通知发送/接收、旧缓存刷新、最新会话选择和无候选回退 |
| F010 Client Bundle | 通过 | `@deepseek-ai/dsh-client-ui-fde-stage` bundle 退出 0 |
| F011 Client Bundle | 通过 | `@deepseek-ai/dsh-client-ui-fde-project` bundle 退出 0 |
| 双语 README 配对 | 通过 | 两组 README pairing 一致 |
| 隔离服务 | 通过 | `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`；PID 63169 监听 `127.0.0.1:3080`，根页面 HTTP 200 |
| 项目隔离 | 通过 | Workspace 注册表共 1 项，名称为“数据分析项目”，WorkspaceId 为 `22caf7a1-28f1-4590-aa62-6500f166eb8b` |
| 持久阶段 | 通过 | `/api/fde-stage/open` 返回 `currentStage: solution`、`revision: 2` |

## 人工验收入口

1. 刷新 `http://127.0.0.1:3080`，打开“数据分析项目”的已有会话，顶部应显示“阶段 2/6 · 方案设计”。
2. 从“项目进度”进入该项目详情，点击“进入项目交付”，应打开该项目最近更新的普通 Session，而不是新建空白 Session。

## 未执行项

- 按协同开发约束，未运行浏览器回放、自动截图或视觉对比；界面结果由用户立即手动验证。
- 未调用模型、外部服务或计费能力。

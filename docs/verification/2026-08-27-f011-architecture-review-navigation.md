# F011 候选架构审阅入口与项目快照刷新验证记录

## 验证范围

- 方案设计阶段的候选系统架构显示可执行的“去确认架构”，不再只有灰色状态。
- 动作打开目标项目按 `updatedAt` 最新的非归档普通 Session，并选中“系统架构”页。
- 项目进度不调用架构确认接口；“确认当前架构”仍只属于完整系统架构页。
- 每次进入明确项目详情都重新读取 Host 项目快照，避免 Agent 已生成文件或架构已确认却仍显示旧状态。

## 实现前诊断

- 数据分析项目的四份方案设计文件已经真实存在于 `fde-deliverables/02-solution-design/`。
- 同一项目 `/api/fde-project/snapshot` 已返回 `solution.presentCount: 4`，架构为候选 revision 2；页面仍显示待生成的原因是 `FdeProjectSurfaceController.load()` 只执行首次加载，重新进入项目详情没有使缓存失效。

## 真实证据

| 检查 | 结果 | 可观察证据 |
|---|---|---|
| F011 Feature 规格校验 | 通过 | `validate_feature_specs.py ... --feature F011` 返回 `ok: true`，无 errors/warnings |
| Agent Note 双语配对 | 通过 | `verify-translation-pairing` 返回 named pair consistent |
| 聚焦组件与服务测试 | 通过 | 4 个测试文件、30 项测试通过；覆盖候选 CTA、确认后不可点击状态、进入详情强制刷新、最新普通 Session 选择、Conversation View 在 Session Store 挂载前后均可选择 |
| Conversation Client Bundle | 通过 | `@deepseek-ai/dsh-client-ui-conversation` bundle 退出 0 |
| F011 Client Bundle | 通过 | `@deepseek-ai/dsh-client-ui-fde-project` bundle 退出 0 |
| 隔离服务 | 通过 | `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`；PID 74364 监听 `127.0.0.1:3080`，根页面 HTTP 200 |

## 人工验收入口

1. 刷新 `http://127.0.0.1:3080`，进入“项目进度”→“数据分析项目”→“阶段产出”。
2. 四份方案文档应按 Host 当前快照显示为已有文件；候选系统架构应显示“去确认架构”。
3. 点击后应直接进入该项目最新普通 Session 的“系统架构”页，而不是停留在对话页或新建空白会话。
4. 在系统架构页点击“确认当前架构”，再返回项目进度并重新进入项目详情；架构行应显示不可点击的“已确认 R2”。

## 未执行项

- 按协同开发约束，未运行浏览器回放、自动截图、录屏或视觉对比。
- 未调用模型、外部服务或计费能力。
- 页面最终视觉、真实点击跳转和确认后的手动返回体验等待用户验收。

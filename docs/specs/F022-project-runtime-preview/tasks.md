---
document: feature-tasks
feature: F022
status: in-progress
updated: "2026-08-27"
---

# F022 · 项目运行与内嵌预览任务

## 任务规则

- 启动/停止由当前项目 Agent 执行，浏览器只创建操作并排队可见提示。
- 只复用 Better Sidebar 的持久终端与 Browser，不增加隐藏后台执行通道。
- 只有真实命令、测试或运行证据通过后才勾选任务；用户视觉验收保持待人工确认。

## 任务清单

- [x] T001 冻结项目运行、终端、预览和 API 可见合同
  - 来源：REQ-017, REQ-025, AC-F022-001～AC-F022-005
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、F012、Architecture 与 F022 Spec/Plan/Tasks
  - 完成证据：运行状态、operationId、Agent/终端边界、精确 loopback 和运行态 API 条件均有可验证定义
  - 验证：F022 定向文档与追踪检查

- [x] T002 建立 Workspace 级项目运行记录与 Agent 报告
  - 来源：REQ-025, NFR-001, NFR-005, NFR-007, NFR-008, AC-F022-002, AC-F022-003, AC-F022-004
  - 依赖：T001
  - 修改：`packages/fde/project/` 运行状态、原子持久化、start/stop/abandon 路由和 `project_runtime_report`
  - 完成证据：状态迁移和过期 operationId 拒绝成立；启动 blocked 仅允许当前 operationId 与发起 Session 以已验证地址恢复 running，停止 blocked 不放宽；地址受限且跨项目隔离
  - 验证：FDE Project Host 聚焦测试

- [x] T003 实现项目交付页头运行控件与 Agent 启停提示
  - 来源：REQ-025, NFR-003, NFR-005, NFR-010, AC-F022-001～AC-F022-004
  - 依赖：T002
  - 修改：`ui-fde-project` Controller、页头 Slot、状态组件、提示和轮询
  - 完成证据：development 起按状态显示启动/打开/停止/查看终端，早期阶段不出现；启动先选择当前对话，启动 blocked 保持低频刷新，提示要求 Agent 报告后正常说明结果和下一步，发送失败可恢复
  - 验证：Client Slot、组件和 Controller 聚焦测试

- [x] T004 接入 Better Sidebar 持久终端和内嵌 Browser
  - 来源：REQ-025, NFR-001, NFR-005, NFR-008, NFR-010, AC-F022-002, AC-F022-004
  - 依赖：T003
  - 修改：运行动作所需 Sidebar settings、终端定位、Browser 打开和精确 loopback 允许项
  - 完成证据：Agent Terminal 工具真实开启；首次观察到当前启动操作 running 后预览在右侧自动打开一次，重复快照不重复打开；停止后终端输出保留
  - 验证：Sidebar 结构合同测试＋目标 Client bundle

- [x] T005 让 API 文档只随当前运行 OpenAPI 开放
  - 来源：REQ-017, REQ-025, NFR-001, NFR-002, NFR-008, AC-F022-005
  - 依赖：T002, T003
  - 修改：运行态 API 配置回退、OpenAPI 工具读取和 `conversation.view` 动态注册
  - 完成证据：显式配置优先，running＋OpenAPI 才显示 API 文档；停止、阻塞或无 OpenAPI 时不显示
  - 验证：Host 配置测试＋Client View 可见性测试

- [x] T006 构建、启动并交付人工流程验收
  - 来源：REQ-017, REQ-025, NFR-005, NFR-007, NFR-008, NFR-010, AC-F022-001～AC-F022-005
  - 依赖：T002～T005
  - 修改：相关 README、Agent Note、Bundle 工件和 `docs/verification/`
  - 完成证据：聚焦测试、目标构建和 3080 HTTP 检查通过，页面保持可供用户手动走真实项目流程
  - 验证：一次最窄测试组合＋一次目标构建＋一次启动检查；不执行截图或完整 E2E

- [x] T007 修复 Host 重启后“查看终端”进入死路
  - 来源：REQ-025, NFR-005, NFR-007, NFR-008, AC-F022-002, AC-F022-004, AC-F022-006
  - 依赖：T003, T004
  - 修改：`ui-fde-project` 终端 Session 定位、同名 Tab 兼容、短等待与 Agent 恢复提示；F022 双语说明和实现记录
  - 完成证据：现有“项目运行”Tab 可直接激活；Host 重启且终端确实不存在时，点击动作返回原项目会话并只恢复一个观察终端、核验既有服务，不重复启动、不伪造旧日志
  - 验证：终端定位聚焦测试、Apply 恢复提示测试、Client TypeScript、定向 lint、完整 Build 与 3080 HTTP 可访问

## Task 数量复核

- 任务总数：7
- 原因：前六项保留原交付结果；T007 独立修复 Host 重启后持久运行事实仍在、但内存 Agent PTY 已丢失时的终端入口恢复。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | in-progress | 用户确认入口位于项目交付页头，启动/停止由 DSH Agent 读取项目 `AGENTS.md`，运行过程使用右侧终端，成功后在内嵌 Browser 打开，API 文档只在真实运行后出现；F022 三件套已建立 | 等待 Host/Client 实现、最窄验证和用户手动流程验收 |
| 2026-08-27 | implementation-ready-for-verification | Workspace 运行记录、精确 operationId、Agent 报告工具、页头控件、Better Sidebar 终端/Browser 与运行态 API 门均已实现；停止失败只允许重试停止，避免重复服务 | 等待最终聚焦测试、目标构建、3080 HTTP 检查与用户手动流程验收 |
| 2026-08-27 | implementation-ready-for-manual-review | 8 个聚焦测试文件 30 项通过，Host/Client 定向类型检查、`ui-fde-project` bundle、Web build、翻译配对与 Agent Note 格式通过；3080 已使用隔离 `.runtime/dsh-home` 重启并返回 HTTP 200 | 未执行浏览器截图或完整 E2E；等待用户手动验证真实项目的启动、终端、内嵌预览、停止和 API 文档联动 |
| 2026-08-27 | start-action-regression-fixed | 用户点击“启动项目”复现 Cordis Context 服务读取错误；运行回调改为捕获 `ctx.inject(['betterSidebar'])` 的作用域实例，Apply 集成测试直接执行启动动作通过，Client 类型检查与 bundle 通过 | 3080 已按隔离 DSH_HOME 重启；等待用户重新点击验证真实 Agent/终端链路 |
| 2026-08-27 | blocked-chat-fallback-fixed | 用户在非对话 View 启动缺少 `AGENTS.md` 的项目后只看到页头阻塞和中央空白；合同修订为启动先选择当前 Session 对话，Agent 调用运行报告后必须正常说明结果与下一步 | 等待 Client 聚焦测试、类型检查、bundle、3080 重启和用户手动验证 |
| 2026-08-27 | blocked-chat-fallback-ready-for-manual-review | Apply 集成测试固定“先选择对话并打开当前 Session、再排队启动提示”，提示明确要求运行报告后正常回复；2 个测试文件 5 项、Client 类型检查、目标 bundle、文档机检和 3080 HTTP 检查均通过 | 未执行浏览器截图或完整 E2E；等待用户手动验证缺少 `AGENTS.md` 时仍显示正常 Agent 对话 |
| 2026-08-27 | blocked-runtime-recovery-authorized | 真实会话证明 Agent 先报告 blocked，随后补齐 `AGENTS.md`、启动并验证前端/后端/OpenAPI，但 Host 拒绝 blocked→running；用户授权修复状态恢复、API 同步和自动项目预览 | 等待 Host/Client 实现、聚焦测试、目标构建、3080 重启与用户手动验证 |
| 2026-08-27 | blocked-runtime-recovery-ready-for-manual-review | 当前启动操作仅允许原发起 Session 以同一 operationId 和真实 loopback 地址从 blocked 恢复 running；blocked 启动操作按 3 秒刷新，首次观察到 running 时只自动打开一次内嵌 Browser，API 文档门同步重算；4 个测试文件 13 项、Host/Client 类型检查、Client bundle、翻译配对和隔离 3080 HTTP 200 均通过 | 现有旧运行记录仍保持 blocked，未手改运行事实；由用户刷新后点击一次“重试启动”，让 Agent 验证已运行服务并通过新操作回写 |
| 2026-08-27 | host-restart-terminal-recovery-in-progress | 用户人工验证发现 Host 重启后项目仍从文件显示 running，但 Agent PTY 已随旧 Host 消失；“查看终端”继续显示并抛出“当前项目的运行终端尚未出现” | T007：补齐当前 Session 同名 Tab 定位、终端短等待和安全 Agent 恢复 |
| 2026-08-27 | host-restart-terminal-recovery-ready-for-manual-review | “查看终端”现在先打开运行记录绑定的 Session，按同名 Agent Tab、同名已显示普通终端、最近 Agent Tab 的顺序短暂等待；Host 重启后确实无旧 PTY 时返回原项目对话并排队一次只恢复观察终端、核验既有预览的指令。3 个聚焦测试文件 12 项、Client TypeScript、定向 lint、完整 Build、双语配对和 3080 HTTP 200 均通过 | 旧 Host 的真实 PTY 与历史输出不可恢复且不会伪造；未执行浏览器截图或完整 E2E，等待用户刷新后手动点击“查看终端”验证恢复交互 |

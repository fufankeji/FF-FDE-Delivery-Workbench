---
document: feature-tasks
feature: F019
status: in-progress
updated: "2026-08-27"
---

# F019 · 权限控件中文化任务

## 任务规则

- 一个 Task 交付一个可独立验证的结果。
- 只修改权限展示语言与对应文档测试，不扩大到其他页面翻译。
- 只有完成证据和验证结果真实存在后才勾选。

## 任务清单

- [x] T001 冻结权限控件中文显示与兼容合同
  - 来源：REQ-004, NFR-004, NFR-005, AC-F019-001～AC-F019-003
  - 依赖：无
  - 修改：Feature Map 与 F019 Spec/Plan/Tasks
  - 完成证据：中文精确名称、风险确认、英文兼容和自定义名称透传均已写入规格
  - 验证：F019 定向 Feature Spec 校验

- [x] T002 统一三个权限界面的内置名称
  - 来源：REQ-004, NFR-005, AC-F019-001, AC-F019-003
  - 依赖：T001
  - 修改：`packages/client/ui-conversation`、`packages/client/ui-permission-presets`
  - 完成证据：中文 locale 显示 `只读`、`工作区写入`、`完全访问`，英文和自定义名称保持合同
  - 验证：两个 Client 包聚焦组件测试

- [x] T003 中文化完全访问风险确认并保持权限门
  - 来源：REQ-004, NFR-004, NFR-005, AC-F019-002
  - 依赖：T001
  - 修改：两个 Client 包 locale 与风险确认测试
  - 完成证据：确认框完整中文，确认前不可提交，取消不变，确认提交原 ID
  - 验证：两个权限界面的风险确认聚焦测试

- [x] T004 同步包合同并交付可人工验收页面
  - 来源：REQ-004, NFR-005, AC-F019-001～AC-F019-003
  - 依赖：T002, T003
  - 修改：两个包 README、相关测试/构建、`docs/verification/`
  - 完成证据：中英文 README 同步、聚焦测试和相关构建通过、隔离页面加载最新工件
  - 验证：一次聚焦测试命令＋一次相关构建＋隔离服务 HTTP 检查

- [x] T005 对齐 Studio 的权限后果菜单与完全访问红色风险提示
  - 来源：REQ-004, NFR-004, NFR-005, AC-F019-004
  - 依赖：T002, T003
  - 修改：`ui-conversation` 权限菜单、locale、样式、聚焦测试与 Web 语义快照
  - 完成证据：菜单标题与三项权限后果逐字显示，完全访问名称、说明和盾牌图标使用风险样式
  - 验证：`ui-conversation` 输入栏权限菜单聚焦组件测试

- [x] T006 交付包含 main 项目、工作区与历史会话的隔离调试页面
  - 来源：REQ-004, NFR-004, NFR-005, AC-F019-001～AC-F019-004
  - 依赖：T004, T005
  - 修改：Feature 专属 `.runtime` 数据快照与 `docs/verification/`
  - 完成证据：3181 使用独立 DSH_HOME，恢复 main 的项目注册、真实 Workspace 路径、阶段状态、历史会话和附件；快照不含凭据且不写 main 数据目录
  - 验证：运行目录文件清单检查＋Feature Host 的项目/会话投影检查

## Task 数量复核

- 任务总数：6
- 原因：用户人工验收补充了两个可独立观察的结果：Studio 权限后果/风险菜单，以及可恢复 main 项目与历史会话但不共写 main 数据的隔离调试环境；其余任务仍保持原边界。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | planned | F019 Spec、Plan、Tasks 已落盘 | 通过定向规格校验后开始实现 |
| 2026-08-27 | in-progress | F019 定向校验通过；Feature Map confirmed，Spec/Plan ready，Tasks 格式与追踪有效 | T002～T004 待实现和验证 |
| 2026-08-27 | implementation-ready-for-manual-review | 中文内置权限名称与完全访问确认已接入三个界面；3 个聚焦测试文件 86 项通过，定向类型检查、lint、双包 bundle、Web 构建、双语配对和 3181 HTTP/服务包文案检查通过 | 未按人工优先约束运行浏览器回放；等待用户在 3181 手动确认。全量 Client 类型聚合仍被未修改的 `ui-fde-document-preview` 可选 `size` 基线错误阻塞 |
| 2026-08-27 | in-progress | 用户人工验收指出 Studio 菜单还包含权限后果与完全访问红色风险提示，并要求 3181 恢复 main 的项目、工作区和历史会话 | 新增 T005、T006；先完成规格增量，再修正实现与隔离运行数据 |
| 2026-08-27 | implementation-ready-for-manual-review | 已对齐 Studio `97b5851f3b` 的权限后果菜单与完全访问风险样式；输入栏 77 项聚焦测试、定向类型检查、lint、Client/Web 构建与双语配对通过；3181 Host 投影恢复 `数据分析项目`、真实 Workspace 和 3 条历史会话 | 页面等待用户人工确认；main 3080 保持运行，Feature Session/状态写入独立快照，真实 Workspace 文件路径由两边共享 |

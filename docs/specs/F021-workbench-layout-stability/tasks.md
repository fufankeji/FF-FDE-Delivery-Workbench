---
document: feature-tasks
feature: F021
status: in-progress
updated: "2026-08-27"
---

# F021 · 工作区布局稳定性任务

## 任务规则

- 一个 Task 交付一个可独立验证的结果。
- 只修复 Dock 外层滚动边界与折叠栏前两个操作间距，不调整 Diff 语义或其他界面。
- 只有完成证据和对应最窄验证真实通过后才勾选。

## 任务清单

- [x] T001 冻结 Dock 裁切与折叠栏间距合同
  - 来源：REQ-013, REQ-015, AC-F021-001～AC-F021-004
  - 依赖：无
  - 修改：Feature Map 与 F021 Spec/Plan/Tasks
  - 完成证据：Host 不可程序滚动、Dock 完整边界、File Review 内层定位和 12px rail 间距均已写入验收标准
  - 验证：F021 定向 Feature Spec 校验

- [x] T002 阻止文件审查定位滚动 Dock 外层
  - 来源：REQ-015, NFR-005, NFR-010, AC-F021-001, AC-F021-002
  - 依赖：T001
  - 修改：Better Sidebar 受控 patch、pnpm patch hash 与相关组合文档
  - 完成证据：File Review 定位后外层 Host 仍为零滚动，Dock 的 top/bottom 不偏移，目标差异仍在内层展开
  - 验证：3181 真实历史会话的一次 DOM 滚动/几何检查

- [x] T003 将折叠栏前两个操作收紧为 12px
  - 来源：REQ-013, NFR-005, AC-F021-003, AC-F021-004
  - 依赖：T001
  - 修改：WorkspaceBrowser 折叠态样式、样式合同测试与相关 README
  - 完成证据：36px 空标题行不再占位，两个 36px 按钮左对齐且实际可见间隔为 12px
  - 验证：WorkspaceBrowser 样式/交互聚焦测试＋3181 一次几何检查

- [x] T004 构建并交付隔离人工验收页面
  - 来源：REQ-013, REQ-015, NFR-005, NFR-010, AC-F021-001～AC-F021-004
  - 依赖：T002, T003
  - 修改：相关 Client/Web 工件、3181 隔离服务与 `docs/verification/`
  - 完成证据：最窄测试与构建通过，3181 恢复 main 项目/历史会话快照并加载最新修复工件
  - 验证：一次聚焦测试命令＋一次相关构建＋HTTP/DOM 检查

## Task 数量复核

- 任务总数：4
- 原因：文档合同、Dock 滚动边界、折叠栏间距和隔离运行验收是四个可独立证明的结果。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | planned | 真实 3181 页面复现 Host 从 `scrollTop=0` 变为 `80`、Dock 从 `0～1218` 偏移为 `-80～1138`；折叠栏实测按钮间距 60px，其中包含 36px 空标题行 | 通过 F021 定向规格校验后开始实现 |
| 2026-08-27 | implementation-ready-for-manual-review | Better Sidebar Host 改为 `overflow:clip`，WorkspaceBrowser 折叠态不再显示空标题；2 个聚焦测试文件 56 项、Client bundle、Web build、frozen offline install 与 `git diff --check` 通过；真实历史会话直接点击文件后 Host 滚动为 `0/0`、Dock 为 `0～1218`，两个 36px rail 按钮间距为 12px | 3181 已加载真实项目和历史会话并保留给用户人工视觉确认；确认前 Feature Map 继续为 `in-progress` |

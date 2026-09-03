---
document: feature-plan
feature: F021
status: ready
updated: "2026-08-27"
---

# F021 · 工作区布局稳定性实施计划

## 现有上下文与复用

- 当前右侧 Dock 由已锁定的 `dsh-better-sidebar@0.16.1` 提供，`dsh-file-review-tab@0.2.0` 使用 `scrollIntoView` 在自身可滚动内容中定位会话产出文件。
- 真实复现表明：点击“审查”前面板 Host 为 `scrollTop=0`、Dock 为 `top=0/bottom=1218`；定位后 Host 因 `overflow:hidden` 可被程序滚动到 `scrollTop=80`，Dock 随之变为 `top=-80/bottom=1138`。
- 当前折叠栏同时保留新建项目后 12px margin、36px 空 `sectionHeader` 和该标题后 12px margin，实际按钮间隔为 60px。
- 直接复用现有右侧 Dock 面板 Host、File Review 内部滚动容器、WorkspaceBrowser 折叠态类名与现有聚焦/展开状态机。
- 必须保持的 Product Spec 合同：PSC-014, PSC-017。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `patches/dsh-better-sidebar@0.16.1.patch` | FDE 锁定的右侧 Dock 下游适配 | 将面板 Host 改为只裁切、不成为滚动容器，并同步发布包的 source/bundle hunk | AC-F021-001, AC-F021-002, AC-F021-004 |
| `pnpm-lock.yaml` | 固定 pnpm patch 完整性 | 随 patch 内容更新 hash，不改变依赖版本 | AC-F021-001, AC-F021-002 |
| `packages/client/ui-workspace/src/client/WorkspaceBrowser.module.css` | 项目/会话展开与折叠栏布局 | 折叠态不显示空 section header，保留两个操作既有尺寸与 12px 间距 | AC-F021-003, AC-F021-004 |
| `packages/client/ui-workspace/tests/browser-styles.client.spec.ts` | WorkspaceBrowser 布局合同的静态回归测试 | 精确断言折叠态空标题隐藏和 12px 按钮间隔来源 | AC-F021-003, AC-F021-004 |
| 相关 README 与 `docs/verification/` | 记录组合合同与真实证据 | 同步非滚动面板 Host、紧凑 rail 布局、最窄检查和未验收项 | 全部 |

## 实现方案

Better Sidebar 的固定 Host 继续覆盖视口并裁切已收起面板，但使用 CSS `overflow: clip` 而不是 `overflow: hidden`。两者都能裁切变换后超出视口的内容，但 `clip` 不会建立可被 `scrollIntoView` 滚动的容器；File Review 的内部 `.body` 仍保持 `overflow-y:auto`，因此目标轮次和文件仍能定位。此修复放入现有受控 pnpm patch，不修改未锁定的安装产物或复制第三方源码。

WorkspaceBrowser 保持同一 JSX 和交互状态，只在 `.rail` 状态隐藏内容本就全为空的 `sectionHeader`。新建项目按钮的现有 `margin-bottom:12px` 直接成为两个 rail 操作之间的唯一间隔；展开态不命中 `.rail` 规则。

## 实施顺序

1. 创建 F021 Spec/Plan/Tasks，更新 Feature Map 并通过定向校验。
2. 先更新 WorkspaceBrowser 布局回归测试，再隐藏折叠态空标题行。
3. 扩展 Better Sidebar 受控 patch，同步 source、Client bundle 和 pnpm patch hash。
4. 运行 WorkspaceBrowser 聚焦测试与相关 Web/Client 构建。
5. 重启 3181 隔离预览，用真实历史会话复测 Host 滚动值、Dock 几何与折叠栏间距，然后交付用户人工视觉确认。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| `overflow: clip` 需要当前 Web 运行时支持 | 不支持时可能无法裁切收起面板 | 当前产品锁定现代 Chromium/Web；在真实 3181 Client 同时验证裁切和不可滚动 | 运行复测 |
| File Review 依赖内层滚动定位 | 外层修复可能使目标不再进入视区 | 检查目标轮次/文件在 File Review body 中仍被展开并滚入 | 真实会话复测 |
| pnpm patch 内容更改 | frozen install 会因 hash 不一致失败 | 用标准 pnpm patch 流程更新 lockfile，并在 Feature worktree 中安装/构建 | 依赖更新后 |
| 折叠/展开共用组件 | rail 规则可能污染展开态 | 只修改 `.rail .sectionHeader`，保留展开态类与结构测试 | 聚焦测试 |

## 回退策略

两处调整都不改变数据或持久状态。若 Dock 裁切产生兼容问题，可单独恢复面板 Host 的 overflow 规则与 patch hash；若 rail 布局回归，可单独恢复空 section header 的显示。不触碰项目、Session、Diff 或文件数据。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F021-001 | 定位只滚动 File Review 内容 | 3181 真实会话 DOM 几何/滚动值检查 | 点击前后 Host `scrollTop/scrollLeft=0`，Dock top/bottom 不变 |
| AC-F021-002 | Dock 上下边界完整 | 同一次 3181 几何检查 | Tab 栏和审查标题的 top 非负，Dock bottom 等于视口高度 |
| AC-F021-003 | 折叠栏两个操作相距 12px | WorkspaceBrowser CSS 合同测试＋3181 几何检查 | 空 section header 不显示，两个 36px 按钮间隔为 12px |
| AC-F021-004 | 相关原有交互保持 | WorkspaceBrowser 现有聚焦组件测试＋相关 Client/Web 构建 | 搜索展开/聚焦和 Dock 组合继续通过 |

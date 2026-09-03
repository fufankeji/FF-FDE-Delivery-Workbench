---
document: feature-tasks
feature: F016
status: in-progress
updated: "2026-08-27"
---

# F016 · 工作台界面主题任务

## 任务规则

- 本轮只实现已确认的界面主题，不带入 Studio 的更新、视觉增强、应用中心或 Electron bridge。
- 自定义图片不得产生任何网络、Host、Session、项目文件或 Agent 调用。
- 每项结果有真实证据后才勾选；视觉效果由用户在 3080 页面人工确认，不运行自动截图。

## 任务清单

- [x] T001 冻结界面主题产品与实现合同
  - 来源：REQ-021, NFR-005, NFR-011, AC-F016-001～004
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F016 三件套
  - 完成证据：六套 id、默认、明暗独立、本地隐私、存储失败和回退边界已落盘
  - 验证：PRD、Product Spec 与 F016 定向规格校验

- [x] T002 建立主题资源、定义和浏览器控制器
  - 来源：REQ-021, NFR-011, AC-F016-001, AC-F016-002, AC-F016-004
  - 依赖：T001
  - 修改：`ui-fde-appearance` 包、五张 WebP、主题表、本地存储、图片处理与 DOM/Token 生命周期
  - 完成证据：默认/加载/保存/official/dispose、资源路径、图片限制和失败原子性成立
  - 验证：控制器与图片 helper 聚焦测试

- [x] T003 实现“界面主题”设置页
  - 来源：REQ-021, NFR-005, NFR-011, AC-F016-001～004
  - 依赖：T002
  - 修改：设置 Slot、六张主题卡、自定义文件、预览、焦点、玻璃层、保存、恢复默认和样式
  - 完成证据：正常、预览、保存中、失败和恢复状态均可操作，文案使用 FDE 产品身份
  - 验证：组件聚焦测试

- [x] T004 保持明暗模式、品牌和项目状态独立
  - 来源：REQ-021, NFR-005, NFR-011, AC-F016-002, AC-F016-003, AC-F016-004
  - 依赖：T002, T003
  - 修改：ThemeRuntime override、全局 CSS、插件注入面和独立状态边界
  - 完成证据：皮肤在明暗模式间保留；official/dispose 撤销；无 Host/Session/Agent 调用；FF 品牌文案不被替换
  - 验证：控制器、apply 和静态边界聚焦测试

- [x] T005 注册 Web 组合并同步官方文档
  - 来源：REQ-021, NFR-005, AC-F016-001～004
  - 依赖：T003, T004
  - 修改：Bundle row/package、Client aggregate、README 双语、Agent Note 双语和生成目录
  - 完成证据：插件进入 Boot 图，包合同和主题来源可追溯，文档配对通过
  - 验证：Client package gate、文档同步和目标构建

- [x] T006 构建、重启并记录证据
  - 来源：REQ-021, NFR-005, NFR-011, AC-F016-001～004
  - 依赖：T005
  - 修改：验证记录、Feature 状态、Architecture 真实状态和 3080 运行服务
  - 完成证据：聚焦测试和完整构建通过，3080 与五张主题资源可访问，页面待用户人工验收
  - 验证：聚焦测试＋完整构建＋HTTP/Boot 清单

- [x] T007 让皮肤覆盖左侧项目栏
  - 来源：REQ-021, NFR-005, NFR-011, AC-F016-003
  - 依赖：T004
  - 修改：F016 侧栏 Token、`[data-slot='sidebar']` 全局皮肤样式与控制器/样式聚焦测试
  - 完成证据：背景同时进入主内容和左侧项目/会话栏；左栏保留一层半透明表面、边界、模糊和可读导航状态，不修改官方 Sidebar/Layout 包
  - 验证：F016 Token 与全局侧栏样式聚焦测试

- [x] T008 修复主题下设置弹窗被侧栏压缩
  - 来源：REQ-021, NFR-005, AC-F016-003
  - 依赖：T007
  - 修改：`ui-settings-general` 弹窗 Portal、直接受影响的组件测试、包依赖与验证记录
  - 完成证据：设置触发器仍在左栏；打开后的蒙层和双栏面板挂载到 `document.body`，不受侧栏 `backdrop-filter` 或 278px 宽度限制；关闭、导航和焦点路径保持不变
  - 验证：`ui-settings-general` 聚焦测试、TypeScript 与目标 bundle；页面效果由用户在 3080 人工复验

## Task 数量复核

- 任务总数：8
- 原因：原六项覆盖产品合同、主题运行时、设置交互、跨能力独立、组合文档和运行交付；人工验收先后发现双层侧栏填充遮住背景，以及侧栏模糊层把 fixed 设置弹窗限制在侧栏宽度，因此分别增加全列适配和弹窗层级修复任务。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-27 | planned | 用户明确授权先写文档并直接实现 Studio 换肤和内置皮肤 | 完成规格校验后进入实现；最终视觉效果由用户人工确认 |
| 2026-08-27 | in-progress | PRD 与 Product Spec confirmed 校验通过；F016 规格、计划、任务和 Feature Map 已完成 | 全项目 Feature 校验仍报告既有未展开 Feature/自定义状态；本轮继续使用 `--feature F016` 定向校验 |
| 2026-08-27 | implementation-ready-for-manual-review | 六套皮肤、自定义图片本地处理、ThemeRuntime Token、localStorage 恢复、设置 Slot、资源、双语 README/Agent Note、8 项聚焦测试、完整构建、28 项 doc-sync 和 3080 启动均完成 | 全量 `test:gui` 的 3 个失败来自既有 `ui-sidebar`/`ui-fde-project` 样式合同；未运行截图或浏览器 E2E，视觉效果由用户人工确认 |
| 2026-08-27 | in-progress | 用户人工验收确认主内容已应用皮肤，但左侧项目栏仍被 AppFrame 与 SidebarRoot 的双层填充遮住，新增 T007 | 只调整 F016 自有 Token 与官方 Slot anchor 样式，不修改项目导航实现 |
| 2026-08-27 | implementation-ready-for-manual-review | T007 已完成：侧栏 Token 降低为明暗成对半透明值，`[data-slot='sidebar']` 撤销内层重复填充并增加模糊；Token/样式测试、类型、Lint、目标 bundle 与 3080 Boot 检查通过 | 不运行截图自动化；等待用户复验左栏背景与可读性 |
| 2026-08-27 | in-progress | 用户截图确认主题侧栏模糊层把设置弹窗压缩到左栏宽度，新增 T008 并定位为 fixed 包含块问题 | 保留侧栏主题效果，只调整设置弹窗的文档级挂载位置 |
| 2026-08-27 | implementation-ready-for-manual-review | T008 已完成：设置触发器保持原位，`SettingsPanel` Portal 到 `document.body`；18 项设置组件测试、TypeScript、Lint、目标 bundle、Web 构建和 3080 HTTP 检查通过 | 按协同规则不运行浏览器截图；等待用户复验设置蒙层和双栏宽度 |

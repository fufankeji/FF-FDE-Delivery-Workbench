---
document: feature-plan
feature: F001
status: ready
updated: "2026-08-26"
---

# F001 · 项目优先入口与连续工作实施计划

## 现有上下文与复用

- 官方 `WorkspaceRuntime` 已提供 Workspace 列表、目录注册、显式 `startSession(workspaceId)`、Session 打开、重命名和移除。
- `ui-workspace` 已拥有目录选择/新建文件夹流程、Workspace 分组树、项目行新增 Session 动作及中央 Workspace Picker。
- `ui-sidebar` 当前存在未绑定显式 WorkspaceId 的全局 New Session 与品牌点击快捷动作；这是本 Feature 需要关闭的冲突入口。
- 保持 Session/Workspace 持久化、Composer、Agent Loop、搜索、排序、归档和设置行为不变。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `ui-sidebar` Sidebar 壳 | 品牌、全局 New Session、Workspace 区域 | 品牌改为纯展示，移除无项目上下文的全局 New Session | AC-F001-005 |
| `ui-workspace` WorkspaceBrowser | Workspace 创建、分组树、Session 导航 | 在区域顶部提供“新建项目”；统一项目文案；项目点击恢复最近会话；项目行显式新建会话 | AC-F001-001～AC-F001-004 |
| `ui-workspace` viewing store | 浏览器视图偏好持久化 | 以规范项目路径为键保存首版项目基础信息，在重新载入和重新注册同一路径后恢复 | AC-F001-006 |
| `ui-workspace` Project form/metadata hover | 项目创建与可观察信息 | 新增四字段表单、目录父级选择、独立导入入口和企业/周期摘要 | AC-F001-001, AC-F001-004, AC-F001-006 |
| `ui-workspace` delivery-window control | 待确认/预计日期二选一 | 使用应用内主题化分段选择器替代操作系统原生下拉菜单，保持同一字段语义 | AC-F001-006 |
| `bundle/web-app/cordis.patch.yml` | Web 目录选择能力组合 | FDE Web 固定组合官方 browse Host＋Client 双面能力，使根目录选择与 `createDirectory` 属于同一能力 | AC-F001-001, AC-F001-006 |
| `ui-workspace` Rows | Workspace 展开与行操作 | 分离“打开项目”与“展开/收起”，保持项目新增会话和真实移除动作 | AC-F001-002～AC-F001-004 |
| `ui-conversation` locale | 空白态 Workspace 文案 | 改为“选择项目”，行为保持显式 Workspace 选择 | AC-F001-004, AC-F001-005 |
| 相关 Client tests | Sidebar、Workspace tree、Hero 文案 | 更新并新增项目入口、切换无新增和显式归属断言 | 全部 |

## 实现方案

不新增项目数据库或路由。`WorkspaceId` 继续作为项目身份：WorkspaceBrowser 复用已有目录 Flow 创建/导入项目，成功后调用 `startSession(workspaceId)` 建立首个空白会话。全局无参 `startSession()` 从 FDE 可见入口移除；项目行新增会话始终传入显式 WorkspaceId。

当前阶段把创建表单基础信息写入 WorkspaceBrowser 的根作用域持久 store，并以 Workspace 规范路径为键；这样同一浏览器重载、Host 重启和同路径重新导入都可恢复，同时不污染官方 Workspace wire。Architecture 将其标记为首版客户端持久层；进入正式跨端 FDE Project Host Plugin 时沿同一字段合同迁移，产品语义不变。

新建流程不再让 WorkspacePickFlow 直接接纳目录：WorkspaceBrowser 自己驱动同一个 directory-flow slot。位置选择只记录父目录；没有持久偏好时保持空并阻止创建。表单打开时生成 `fde-YYYYMMDD-xxxx` 目录名，用户只能编辑为 ASCII 安全段；提交时调用官方 `createDirectory(parent, directoryName)`，再 `createWorkspace`、`renameWorkspace`、写入基础信息/可选默认根目录并 `startSession(workspaceId)`。导入入口则直接接纳所选既有目录。

项目点击从 Session 列表中按 `updatedAt` 选择目标项目最近的非归档普通会话并调用 `open(sessionId)`；只有没有候选会话时才调用 `startSession(workspaceId)`。箭头点击独立维护展开状态，不触发导航。

## 实施顺序

1. 更新项目级需求、共享合同、Feature Map、Architecture 与 F001 三件套。
2. 移除 Sidebar 全局无参新会话及品牌快捷动作。
3. 把 WorkspaceBrowser 的目录入口提升为“新建项目”主动作并统一项目产品语言。
4. 分离项目打开/展开行为，实现最近会话恢复与项目内显式新建会话。
5. 更新聚焦测试，构建并重启官方 Web，等待用户人工验收。
6. 增加结构化项目表单、项目基础信息持久 store、位置选择与独立导入流程，再次执行聚焦验证。
7. 将交付周期的原生 select 收敛为仅含两个状态的主题化分段选择器，保持明暗主题与键盘/无障碍状态一致。
8. 将 Web Bundle 的自适应目录选择器固定为官方 browse 组合，保证表单选取根目录后可以真实创建 ASCII 子目录。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 官方目录 Flow 暴露文件夹选择 | 首版项目创建仍需用户理解保存位置 | 产品入口称“新建项目”，目录界面保留真实位置选择；后续按人工反馈决定是否增加名称表单 | 人工验收 |
| 基础信息首版保存在浏览器持久 store | 清理浏览器数据或换浏览器不会随项目目录迁移 | 本阶段如实记录边界；正式 FDE Host Project 插件沿相同字段迁移，不在 UI 中伪造跨端持久 | 架构验收与后续 Host Feature |
| 根目录记忆与项目元数据共用浏览器 Store | 旧持久状态可能缺少新字段 | 新字段使用兼容缺省值，不清除已有项目元数据；只有用户勾选后才写入默认根目录 | Store 兼容测试 |
| 原生 select 继承操作系统菜单外观 | 下拉层与 Web 应用明暗主题、圆角和层级不一致 | 两个互斥状态直接使用 Token 驱动的分段选择器，不保留系统弹层 | 表单组件测试与人工验收 |
| loopback macOS 下 auto 选择 native 能力 | native 只提供系统选择器，不实现 `createDirectory`，表单在提交时失败 | FDE Web 明确固定使用官方 browse 后端及对应 Client UI；不绕过能力检查，不在前端伪造目录 | Bundle 配置检查、创建流程测试与人工验收 |
| Workspace 中存在归档/子 Agent/空白 Session | 项目切换可能打开错误会话 | 仅选择非归档普通 Session，按更新时间决定最近会话；无候选才建首个会话 | 聚焦树测试 |
| 原全局按钮与品牌都调用无参 startSession | 会话可能静默进入最近项目 | 同时移除两处入口，不只改文案 | Sidebar 测试 |
| “删除项目”实际不删文件 | 产品语言可能制造误解 | 改为“从工作台移除”并保留真实说明 | locale/组件测试 |

## 回退策略

保留本 Feature 的局部 Git diff；若项目入口或会话导航失败，通过反向补丁恢复 Sidebar/Workspace 组件与 locale，不更改 Workspace/Session 持久数据，不使用破坏性工作区回滚。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F001-001 | 新建项目并进入首个会话 | WorkspaceBrowser 聚焦组件测试 | 创建回调携带 WorkspaceId 并启动会话 |
| AC-F001-002 | 项目点击恢复最近会话 | Workspace tree 聚焦测试 | `open` 指向最新会话且未调用 `startSession` |
| AC-F001-003 | 项目内新会话显式归属 | Workspace tree 聚焦测试 | `startSession` 收到目标 WorkspaceId |
| AC-F001-004 | 项目语言与真实移除语义 | locale/组件精确断言 | 不出现产品级“工作区”，移除说明准确 |
| AC-F001-005 | 无游离会话入口 | Sidebar 聚焦测试＋成功构建 | Sidebar 不再注入或调用无参 startSession |
| AC-F001-006 | 四字段表单校验、创建与基础信息恢复 | Workspace form/store 聚焦测试 | 表单状态、调用顺序与重载恢复断言 |

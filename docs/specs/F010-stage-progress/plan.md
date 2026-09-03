---
document: feature-plan
feature: F010
status: ready
updated: "2026-08-28"
---

# F010 · 六阶段项目进度实施计划

## 现有上下文与复用

- 官方 Workspace 是项目稳定身份，Workspace 的 `sessionIds` 是项目与普通 Session 的现有归属依据；F010 不新增平行项目容器。
- 官方 `storage-domain` 已承担 Workspace 等跨会话持久状态，适合保存按 WorkspaceId 寻址的当前阶段。
- 官方 Conversation 已声明 `conversation.session.header.utilities` 和 `conversation.input.dock` 扩展点，可分别承载已开始会话状态和空白会话提示；完整项目进度不再使用 `conversation.view`。
- 右侧 Better Sidebar 继续只承载 Files/Editor/Git/Review；F010 不占用开发 Dock，也不改变左侧项目/会话导航。
- 六阶段名称和高层目标已经确认；空白工作入口只显示一句阶段行动提示，完整阶段信息、资料、产物和交付门结果留在项目进度页面。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/fde/stage/` | 不存在 | 新增 Workspace 级阶段记录、持久化域和本机同源读取/初始化入口 | AC-F010-001～004 |
| `packages/client/ui-fde-stage/` | 阶段 Client 插件 | 保留共享阶段读取控制器和会话头部状态；空白会话只呈现轻量阶段栏并发布当前项目的进度入口动作；移除会话内“交付流程”View；收到已提交阶段变化通知后只强制刷新对应 Workspace | AC-F010-001～004 |
| `packages/client/ui-fde-project/` | 独立项目管理与项目详情 | 接收轻量阶段入口动作，并直接打开明确 Workspace 的项目详情 | AC-F010-002 |
| `packages/client/ui-conversation/` | 官方空白会话 Hero 和输入框 | 强化 FDE 品牌主副标题层级，并把空白输入提示改为面向当前项目资料和问题的通用表达；不改变 Composer 状态机 | AC-F010-002 |
| `packages/bundle/web-app/` | FDE Web 组合 | 加入 Host 与 Client 插件依赖和 Cordis rows | AC-F010-002～003 |
| 根聚合与包索引 | 构建、类型和包导航 | 注册两个新包及准确 README/Model Experience 说明 | AC-F010-001～004 |
| `docs/architecture/architecture.md`、Agent Note、验证记录 | 技术决策与证据 | 记录 Workspace 项目阶段、官方 Slot 组合和当前无推进能力的边界 | 全部 |

## 实现方案

Host 包以 `fde_stage` storage domain 保存一张按 WorkspaceId 键控的项目记录表。Client 首次打开项目阶段时向本机同源 JSON 入口提交明确 WorkspaceId；Host 验证 Workspace 存在，为缺失记录初始化 `requirements`，并在持久提交后返回 revision 与时间。入口不接受阶段变更字段，当前浏览器和模型都不能推进项目。

Client 包在 apply 作用域建立一个 Host-backed observable controller，以 WorkspaceId 缓存加载、成功和失败状态并合并重复请求。两个 Conversation Slot contribution 共享同一 controller：空白会话在 `conversation.input.dock` 显示轻量当前阶段栏；已开始会话在 `conversation.session.header.utilities` 显示当前阶段。阶段栏从固定六阶段定义读取一句行动提示，从 Host 状态读取当前阶段与 revision，不重复阶段全景、资料或产物。点击入口时发布带明确 WorkspaceId 的浏览器内导航事件，F011 的项目页面控制器接收后直接进入该项目详情。原 `conversation.view` “交付流程”在 F011 开发时移除。F011 的受控阶段门成功后发布仅包含 WorkspaceId 的浏览器本地变更通知；本 controller 取消该 Workspace 旧请求并重新读取 Host，不把事件本身当作权威阶段值。

空白阶段提示位于 Composer Stack 中、InputBar 自身的水平 padding 之外，因此不能直接使用 `width: 100%`。它读取 Conversation 已公开的 `--dsh-composer-side-clearance` 和 `--dsh-composer-card-max-width`，用“容器宽度减去两侧 clearance＋相同 max-width＋水平居中”复现输入卡外边界；该修复不改变 Conversation DOM、Slot 或输入框尺寸。

当前阶段通过 `useWorkspaces` 中 Session membership 解析，绝不按 cwd、最近项目或页面缓存回退。切换会话和项目会重新选择 Workspace 状态；刷新和 Host 重启由 storage domain 恢复。未来阶段说明选择保留在组件本地，不写 Host。

## 实施顺序

1. 更新 confirmed PRD、Product Spec、Feature Map、Architecture 与 F010 三件套，并通过定向规格校验。
2. 新增 FDE Stage Host 包、持久化 schema、初始化入口和聚焦测试。
3. 新增 FDE Stage Client 包、共享 controller、两个上下文 Slot contribution 和组件测试。
4. 将两个包加入 Host/Client TypeScript 聚合、Web Bundle 依赖和 Cordis 配置。
5. 运行两个新包的聚焦测试与构建、官方完整构建，重启隔离 `DSH_HOME` 的 3080 服务。
6. 记录真实验证证据，交由用户手动检查页面，不运行浏览器截图或视觉自动化。
7. 在已授权需求调研门成功后接收 Workspace 级阶段变更通知，强制刷新会话头部/空白提示使用的状态缓存。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 空白 Session 的官方 header/view 隐藏 | 新项目尚未发言时不知道当前应做什么 | 使用现有 `conversation.input.dock` 显示一条轻量阶段栏；只增强官方 Hero 文案和样式，不修改 Conversation 状态机 | Client 组件测试＋人工检查 |
| 阶段信息在工作入口过重 | 抢占自然语言输入并与项目进度重复 | 只保留阶段、行动提示和一个可点击入口；完整六阶段与输入/输出全部留在项目进度 | Client 文案/样式测试＋人工检查 |
| 轻量入口只做外观没有导航 | 用户点击后无法进入当前项目详情 | 事件必须携带明确 WorkspaceId，项目页面控制器直接调用 `showProject(workspaceId)` | Stage/Project 联合组件测试 |
| Session 与 Workspace 状态异步到达 | 页面可能短暂无法确定项目 | 只在 membership 可用后加载，先显示加载状态；不按 cwd 猜测 | Controller/组件测试 |
| 重复 Slot 同时请求同一项目 | 可能产生重复初始化或闪动 | Client 和 Host 分别按 WorkspaceId 合并并发初始化 | Host/Client 聚焦测试 |
| 当前无详细交付门 | 提供推进按钮会产生假进度 | API 不提供阶段变更，UI 不渲染推进动作 | API 与组件测试 |
| 未来 F005 需要历史与实时推送 | 当前只读记录不足以表达返回、受影响和门槛证据 | F010 只拥有初始当前阶段；F005 确认后扩展权威事件和推送，不提前设计 | F005 规格阶段 |
| 项目进度和项目交付各自缓存阶段 | 人工门成功后会话头部仍显示旧 revision | 成功提交后只广播 WorkspaceId；项目交付重新读取 Host 权威值，事件不携带或覆盖阶段事实 | 两个 Client controller 联合聚焦测试 |

## 回退策略

两个插件通过独立 Bundle rows 挂载。若 Host 状态失败，移除 Client row 后现有项目、会话、对话和右侧开发 Dock 均保持可用；若完整撤回，再移除 Host row。阶段记录独立存储，不删除 Workspace、Session 或项目文件。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F010-001 | 固定六阶段与当前序号 | Client 组件测试 | 顺序、名称和当前状态逐项可见 |
| AC-F010-002 | 空白轻量阶段入口＋头部状态，无会话内完整进度 View | Client 组件/Slot 注册测试＋用户人工检查 | 空白会话轻量显示当前阶段和行动提示，并能进入当前项目详情；已开始会话显示紧凑当前阶段，且会话页签不承担完整项目进度 |
| AC-F010-003 | Workspace 级持久状态与提交后刷新 | Host 聚焦测试＋阶段变更通知/刷新 controller 测试＋重启后人工检查 | 同项目一致、跨项目隔离、阶段门后不保留旧 revision、重启恢复 |
| AC-F010-004 | 只读查看与真实失败 | Host API/Client 组件测试 | 无推进 API/按钮；查看未来阶段不改变 current，失败可重试 |
| AC-F010-005 | 人工返回后的同项目读模型刷新 | 阶段变更通知与 Workspace controller 聚焦测试 | 返回后同项目读取新 revision 与当前阶段，另一项目不刷新 |

---
document: feature-plan
feature: F009
status: ready
updated: "2026-08-26"
---

# F009 · 项目开发工作区实施计划

## 现有上下文与复用

- 当前官方 AppFrame 为左侧 `sidebar`、中部 `conversation`、右侧 `details`；F001 已在 `sidebar.workspaces` 中建立“项目 → 会话”，F002 已把客户原件保存到当前项目 `fde-resources/`。
- 官方 Workspace、FS、Conversation、Git/文件工具卡和 UI Slot 保持权威；当前页面已运行在锁定的 DeepSeek Harness `0.1.1-rc.2` / `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`。
- 采用社区 `dsh-better-sidebar@0.16.1`（提交 `f9153dfc1ce47cf43445c1b351ee3ae47b4ad9f1`，MIT）作为右侧工作台底座；其真实 rc.2 挂载 CI、可收起右/底面板、文件/编辑/Git 能力和第三方 Tab 注册服务是当前最成熟的组合证据。
- 采用 `dsh-file-review-tab@0.2.0`（提交 `31ef012c00708e9afe22b4eeff5740ee532c98da`，MIT）注册同一右侧 Dock 内的文件审查 Tab，并提供对话尾部改动摘要、标准文件工具与 Code Mode 变化重建、撤销/重新应用。
- 当前 `@lsq64737/dsh-workbench-layout@0.1.5` 与其 pnpm patch 将从 Bundle、lockfile 和 patch 配置中完全移除，避免左侧 Activity Rail、AppFrame 重排和右侧 Dock 同时存在。
- 必须保持现有 FDE 品牌、项目创建/切换、多会话、项目资料上传、官方 Conversation/Composer/Approval 行为不变。
- 必须保持的 Product Spec 合同：PSC-012, PSC-014, PSC-017。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| `packages/bundle/web-app/package.json` | 官方 Web/FDE 插件依赖 | 移除 Workbench Layout；精确加入 Better Sidebar `0.16.1` 与 File Review Tab `0.2.0` | 全部 |
| `packages/bundle/web-app/cordis.patch.yml` | Web Profile 组合 | 移除左侧工作台 row；挂载右侧工作台与审查 Host/Client 双面插件 | 全部 |
| `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`patches/` | 可重复依赖图与受控下游差异 | 删除 Workbench Layout 依赖、release-age 例外和 patch；固定右侧插件完整性，并用最小 patch 裁剪非当前功能 | 全部 |
| `docs/architecture/architecture.md` | 技术选择与布局事实 | 记录右侧 Dock、能力裁剪、Git Diff 与 Agent 审查区别 | 全部 |
| `docs/verification/` | 阶段运行证据 | 记录依赖解析、构建、配置挂载、HTTP 与人工待验收 | 全部 |

## 实现方案

把 Better Sidebar 与 File Review Tab 作为锁定 Web Bundle 依赖和普通 Cordis rows 加入当前官方组合，不复制源码。Better Sidebar 通过官方会话 Header/Overlay 挂载右侧面板，使用固定 Host 与布局让 `#root` 为 Dock 让出宽度；左侧 `sidebar.workspaces`、中央 `conversation` 和官方 `details` 语义不被替换。右侧内部使用统一 Tab 服务承载文件/编辑、Git Diff 和文件审查；File Review Tab 通过同一服务注册，不建立第二套面板。

用受控 pnpm patch 仅调整 FDE 发行默认值与当前工作流缺口：新项目会话默认展开右侧 Dock；禁用 Subagent、Side Chat、Browser 和模型终端工具等当前不需要的页面/能力；关闭底部面板自动终端，并隐藏底部工作台入口，保留 Files、Git、Diff 与 File Review。文件树订阅当前 Session snapshot，只在成功完成 `write/edit` 或 Code Mode 嵌套文件变更后合并 300ms 内的事件并刷新根目录、已展开目录及当前搜索；流式文本、读取工具和其他 Session 更新不触发刷新。插件设置仍允许后续产品阶段显式恢复能力，但当前界面不向用户暴露未验收的功能。

文件读写由 Better Sidebar Host 以 SessionId/cwd 约束到当前 Workspace，文本保存使用其原子写入与安全路径检查；文件树支持刷新，Git Diff 使用当前项目真实仓库。官方 Conversation 和 Composer 继续由原插件树拥有；工具卡与 produced-files 路径打开右侧文件。File Review Tab 从当前 Session snapshot 与 Host 记录重建每轮 Agent 文件变化，Git Diff 与 Agent 审查保持不同来源标签。

当前集成只有一个右侧工作台。Shell/外部编辑和无法形成完整 before/after 的变化不归入 Agent 审查；它们只通过 Git/磁盘状态可见。审查不可安全撤销时显示不支持或冲突，不做猜测性回滚。

## 实施顺序

1. 更新 confirmed PRD、Product Spec、Feature Map、Architecture 与 F009 三件套并通过当前 Feature 规格校验。
2. 移除 Workbench Layout 依赖、row、patch 与 release-age 例外，不删除任何用户项目文件或运行数据。
3. 在 Web Bundle 中以精确版本增加 Better Sidebar 与 File Review Tab，更新 lockfile并建立最小 FDE 默认裁剪。
4. 运行配置展开、插件包解析和官方构建，确认左侧项目入口、中央对话、右侧文件/编辑/Git/审查同时可组合。
5. 重启隔离 `DSH_HOME` 的 3080 服务，记录验证证据并交由用户手动验收右侧 Dock 产品形态。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| Better Sidebar 通过固定面板 Host 与 Conversation DOM 标记让出右侧宽度 | Harness 升级可能导致 Dock 布局失配 | 同时固定 Harness 与插件提交；其真实 rc.2 mount CI 加本项目 Boot/构建检查作为升级门 | 构建后配置检查与人工验收 |
| 插件默认能力较多 | 浏览器、侧边对话、子代理、底部终端会扩大当前产品 | 通过受控 patch 默认禁用或隐藏，只保留 Files、Git、Diff、File Review | Client 内容检查与人工验收 |
| 文件审查依赖官方工具结果和 Code Mode 记录 | Shell/外部变化无法完整按 Agent 轮次归因 | UI 明确区分；无法归因变化进入 Git/磁盘视图，不能显示为 Agent 审查 | 审查组件与人工验收 |
| 撤销会改写项目文件 | 过期或重叠变化可能覆盖后续编辑 | 使用插件的状态检查/冲突拒绝；不支持或冲突时禁止撤销并提示 | File Review 聚焦检查与人工验收 |
| Better Sidebar 含 `node-pty` | 安装脚本或本地二进制可能阻塞依赖安装 | 复用当前 Node 24 环境；当前禁用终端入口与模型终端工具，但保持依赖完整安装 | 依赖安装与构建 |

## 回退策略

右侧工作台由两个外部依赖与两个 Bundle rows 控制。若审查插件失败，可先移除 File Review row 保留 Files/Git；若底座导致启动或布局阻塞，再移除 Better Sidebar row 即恢复既有 FDE 项目/会话与官方对话。不删除项目文件、会话日志、`fde-resources/` 或用户 Git 状态，不执行工作区重置。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F009-001 | 左侧项目/会话＋中央对话＋右侧可收起 Dock | Bundle 配置解析＋成功构建＋用户人工页面检查 | 原项目树和对话不移动；右侧工作台可展开/收起 |
| AC-F009-002 | Workspace 文本读写、Agent 写入后文件树更新、保存与冲突真实 | 插件语法检查＋当前组合构建＋用户手动让 Agent 新建文件并检查文件树 | 文件真实落盘；Agent 成功写入后无需手动刷新即可出现，失败/冲突无假成功 |
| AC-F009-003 | Git Diff 与 Agent 文件审查 | 插件审查/Git 测试证据＋当前组合构建＋用户人工检查 | 两类差异各自真实、来源明确，非仓库与不可撤销状态诚实降级 |
| AC-F009-004 | Workspace/Session 切换隔离右侧状态 | 当前组合构建＋用户在两个项目间人工切换 | 文件树、审查与操作范围随项目/会话切换，旧项目不可误保存 |

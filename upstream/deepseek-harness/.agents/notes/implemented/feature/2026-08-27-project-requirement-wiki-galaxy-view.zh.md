# Agent Note: 项目需求 Wiki revision 与 Galaxy View

Status: implemented

[English](2026-08-27-project-requirement-wiki-galaxy-view.md) | 中文

## Problem

[项目资料导入](2026-08-26-project-resource-intake.zh.md)和本地解析流程为一个 FDE Workspace 提供持久的客户原件、SourceId 与派生文本，但这些记录仍然是彼此分散的文档。FDE 需要跨完整的选定资料集，审阅业务目标、角色、流程、系统、规则、约束、验收方向、风险、冲突和未知项之间的关系。没有来源身份的生成摘要无法审计，而原地更新一张共享图谱会让失败或陈旧的运行损坏上一份仍有价值的理解。

生成还涉及明确的数据与费用决定。打开项目页面不得向模型发送客户资料；为某个 Session、提供方和模型确认的构建也不得静默切换到另一条路由。图谱属于候选理解：发布图谱不得确认客户事实、更新需求基线或推进交付阶段。

## Decision

`@deepseek-ai/dsh-fde-project` 只使用既有 `@deepseek-ai/dsh-fde-source` 目录作为输入清单。可信启动请求指定一个已注册 Workspace 和 1～30 个明确 SourceId。每个获准 Source 必须处于 `ready` 状态，记录的字节数和修改时间必须与原件匹配，并且必须引用 `.fde/derived/` 下有界且不是符号链接的文件。构建会冻结 SourceId、原件元数据、解析器及其版本、派生路径、当前 Wiki revision 和完整项目 Source 目录的指纹。发布时会重新检查这些事实；资料发生变化、被移除、新增、来自其他项目、仍待解析或被重新解析时，都必须创建新构建。

浏览器只为属于该 Workspace 的现有 Session 准备构建，解析其可路由的提供方和模型，并在确认前展示两者。启动时会再次检查同一 Session 的项目归属和精确提供方／模型，然后才创建 Host 状态，并向该 Session 排队一条可见指令。排队失败时，Host 构建进入 `cancelled`；浏览和刷新 Wiki 永远不会调用模型。

Agent 会获得两个 Workspace 级工具。`requirement_wiki_get` 将精确 BuildId 标记为运行中，并返回其冻结 Source、预期 revision 和可选的当前 Wiki。`requirement_wiki_publish` 只接受一份完整候选，并拒绝未知引用、无效页面或关系身份、可执行 HTML、越界内容、陈旧 Source、陈旧 revision 或已被替代的构建。每个知识页、关系、冲突和未知项都至少引用该构建中的一个 SourceId。

成功发布会把页面 Markdown 和一份 manifest（元数据清单）写入新的不可变 `.fde/requirement-wiki/versions/RNNNNNN/` 目录，再原子替换 `current.json`。`build.json` 记录 `queued`、`running`、`succeeded`、`failed` 或 `cancelled`。失败和取消会保留之前的当前 revision；Source 目录变化只会把该 revision 标记为 `stale`，不会重写它。Host 快照只公开完整的当前 revision 和最近构建状态。

`@deepseek-ai/dsh-client-ui-fde-project` 把同一 revision 同时渲染为 Three.js Galaxy View 和语义化页面／关系列表。由 revision 与页面决定的确定性布局把知识页映射为按主题着色的发光 `Sprite`，并把关系映射为线段；OrbitControls 提供旋转、缩放和平移，搜索、主题筛选、一跳聚焦、悬停和选择都使用同一页面身份。相机与布局状态永远不会进入 Wiki 文件。视口小于 520 px、WebGL 初始化失败、上下文丢失或用户偏好减少动态效果时，界面会按需停用连续三维渲染，同时继续提供键盘可操作的列表、页面正文、问题项和 Source 链接。

实现参考了 3 份锁定版本且采用 MIT 许可的社区源码，但没有安装其运行时：`@evegoodevening/dsh-llmwiki@0.1.1` 提交 `7f620ccd2ef1d3a490c0b988149f9b518db35aa4` 提供 SourceId 溯源和原子 Markdown 发布思路；`wangning19940904/dsh-llm-wiki` 提交 `d7d896d58e3de4e2fbe0cf51d2938ea98a303bba` 提供 Workspace 隔离、Wiki link 和关系图组织思路；`Longwind1984/galaxy-view@0.6.1` 提交 `b49b60cb04687783153f24ff7f9b0a0af59334af` 提供星空、相机、搜索、筛选与聚焦交互词汇。交付的客户端使用 `three@0.184.0`；它不加载 Obsidian Vault/Workspace API、`3d-force-graph`、Python 进程、向量数据库或独立模型凭据。

## Verification

[REAL Loader 组合测试](../../../../packages/fde/project/tests/loader-composition.spec.ts)通过测试专用 `cordis.yml` 启动 Host 插件，让一个真实保存并解析的 Source 经过两个 Agent 工具，并从项目快照观察不可变 revision。[Host 行为套件](../../../../packages/fde/project/tests/requirement-wiki.spec.ts)固定重启恢复、陈旧状态、精确 revision 与 Source 检查、引用拒绝，以及失败或取消后保留当前 revision 的行为。

客户端套件固定精确 Session／提供方／模型确认、目标变化拒绝、确定性布局与筛选、来源追溯和可访问 WebGL 降级。[组装后的 Web 场景](../../../../apps/web/tests/requirement-wiki.e2e.ts)在没有模型凭据时加载交付组合，观察真实 WebGL canvas，筛选星体与关系数量，打开键盘列表，并记录用户可见快照。

## Alternatives considered

**原样安装任一社区 Wiki 插件。** 拒绝，因为两者都没有使用 FDE Source 记录、精确项目 Session／模型确认、完整不可变 revision、当前项目详情界面或既有 Host 信任规则。全局 Wiki 根目录或第二套解析器会创建另一套项目身份与摄取真源。

**在 Source 流水线旁运行向量数据库或自动 RAG（检索增强生成）摄取。** 拒绝，因为本功能需要对用户明确选定的当前文档做可审计梳理，而不是创建第二个后台索引。自动摄取还会让上传或解析隐含模型授权。

**覆盖一份可变 Wiki 或逐页发布。** 拒绝，因为部分模型结果、陈旧 Source、校验错误或进程失败可能留下混合 revision。完整候选校验加原子当前指针可以保留上一份可审阅版本。

**把图谱坐标持久化为知识事实。** 拒绝，因为相机和布局变化不会改变客户知识。确定性客户端布局能够提供稳定初始视图，而不增加第二个版本化数据模型。

**只使用静态列表或二维图。** 拒绝，因为已确认的产品方向要求 Galaxy View 作为关系全景。语义化列表仍是一等阅读与无障碍路径，而不是图谱的替代品。

## Consequences

一个项目可以把真实的本地解析客户资料转为可恢复、可追溯的候选 Wiki，而不修改原件，也不创建并行上传体系。每次成功构建都有固定溯源集合和不可变 revision；模型路由与客户资料传输则始终绑定到可见的用户确认。项目 Source 新增或变化会让当前结果明确显示为陈旧，而不是触发隐藏重建。

代价是 Three.js 带来有界但更大的客户端包，并且项目会保存每个已发布 revision。浏览器展示当前 revision，不提供历史浏览器或 revision diff；Wiki 也没有通用编辑器、embedding、跨项目搜索或自动提升为基线的能力。候选质量仍取决于模型；Source 引用只建立溯源关系，不代表客户确认或事实正确。

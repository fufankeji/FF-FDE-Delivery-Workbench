# @deepseek-ai/dsh-client-ui-fde-project

[English](README.md) | 中文

FDE 项目交付工作台的浏览器界面。它在保留左侧栏的前提下增加全局“项目进度”页面、带 Galaxy View 的项目需求 Wiki，并为当前项目增加“API 文档”“系统架构”“观测”“评估”四个会话页签。

## 行为

- “项目进度”打开时会替换中央与右侧工作区，底层对话、输入框和 Better Sidebar 不会透出，也不能接收操作。
- 页面读取现有 Workspace 列表、新建项目元数据、Session 摘要和 Workspace 级六阶段记录，不虚构完成百分比。项目卡会先进入只读“项目详情”，展示该项目的 Source 清单、处理状态、共享预览位置和明确的“进入项目交付”动作。
- “API 文档”“系统架构”“评估”读取可信的 `/api/fde-project/snapshot` 接口。
- “观测”汇总当前项目既有的 `sessionStats` 与 `tokenUsage` 投影；只有部署显式配置后才允许外部导出。
- “运行评估”必须由用户主动点击。它会向当前 Agent 排队一条使用 `eval_run` 的指令；加载插件或打开页面不会触发模型调用。
- 浏览需求 Wiki 不会启动模型调用。FDE 只能选择已经本地解析为 `ready` 的 Source，然后确认准确的现有项目 Session、Provider、模型、可能费用与客户数据传输边界。本包会在创建 Build 前再次核对该目标，并且只向已确认的 Session 排队指令。
- Wiki 把所有结果标记为候选理解，并展示 revision、stale/Build 状态、Source 链接、冲突与未知项。Three.js Galaxy View 与可用键盘操作的知识页/关系列表读取同一不可变 revision；搜索、主题筛选、一跳聚焦、相机移动与选择都不会改变 Wiki 事实。

## 项目文件

```text
.fde/api-docs.json
.fde/architecture.json
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
.fde/requirement-wiki/build.json
.fde/requirement-wiki/current.json
.fde/requirement-wiki/versions/RNNNNNN/manifest.json
.fde/requirement-wiki/versions/RNNNNNN/pages/*.md
```

## 模型体验

### 需求 Wiki 构建指令

#### 模型看到什么

只有在 FDE 确认一组 Source 及页面显示的 Session/Provider/模型目标后，本包才会向该准确 Session 排队以下用户消息。`<BuildId>`、`<revision>` 和 `<source-list>` 来自可信 Host Build；每条 Source 行只包含一项已选择的 SourceId、派生路径与存储文件名。

##### 排队的用户消息

```markdown
请执行当前 FDE 项目的需求知识整理。BuildId=<BuildId>，页面基于 revision R<revision>。

先调用 requirement_wiki_get，并传入 BuildId；随后只读取它返回的以下固定派生文本，不要读取其他项目或自行扩展来源：
<source-list>

把资料整体梳理为业务目标、角色、流程/SOP、系统与数据、业务规则、约束、验收方向、风险、冲突和未知项。每个知识页、关系、冲突和未知项都必须引用一个或多个本次 SourceId。完成后调用 requirement_wiki_publish 一次提交完整候选，expectedRevision 必须使用 requirement_wiki_get 返回的值。不要把候选理解写成客户已确认事实，不要推进项目阶段或项目基线。
```

#### Token 影响

加载或浏览页面不会增加 Token。一次已确认的 Build 会向目标 Session 追加该消息和已选 Source 清单；派生文本与 Wiki 数据只在 Agent 随后调用 Host 管理的读取和需求 Wiki 工具时进入上下文。

#### KV Cache 影响

已确认指令会追加到普通 Session 后缀，不替换更早的请求前缀。BuildId、revision 与 Source 行会随每次 Build 变化，因此该后缀只属于当前 Build。

## 已知限制与延期工作

- 当前项目创建元数据保存在浏览器本地 Workspace 视图存储中，另一浏览器暂时不会同步企业与周期字段。
- API 文档能否嵌入取决于目标服务的 frame 策略；页面始终保留在新窗口打开的后备入口。
- 第一版架构图使用确定性的分组布局，不提供交互式编辑。
- 部署配置关闭导出时，页面不展示外部 Langfuse/OTLP 状态。
- 项目详情刻意保持只读；编辑、移动、删除和 Agent 使用仍属于项目交付或后续确认的功能。
- 项目没有可路由模型的 Session，或没有至少一项当前状态为 `ready` 的 Source 时，不能构建需求知识；目标发生变化后必须重新确认。
- 浏览器只展示当前 Wiki revision，不提供通用 Wiki 编辑器或 revision diff。视口低于 520 px、WebGL 不可用、上下文丢失或用户偏好减少动态效果时，同一知识仍通过语义列表可用。

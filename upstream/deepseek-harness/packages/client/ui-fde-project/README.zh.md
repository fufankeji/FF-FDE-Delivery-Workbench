# @deepseek-ai/dsh-client-ui-fde-project

[English](README.md) | 中文

FDE 项目交付工作台的浏览器界面。它在保留左侧栏的前提下增加全局“项目进度”页面、带 Galaxy View 的项目需求 Wiki，并按阶段开放 4 个交付页签：方案设计开始显示“系统架构”，项目开发开始显示“API 文档”和“评估”，验证评估开始显示“观测”。

## 行为

- “项目进度”打开时会替换中央与右侧工作区，底层对话、输入框和 Better Sidebar 不会透出，也不能接收操作。
- 页面读取现有 Workspace 列表、新建项目元数据、Session 摘要和 Workspace 级六阶段记录。“项目详情”展示真实阶段输出：需求调研三份文件；方案设计五份文档与架构；项目开发标准核心 docs、Feature/任务证据和三份收口文件。已有 Markdown 可就地只读。FDE 只有在对应 Host 检查通过后，才能经过二次确认进入方案设计、项目开发或验证评估；Agent 没有这些动作。Host 提交成功后会让同项目的阶段提示失效并重新读取同一持久 revision。
- “进入项目交付”默认打开该 Workspace 中按更新时间最新的非归档普通 Session；子 Agent、归档和其他项目 Session 不参与。只有项目不存在可恢复 Session 时才使用官方首个空白会话流程。
- “对话”和“轨迹”贯穿整个交付过程；项目结果页签只有对应阶段开始后才注册，加载中或读取失败不会提前显示后续能力。
- “API 文档”“系统架构”“评估”读取可信的 `/api/fde-project/snapshot` 接口。
- “观测”汇总当前项目既有的 `sessionStats` 与 `tokenUsage` 投影；只有部署显式配置后才允许外部导出。
- “运行评估”必须由用户主动点击。它会向当前 Agent 排队一条使用 `eval_run` 的指令；加载插件或打开页面不会触发模型调用。
- 浏览需求 Wiki 永远不会启动模型调用。FDE 只能选择已经完成本地解析且处于 `ready` 状态的 Source，然后确认精确的现有项目 Session、提供方、模型、可能产生的费用和客户资料传输。创建构建前，本包会重新检查该目标，并且只向确认的 Session 排队指令。
- Wiki 会把每项结果标记为候选理解，并展示 revision、陈旧／构建状态、Source 链接、冲突和未知项。Three.js Galaxy View 与键盘可操作的页面／关系列表读取同一不可变 revision；搜索、主题筛选、一跳聚焦、相机移动和选择都不会改变 Wiki 事实。

## 项目文件

```text
.fde/api-docs.json
.fde/architecture.json
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
fde-deliverables/01-requirement-research/requirement-research-report.md
fde-deliverables/01-requirement-research/confirmation-checklist.md
fde-deliverables/01-requirement-research/requirement-baseline.md
fde-deliverables/02-solution-design/project-prd.md
fde-deliverables/02-solution-design/solution-design.md
fde-deliverables/02-solution-design/development-plan.md
fde-deliverables/02-solution-design/acceptance-plan.md
fde-deliverables/02-solution-design/solution-baseline.md
docs/PRD.md
docs/specs/product-spec.md
docs/specs/feature-map.md
docs/specs/FNNN-slug/spec.md
docs/specs/FNNN-slug/plan.md
docs/specs/FNNN-slug/tasks.md
fde-deliverables/03-project-development/implementation-report.md
fde-deliverables/03-project-development/runbook.md
fde-deliverables/03-project-development/development-baseline.md
.fde/requirement-wiki/build.json
.fde/requirement-wiki/current.json
.fde/requirement-wiki/versions/RNNNNNN/manifest.json
.fde/requirement-wiki/versions/RNNNNNN/pages/*.md
```

## 模型体验

### 需求 Wiki 构建指令

#### 模型看到什么

只有在 FDE 确认一组资料和界面展示的 Session／提供方／模型目标后，本包才会向该精确 Session 排队以下用户消息。`<BuildId>`、`<revision>` 和 `<source-list>` 是可信 Host 构建提供的动态值；每个资料清单行只包含一个选定 SourceId、派生路径和保存文件名。

##### 排队的用户消息

```markdown
请执行当前 FDE 项目的需求知识整理。BuildId=<BuildId>，页面基于 revision R<revision>。

先调用 requirement_wiki_get，并传入 BuildId；随后只读取它返回的以下固定派生文本，不要读取其他项目或自行扩展来源：
<source-list>

把资料整体梳理为业务目标、角色、流程/SOP、系统与数据、业务规则、约束、验收方向、风险、冲突和未知项。每个知识页、关系、冲突和未知项都必须引用一个或多个本次 SourceId。完成后调用 requirement_wiki_publish 一次提交完整候选，expectedRevision 必须使用 requirement_wiki_get 返回的值。不要把候选理解写成客户已确认事实，不要推进项目阶段或项目基线。
```

#### Token 影响

加载或浏览页面不会增加 Token。一次已确认构建会把该消息和选定 Source 清单追加到目标 Session；派生文本与 Wiki 数据只会通过 Agent 随后调用的 Host 读取工具和需求 Wiki 工具进入上下文。

#### KV 缓存影响

已确认指令会追加到普通 Session 后缀，不会替换更早的请求前缀。BuildId、revision 和 Source 行会随构建变化，因此该后缀只适用于当前构建。

## 已知限制与延期工作

- 当前项目创建元数据保存在浏览器本地 Workspace 视图存储中，另一浏览器暂时不会同步企业与周期字段。
- API 文档能否嵌入取决于目标服务的 frame 策略；页面始终保留在新窗口打开的后备入口。
- 第一版架构图使用确定性的分组布局，不提供交互式编辑。
- 部署配置关闭导出时，页面不展示外部 Langfuse/OTLP 状态。
- 项目详情中的文件保持只读；唯一写操作是 Host 重新检查固定文档、架构状态和 revision 后的 FDE 明确阶段确认。编辑、移动、删除和 Agent 使用仍属于项目交付。
- 只有项目已经存在带可路由模型的 Session，并且至少有一个当前有效的 `ready` Source 时，才能构建需求知识。目标变化后必须再次确认。
- 浏览器只展示当前 Wiki revision，不提供通用 Wiki 编辑器或 revision diff。视口小于 520 px、WebGL 不可用、上下文丢失或用户偏好减少动态效果时，同一份知识仍可通过语义化列表访问。

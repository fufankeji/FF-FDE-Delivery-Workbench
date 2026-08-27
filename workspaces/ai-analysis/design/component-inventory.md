# Northlight 组件清单

## 应用骨架

- `AppShell`：全高桌面容器；左侧导航是项目/入口上下文，不承担业务详情；
- `ProjectRail`：新建对话、功能入口、最近项目、数据源状态与品牌时刻；
- `WorkspaceHeader`：项目名、当前数据基线、全局动作和真实运行状态；
- `CanvasPanel`：右侧或放大报告工作态，可调整宽度，关闭后恢复中央对话宽度。

## 数据与 Agent

- `ConversationMessage`：用户、Agent、系统确认三种语义，不展示隐藏思维；
- `RunSummary`：输入、工具步骤、结果与完成状态，步骤来自真实事件；
- `DataArtifactCard`：统一承载表格、图表、代码、模型、预测和报告引用；
- `ResultViewSwitcher`：同一数据 artifact 的 Table/Trend/Heatmap 等视图切换；
- `DataGrid`：固定列、排序、筛选、分页、字段类型、行数和下载；
- `ChartSurface`：ECharts spec、来源、图例、筛选和加入报告；
- `ProvenancePanel`：来源表、查询、过滤、版本和上游 artifact。

## 项目与数据源

- `ProjectCard`：名称、源、最近运行、产物数量和状态；
- `SourcePicker`：MySQL/SQLite/Excel/CSV 四种入口；
- `ConnectionForm`：凭证字段、测试连接、只读说明和可行动错误；
- `BaselineStatus`：pending/profiling/ready/changed/failed；
- `SchemaGraph`：真实/推断关系分型，节点与字段详情同步；
- `QualitySignal`：字段、严重度、证据、建议动作，不用泛化警报。

## 建模、报告和 Skills

- `ExperimentFlow`：数据指纹、切分、基础模型、融合、预测的真实依赖；
- `MetricTable`：模型/切分/指标归属明确，可比较但不虚构优胜；
- `ReportEditor`：Markdown 源、结构目录、证据插入和保存状态；
- `VersionTimeline`：不可变版本、比较、恢复为新版本；
- `SkillCard`：built-in/user、installed/enabled、版本、内容哈希；
- `PermissionReview`：提示/文件/数据库/代码/网络权限，脚本默认无网络沙箱。

## 基础组件与状态

- 按钮：primary copper、secondary ink、quiet、danger；全部有 loading/disabled/focus；
- 表单：深墨输入、暖色 focus ring、错误原因与下一步；密码值永不回显；
- 标签：ready/success、running、warning、failed、read-only、version；
- 空白、运行、确认、可恢复错误、访问拒绝六类状态以 Round 14 为视觉依据；
- 动效只承担状态变化、Canvas 展开、视图过渡和血缘聚焦，遵守 `prefers-reduced-motion`。


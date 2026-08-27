# @deepseek-ai/dsh-client-ui-fde-project

[English](README.md) | 中文

FDE 项目交付工作台的浏览器界面。它在保留左侧栏的前提下增加全局“项目进度”页面，并为当前项目增加“API 文档”“系统架构”“观测”“评估”四个会话页签。

## 行为

- “项目进度”打开时会替换中央与右侧工作区，底层对话、输入框和 Better Sidebar 不会透出，也不能接收操作。
- 页面读取现有 Workspace 列表、新建项目元数据、Session 摘要和 Workspace 级六阶段记录，不虚构完成百分比。项目卡会先进入只读“项目详情”，展示该项目的 Source 清单、处理状态、共享预览位置和明确的“进入项目交付”动作。
- “API 文档”“系统架构”“评估”读取可信的 `/api/fde-project/snapshot` 接口。
- “观测”汇总当前项目既有的 `sessionStats` 与 `tokenUsage` 投影；只有部署显式配置后才允许外部导出。
- “运行评估”必须由用户主动点击。它会向当前 Agent 排队一条使用 `eval_run` 的指令；加载插件或打开页面不会触发模型调用。

## 项目文件

```text
.fde/api-docs.json
.fde/architecture.json
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
```

## 模型体验

无。本浏览器插件只注册界面；宿主包负责模型可见工具，以及由用户明确动作提交的提示。

#### KV Cache 影响

无；该浏览器包不会组装或改变提供方请求。

## 已知限制与延期工作

- 当前项目创建元数据保存在浏览器本地 Workspace 视图存储中，另一浏览器暂时不会同步企业与周期字段。
- API 文档能否嵌入取决于目标服务的 frame 策略；页面始终保留在新窗口打开的后备入口。
- 第一版架构图使用确定性的分组布局，不提供交互式编辑。
- 部署配置关闭导出时，页面不展示外部 Langfuse/OTLP 状态。
- 项目详情刻意保持只读；编辑、移动、删除和 Agent 使用仍属于项目交付或后续确认的功能。

# @deepseek-ai/dsh-client-ui-fde-project

[English](README.md) | 中文

FDE 项目交付工作台的浏览器界面。进入系统默认显示全局“项目中心”，用户先创建或管理项目，再进入单项目首页和真实交付环境。项目中心与常驻左侧栏打开浏览器持有的同一“新建项目”表单；创建只建立项目并打开管理页，只有用户显式点击“进入项目”才打开或创建 Session。方案设计开始显示“系统架构”，项目开发开始显示“用量分析”和项目运行控制，验证评估开始显示“评估优化”；只有项目正在运行且存在真实 OpenAPI 来源时才显示“API 文档”。

## 行为

项目预览只提交 Workspace ID 获取平台持有的隔离地址，授权其精确本地入口后，在当前 Session 的 Browser 页签中打开。阶段快捷动作和 Session 页头共用该流程，不要求业务项目修改 CSP 或端口；页头另提供显式外部打开原运行地址。Better Sidebar 的 downstream 补丁按真实父页面来源判断嵌入策略，不再拒绝所有非通配白名单，无法判定的表达式交给浏览器执行。

V2 第五阶段把开发留在 Agent 对话中。项目工作台展示受测版本与范围、共享运行操作、项目定义的指标及来源和结果证据、待解决条件，以及明确的 FDE 阶段验收。页面不虚构开发任务，也不在进入时启动工作。验证操作只准备可编辑的对话草稿，运行操作复用 Session 页头实现。项目记录在正文按需展开，滚动区域止于原生输入框上方。历史第五阶段只提供记录查看，不提供执行或验收操作。第五阶段指标视图不替换旧验证页面或其中可选的 Agent Trial 运行器。

- “项目中心”是默认系统入口，并替换中央与右侧工作区，底层对话、输入框和 Better Sidebar 不会透出，也不能接收操作。页面不再用独立页头重复侧栏品牌。默认“待我处理”展示真实项目数、待人工决定数、运行中会话数，以及每个项目的阶段位置、AI FDE 当前工作、产物或证据、最近活动、运行状态、交付周期和建议下一步；“新建项目”打开与侧栏相同的结构化表单，创建成功后打开允许零 Session 的项目详情。每个项目直接提供“进入项目”和“查看阶段与产物”操作。“全部项目”提供列表、卡片和真实交付时间线。页面只读取当前隔离 DSH 状态中登记的 Workspace，不补演示项目、虚假趋势或无行动含义的首屏组合图表。
- 页面读取现有 Workspace 列表、新建项目元数据、Session 摘要和 Workspace 级六阶段记录。“项目详情”展示真实阶段输出：需求调研三份文件；方案设计五份文档与架构；项目开发标准核心 docs、Feature/任务证据和三份收口文件；验证评估的候选版本、环境、数据／用例、指标与证据、问题、阻塞项和三份验证产物；部署试运行的版本/环境/证据/问题与四份产物；以及最终验收、交付物、条件项、责任移交和四份移交产物。已有 Markdown 可就地只读。FDE 只有在对应 Host 检查通过后，才能经过二次确认完成全部六个固定转换，包括部署试运行进入验收移交，以及验收移交进入项目终态；Agent 没有这些动作。项目详情也提供“返回上一阶段”：必须填写原因并二次确认，每次只返回一级，不删除任何产物，展示最近一次审计，并把受影响的后续阶段标为待重新确认；终态使用“重新打开项目”。Host 提交成功后会让同项目的阶段提示失效并重新读取同一持久 revision。
- “进入项目交付”默认打开该 Workspace 中按更新时间最新的非归档普通 Session；子 Agent、归档和其他项目 Session 不参与。只有项目不存在可恢复 Session 时才使用官方首个空白会话流程。
- “对话”和“轨迹”贯穿整个交付过程；项目结果页签只有对应阶段开始后才注册，加载中或读取失败不会提前显示后续能力。
- 第四阶段可选的本体路线只渲染当前 Workspace 中通过结构校验的 `.fde/design/knowledge-graph.json`。共享 `3d-force-graph` 负责实时三维模拟；按真实连通分量向展示锚点施加柔性引力，让独立小团留在画面内，不固定坐标或补造关系。发光节点、按连接度显示的光环、Bloom 泛光和相机相对星空提供空间层次。首次取景适应真实图谱，避让名称无需悬停即可显示。默认显示全部真实关系；可选主干采用确定性的最大生成森林，不代表业务重要性判断。流动粒子仅表示已登记关系的方向，不代表实时执行。自动环绕、暂停／播放、拖拽或查看节点时中断，以及减少动态效果适配，让动效可控。搜索、沿关系跳转、社区隔离、重置、全屏和证据详情不会修改项目事实。
- 从项目开发阶段开始，Session 顶部会提供“启动项目”。它先启用锁定版本 Better Sidebar 的终端与浏览器能力，记录一个精确 Host 操作，再向项目 Session 排队一条可见指令。Agent 读取项目 `AGENTS.md`，在名为“项目运行”的持久终端中启动真实服务，验证 loopback 地址，并报告成功或具体阻塞。启动阻塞后页面保持低频刷新；同一 Session 和操作在补齐条件后可以恢复为运行中。运行后会显示“打开项目”“查看终端”和“停止项目”；停止操作使用原 Session，通过终端工具发送中断，并在当前 Host 生命周期内保留终端输出。“查看终端”始终定位运行记录绑定的 Session，短暂等待实时页签，也兼容用户已经可见的同名终端。若 Host 重启已经丢失旧 Agent PTY，页面会返回该项目对话，只让 Agent 创建替代观察终端并核验既有预览，不重复启动服务，也不声称恢复了旧日志。
- 当前启动操作首次进入 `running` 时，页面会把已验证 loopback authority 加入白名单，并自动打开一次 Better Sidebar 内置 Browser；不会调用操作系统浏览器，也不会因重复读取同一快照反复打开。“API 文档”“系统架构”“评估”读取可信的 `/api/fde-project/snapshot` 接口；runtime 不是 `running` 或快照没有已配置 OpenAPI 来源时，“API 文档”不会出现。
- “用量分析”汇总当前项目既有的 `sessionStats` 与 `tokenUsage` 投影，展示 Token、模型调用、会话活动与运行耗时；只有部署显式配置后才允许外部导出。
- 从验证评估开始，“评估优化”会明确展示“生成评估方案 → 确认评估方案 → 开始验证”。总览直接根据当前项目快照计算完成度、结果分布、证据与产物覆盖、阻塞、类别覆盖和五步推进；结果与类别筛选只改变页面展示。指标会显示此前阶段的文档来源编号，确认绑定当前方案定义摘要；正常写回执行结果和 FDE 决定都不会使确认失效。项目进度页会把长哈希、路径和问题说明约束在各自卡片内。仍为 open 的问题会提供只属于 FDE 的行内接受表单；尚未满足的必需指标则单独提供“人工接受指标”。FDE 必须填写理由，该指标才不再阻塞；真实 NOT_RUN／FAIL 与证据缺口继续可见。两种操作都会刷新当前项目快照，只影响目标项，且不会把指标改成 PASS。既有 Agent Trial 运行器保留为“运行固定用例”，它只是可选验证方法，不代表完整流程。生成方案、开始验证和运行固定用例都必须由用户明确点击；加载插件或打开页面不会触发模型调用。
- “部署试运行”展示当前候选版本、目标环境授权、五类项目内证据、问题决定、阻塞项和四份固定产物。未解决问题提供只属于 FDE 的行内接受表单，接受理由绑定页面当前展示的精确合同；接受一条问题不会改写其证据、授权目标环境或清除其他阻塞。当证据、问题决定和产物已经齐备时，另一项两步 FDE 操作确认页面当前展示的目标环境与试运行结论；Host 只记录授权和就绪状态，不执行部署、停止或回滚。“验收移交”展示最终版本、企业结论、受控交付物位置、条件项、培训/权限/运维责任移交、阻塞项和四份固定产物。它的四步 FDE 表单会基于页面当前精确摘要记录带多份项目证据的企业结论、仅真实可取得的交付物、每项条件的解决或人工接受决定，以及带证据的培训和权限/运维责任移交。保存表单只改变事实记录，不会代替这些现实动作，也不会完成项目。两个页面的阶段转换仍需要独立的 FDE 二次确认；项目进入终态后保留验收移交记录，并把六个阶段段落全部显示为已完成。

## 项目文件

```text
.fde/project-runtime.json
.fde/api-docs.json
.fde/architecture.json
.fde/design/knowledge-graph.json
.fde/design/semantica/
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
.fde/evaluations/validation.json
.fde/evaluations/validation-plan-approval.json
.fde/deployment-trial.json
.fde/acceptance-handover.json
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
fde-deliverables/04-validation/validation-plan.md
fde-deliverables/04-validation/validation-report.md
fde-deliverables/04-validation/validation-baseline.md
fde-deliverables/05-deployment-trial/deployment-runbook.md
fde-deliverables/05-deployment-trial/deployment-baseline.md
fde-deliverables/05-deployment-trial/trial-operation-report.md
fde-deliverables/05-deployment-trial/issue-closure-list.md
fde-deliverables/06-acceptance-handover/delivery-inventory.md
fde-deliverables/06-acceptance-handover/acceptance-report.md
fde-deliverables/06-acceptance-handover/operations-and-maintenance-guide.md
fde-deliverables/06-acceptance-handover/handover-record.md
```

## V2 交付工作台

侧栏和正文默认跟随项目实际阶段，显式回看时只改变浏览位置，返回当前阶段只清除浏览选择。不提供演示横幅、独立入口、额外数据源或第二条生命周期；第八阶段已完成轮数与最近评审时间来自持久化项目状态。

V2 第六至八阶段分别展示试点准备与结果、生产验收交接、证据驱动改进。页签读取 Host 核验的 delivery 事实，详情从右侧打开，固定记录保留，不再出现窄记录轴。未来和历史阶段只读预览，不推进生命周期。执行仍在 Agent 对话；不以页面存在表示已经接通部署、监控或生产查询执行器。


## 模型体验

### 项目启动与停止指令

#### 模型看到什么

只有 FDE 点击“启动项目”或“停止项目”后，本包才会向精确项目 Session 排队一条可见用户消息。消息包含 Host 签发的 operation id，并要求 Agent 读取项目自身 `AGENTS.md`、用 Better Sidebar 终端工具管理持久进程、验证真实就绪或退出状态，最后通过 `project_runtime_report` 结束该操作。界面不会猜测命令、端口、预览路径或 OpenAPI 位置。

#### Token 影响

打开项目页面不会增加运行提示 Token。每次明确启动或停止只向选定 Session 追加一条有界指令；项目说明、终端输出和验证结果只在 Agent 实际读取或调用后进入上下文。

#### KV 缓存影响

运行指令追加到普通 Session 后缀；operation id 和已验证项目事实只属于当次操作，不会替换更早的请求前缀。

## 已知限制与延期工作

- 当前项目创建元数据保存在浏览器本地 Workspace 视图存储中，另一浏览器暂时不会同步企业与周期字段。
- API 文档能否嵌入取决于目标服务的 frame 策略；“打开项目”本身使用内置 Better Sidebar Browser。
- 项目启动依赖锁定版本 Better Sidebar 的终端 Host 依赖。缺少 `AGENTS.md`、终端工具不可用、项目尚不能启动或就绪检查失败时，系统保持可见阻塞状态，不伪装成功。
- 架构图使用确定性的分组布局，不提供交互式编辑。默认在输入框上方的可用视口内完整显示所有分组；缩放相对于该适应尺寸计算，“适应窗口”恢复完整总览。保留节点检查、连线动画和完整架构的 SVG/PNG 导出。
- 部署配置关闭导出时，页面不展示外部 Langfuse/OTLP 状态。
- 项目详情中的文件保持只读；写操作仅限 Host 重新检查固定文档、结构化状态、证据、架构和 revision 后的 FDE 明确阶段确认、带理由的单步阶段返回，以及 Host 按精确合同复核后，对一条仍为 open 的验证问题或一个尚未满足的必需指标作出带理由的人工接受。阶段返回不会编辑或删除项目产物；指标接受只记录独立决定，不覆盖真实结果。编辑、移动、删除、指标结果覆盖、部署执行、客户签章和 Agent 使用仍属于项目交付或项目受控外部流程。

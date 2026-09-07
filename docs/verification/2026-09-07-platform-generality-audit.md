# 第一版平台通用性与证据链审计

日期：2026-09-07。

审计基线：`main`，`2e57ccb01e690958f58b73f4e573cde50b0d7b8f`。这是审计报告，不是已实施的整改，也不改变已确认的产品规格。

后续实施与剩余边界见[通用性修复验证记录](2026-09-07-platform-generality-repair.md)。下文保留审计时事实，不作为修复后状态。

## 结论

当前平台不是把“门店维修项目”整体写死的专用系统：项目、资料、阶段文件、Schema、图谱、架构、验证指标均有项目级读取路径。空项目不会自动得到维修数据、图谱或完成状态。但不能据此认定“所有阶段数据都来自真实执行”或“跨项目完整交付已验证”。

主要问题是：部分阶段过度信任文件中的状态声明；测试项目中的联调数据可以满足正常评审条件；图谱的一些可配置字段没有参与实际计算；后续 Agent 查询会反向改变第四阶段的评审证据。

建议保留 Workspace、Host/Client 插件、项目文件和三维渲染底座，针对以下问题修复，不按测试案例另写特判。

## 范围与方法

- 核对 FDE Stage、Project、Source、Semantica Host 插件及 Web Bundle 注册。
- 核对八阶段动态提示词、内置 Skills 的生成和注册、固定产物与结构化状态合同。
- 核对项目中心/阶段工作台、图谱数据适配器、项目级请求与缓存。
- 对照项目总规格和第四阶段规格，区分产品固定规则与案例固定值。
- 只读检查当前 FDE-Agent 的阶段数据、数据性质说明和随仓库分发的导入脚本。
- 使用临时空项目和临时图谱副本调用实际投影/状态/查询函数；不推进真实项目、不调用付费模型、不重启 3080/3081/4177。
- 运行 11 个定向测试文件。不做全仓安全审计、浏览器验收或历史会话逐条回放；不宣称已经跑通第二个真实客户项目的八阶段。

## 已确认的通用链路

| 层面 | 当前实现 | 判断 |
| --- | --- | --- |
| 项目身份 | HTTP 用 Workspace ID 查注册表；模型工具从 Session cwd 解析注册项目 | 不是固定 FDE-Agent 路径 |
| 阶段状态 | Workspace ID 为存储键，新项目初始化 discovery / revision 1 | 不是默认第八阶段 |
| Skills | Host 注册方法，当前项目阶段选择短提示词，完整内容按需加载 | 是通用方法指引，不是自动执行器 |
| 资料 | 当前项目 `fde-resources/`、`.fde/sources/`、`.fde/derived/` | 不自动读取其他项目素材 |
| 方案路线 | 普通 Schema 与 Ontology 路线分别处理 | 不强制所有项目建图 |
| 图谱 | 读取当前项目 nodes/edges，颜色和分组由类型/社区生成 | 未发现按维修节点 ID、名称或 56/56 数量硬编码 |
| 第五阶段指标 | 从当前项目 evaluation.testing.metrics 读取动态数组 | 指标不是固定维修用例 |
| 第六至八阶段 | 读取当前项目 delivery.items，按固定业务类别分组 | 类别固定，事项与结果动态 |
| 随仓库素材 | 只有显式执行 load.mjs 才复制案例到新隔离目录 | 案例不是平台默认业务数据；导入会恢复该案例的历史阶段 |

主要源码：

- `upstream/deepseek-harness/packages/fde/project/src/tool-context.ts:12`
- `upstream/deepseek-harness/packages/fde/project/src/snapshot.ts:532`
- `upstream/deepseek-harness/packages/fde/stage/src/index.ts:622`
- `upstream/deepseek-harness/packages/fde/stage/src/state.ts:332`
- `upstream/deepseek-harness/packages/client/ui-fde-project/src/client/controller.ts:908`
- `upstream/deepseek-harness/packages/client/ui-fde-project/src/client/knowledge-graph-layout.ts:44`
- `source-materials/fde-agent/load.mjs:20`

八阶段名称、固定产物路径、状态枚举、读取/建议/草稿/执行四类边界，以及交付类别，是当前产品的标准合同，不应仅因为它们是常量就认定为案例写死。固定八阶段顺序也不是“适配任意方法论”的可配置流程引擎；两种能力应分开表述。

## A1 · 高优先级：第二、三阶段空产物可以达到可评审状态

位置：`packages/fde/project/src/v2-stage-surface.ts:183`、`:284`、`:1081`、`:1158`（本报告中 packages 均相对于 `upstream/deepseek-harness/`）。

固定产物检查只判断是否为普通文件，不要求非空或有效内容。第三阶段只要求 investigation 的五个数组存在，允许全部为空；其中系统/治理的 blocked、pending 和动作边界未知，也没有自动汇入评审阻塞，仍依赖根对象 blockers 的人工/Agent 声明。

实际复现：分别建立三份零字节产物，状态写为 review-ready、四个工作项 complete、blockers 为空；第三阶段另加五个空数组。两个阶段均返回 `presentCount=3, reviewReady=true, reviewBlockers=[]`。

这不表示页面打开就会自动推进，人工阶段操作仍存在；但“后台已具备评审条件”不能证明调查或范围定义已完成。

建议：为当前阶段必要内容与证据建立最小校验；未知、受阻和不适用必须有清晰处理方式，不只检查文件数量，也不能让简单项目为了过关伪造系统/审批人。

## A2 · 高优先级：执行结果声明与真实执行证明没有完整分开

位置：`packages/fde/project/src/evaluation-workbench.ts:116`、`:126`、`packages/fde/project/src/delivery-workbench.ts:89`、`:116`、`packages/fde/semantica/src/state.ts:908`。

第五阶段指纹绑定候选文件、版本、环境和指标定义；结果状态直接取 JSON 中声明的 PASS。证据要求可读取、非空，但没有绑定 Harness 实际执行回执，也不核对内容与声称结果是否相符。第五阶段结果证据本身的摘要没有纳入上述运行指纹。

实际复现：证据文件明确写 `NOT EXECUTED`，从真实读取函数获取指纹后写入一个声明的 PASS；投影仍返回 `current=true, status=PASS, reviewBlockers=[]`。这验证的是当前程序信任边界，不代表本轮执行了这个虚构测试。

第六至八阶段比第五阶段多做文件摘要、版本、环境范围、owner、observedAt 检查，但这些字段仍由记录作者提供。第四阶段切片上报也主要检查所引用文件存在，然后保存调用者提供的 succeeded/failed。

**当前项目确有联调输入，不是推测：** `/Users/muyu/FDE-Agent/fde-agent/docs/verification/2026-09-07-delivery-flow-fixture.md` 明确说明，第五阶段人工验收 PASS 是测试输入，六至八阶段发布、采用、验收等是构造数据。相关阶段 JSON 保存 `dataProvenance.kind=integration-fixture`；当前 Host 投影不消费这个字段。本轮只读调用显示六至八阶段全部 `reviewReady=true`。

这些数据是之前获授权进行流程联调的输入，不是平台在所有新项目中自动造数。产品总规格 PSC-023 要求结构通过与事实真实性分开；现状不能作为“八阶段真实交付已经验证”的证明。

建议：机器可执行项关联实际执行记录、退出状态、输入版本和输出证据；客户验收、授权和责任移交关联明确人工确认及证据；数据层保留联调性质，不将其计为真实交付证明。无需新增演示模式、第二套状态链或案例特判，历史数据也不应擅自删除或改写。

## A3 · 高优先级：消费图谱会使第四阶段已通过的决定失效

位置：`packages/fde/semantica/src/tools.ts:21`、`packages/fde/semantica/src/state.ts:856`、`:889`。

`semantic_context_query` 调用 `createAgentContext`，后者不仅查询，还把 slice 标成 stale、route.conclusion 改成 pending，并通过 replaceState 重写第四阶段状态。查询记录参与总证据摘要，导致已有 Go 决定失效。模型工具没有区分“第四阶段验证用查询”和“后续开发/运行中的消费查询”。

实际复现：只复制四份语义/阶段文件到临时目录，执行现有 Python Bridge 的只读子图查询。查询前为 `slice=succeeded, conclusion=validated, decisionCurrent=true`；返回 4 个实体后变为 `slice=stale, conclusion=pending, decisionCurrent=false`，第四阶段文件为 working。

没有修改图谱、Schema 或客户原件，也没有调用 Semantica SDK/模型。这是我们 Adapter 的状态副作用，不是图谱内容变化。

建议：分开构建/验证工作区与已发布查询版本。正常消费可记录日志，但不应因查询本身撤销方案结论；真正改变 Schema、输入材料或构建版本时才重新验证。

## A4 · 高优先级：部分本体规则可编辑，但没有成为执行约束

位置：`packages/fde/semantica/python/bridge.py:149`、`:329`、`:342`，`packages/client/ui-fde-project/src/client/StageWorkbench.tsx:499`。

- 页面可设置 identityKeys，但抽取实体 ID 仍只用类型和名称；同类型同名不同身份的实体可能合并，属性以后写覆盖先写。
- 发布会生成 Ontology/SHACL；图谱验证传给 GraphValidator 的 Schema 只有实体/关系类型列表，没有把当前编辑的必填、唯一性、关系基数等约束作为完整实例校验输入，也没有在该验证步骤执行生成的 SHACL。
- 来源和时间规则进入上下文时主要是文字说明；有效期字段被保留，但查询不按有效时间过滤。
- `permissionScope` 被附在上下文里，不等于按任务/调用者执行了权限过滤。

实际复现：纯 Python 调用现有 `_context`，输入一条已于 2020 年过期的事实，规则写明不得返回过期政策，查询仍返回该实体；规则只是原样出现在 constraints 中。

建议：明确区分“描述性规则”与“已执行校验的约束”。先使身份键和项目实际需要的约束生效，再逐项扩充；未支持的能力不能在界面或文档中被当作已经强制执行。这里不据此断言 Semantica 上游缺少能力，问题在当前 Adapter 调用链。

## A5 · 中优先级：抽取与查询比界面给人的能力预期窄

位置：`packages/fde/semantica/python/bridge.py:147`、`:184`、`:204`、`:225`、`:318`、`:342`，`packages/fde/semantica/src/tools.ts:24`。

- NER 调用固定为 pattern 方法；关系抽取仅遍历项目提供的 extractionPatterns。不是自动选择多种模型的通用文档理解管线，换行业/语言后可能没有合适候选。
- 自定义规则抽取的实体置信度固定 0.82、关系固定 0.78，不是逐条事实实际计算出的可靠度。
- 能力问题的通过主要看 lookup/edge/path 的结果数量达到 minAnswers，不能替代正确答案、反例、时间与业务约束验证。
- 自由文本 query 是保存的任务说明，不参与检索。真正选择由 questionId 或 seedNodeId 决定；工具却允许两者都省略。

实际复现：同一 questionId 输入两个完全不同 query 得到相同内容；只传 query 不传 ID 得到空实体集合。HTTP 入口会要求选择问题/节点，但 Agent 工具的可选参数合同没有同样约束。

建议：将当前能力如实呈现为“规则抽取＋按已定义问题/节点查询”；要支持任意材料理解时，再按批准范围接入可配置抽取方法。固定规则分数与模型/验证置信度应区分；不要为新项目偷偷代填规则或使用维修项目的现成 Schema。

## A6 · 中优先级：旧六阶段操作与八阶段状态仍可交叉

位置：`packages/fde/stage/src/index.ts:688`、`packages/fde/stage/src/http.ts:462`、`packages/fde/stage/src/state.ts:252`。

旧阶段完成 HTTP 入口仍注册，旧 transition 只检查 currentStage，不拒绝 lifecycleVersion=2，再用 LEGACY_TO_V2 推导新阶段。状态层复现：一个 V2 definition 项目调用旧 completeSolution，会直接进入 design，跳过 investigation。旧 HTTP 路径会先要求旧版五份产物和已确认架构，不能把状态层复现描述成任意空项目无条件经 HTTP 跳级。

这是版本流程交叉，不是维修案例写死；V2 正常工作台的逐阶段入口仍有自己的检查。但兼容入口如果被旧客户端或调用者使用，不应变成旁路。

建议：按生命周期版本明确接收哪种操作；保留旧项目合法入口，同时阻止 V2 项目误走旧操作。不要通过全删旧入口破坏存量项目。

## A7 · 低优先级：介绍页与方法说明保留固定案例

位置：`packages/client/ui-fde-project/src/client/DeliveryHomepage.tsx:31`、`:213`，`packages/fde/stage/src/index.ts:330`。

介绍页的示意窗口固定“售后工单交付”、周明、12 次访谈、15 个案例、92% 准确率、固定进度等；阶段一方法说明有三批维修项目材料例子。前者是产品介绍用示意组件，后者位于方法目录的 example，不是实际阶段数据或 Skill 必须产出的答案。

没有发现它们被用于初始化新项目、计算实际指标或强制构建维修图谱。应避免“证据实时同步”等文案让固定示意被误读为当前项目事实；如调整，仅调整示意表达，不删除用户明确要求保留的项目素材。

## 其他已观察到的边界

- 启动/关闭、架构和业务测试没有硬编码 `backend/server.mjs`、4177 或门店项目名；通用运行工具读取项目并由当前会话报告 URL。但 running 状态本质上是 Agent 的操作报告，Host 不在 reportProjectRuntime 中独立探测服务；不是持续健康监测保证。
- Semantica 模型工具目前只有上下文查询和切片上报；材料绑定、定义编辑、候选审核、构建等走工作台 HTTP 操作。“有 Skills”不等于 Agent 已有完整受控工具管线。
- 项目资料解析、Schema/状态格式、候选与可视图谱数量有显式上限。这是版本能力边界，不是按当前案例的节点数定制。
- 本轮没有逐条重放第一至五阶段历史 Session，不能把现有全部产物归因为真实 Harness 工具执行；可以确认其读取位置与部分实际测试证据，不能证明所有自然语言结论的真实性。

## 实际验证记录

### 定向套件

在 `upstream/deepseek-harness/` 执行：

```sh
env -u FDE_SEMANTICA_TEST_PYTHON corepack pnpm exec vitest run \
  packages/fde/stage/tests/stage.spec.ts \
  packages/fde/source/tests/sources.spec.ts \
  packages/fde/source/tests/upload.spec.ts \
  packages/fde/project/tests/project.spec.ts \
  packages/fde/project/tests/evaluation-workbench.spec.ts \
  packages/fde/project/tests/delivery-workbench.spec.ts \
  packages/fde/semantica/tests/semantica.spec.ts \
  packages/fde/semantica/tests/routes.spec.ts \
  packages/client/ui-fde-project/tests/controller.client.spec.ts \
  packages/client/ui-fde-project/tests/knowledge-graph-layout.client.spec.ts \
  packages/client/ui-fde-project/tests/stage-controller.client.spec.ts
```

退出 1：11 文件中 10 通过、1 失败；111 项通过、1 失败、1 跳过。

失败为 `controller.client.spec.ts:154`：测试期望切换项目时取消另一项目请求，当前控制器使用 Workspace-keyed 并行请求，未取消其他项目请求。源码仍校验响应 Workspace ID 并按键发布；本次失败本身不是串项目数据的证明，需要对齐预加载行为与测试约定，不在本轮顺带修改。

跳过为真实 Semantica SDK 运行集成用例，本轮明确不使用外部模型/既有私密运行配置。未把 keyless 检查当成完整 SDK 或真实客户验收。

### 临时诊断

使用 `node --import tsx/esm --input-type=module` 调用当前源码读取函数与状态函数；使用 `python3 -B` + runpy 调用当前 Bridge 的纯查询函数。结果：

| 输入 | 实际结果 |
| --- | --- |
| 全新空项目 | runtime stopped、architecture null，八阶段均不可评审，无案例数据自动填充 |
| 第二阶段三份空文件＋完成声明 | reviewReady=true |
| 第三阶段三份空文件＋五个空数组＋完成声明 | reviewReady=true |
| 第五阶段未执行证据＋声明 PASS＋当前指纹 | PASS，reviewBlockers=[] |
| 当前项目第六至八阶段联调输入 | 均 reviewReady=true |
| V2 definition 调旧状态转换函数 | 进入 design，跳过 investigation |
| 有过期时间的政策＋禁止过期规则 | 仍返回过期事实 |
| 相同问题 ID、不同 query | 返回相同结果 |
| query 无问题 ID/节点 ID | 返回空集合 |
| 临时副本已通过图谱的一次消费查询 | 返回 4 实体，但 slice stale、结论 pending、原 Go 失效 |

临时目录只用于本轮诊断，执行结束已删除，可按上述输入重建。没有持久化新服务、安装依赖、修改业务数据、改变真实阶段或操作其他 worktree。唯一仓库改动为本审计报告。

## 建议整改顺序与验收

1. 优先处理 A1/A2：明确证据状态与人工决定；空文件、未执行记录、联调输入不能被解释为真实交付通过。机器检查关联实际执行；外部事实保留明确人工确认。
2. 处理 A3：普通图谱消费不再撤销第四阶段成果；修改构建输入才使相关验证失效。
3. 处理 A4/A5：项目身份与约束实际生效，未支持的规则如实说明；抽取/查询能力与工具参数匹配。
4. 处理 A6/A7：隔离旧新流程入口并澄清固定示意，保留有效存量项目路径。
5. 用两个完全不同领域的独立测试项目验收通用性：一个普通 Schema 路线，一个本体路线。它们必须使用独立资料、Schema、指标与记录；测试不仅检查能出页面，还要检查未执行不能通过、项目切换不串数据、后续消费不破坏已确认成果。

以上为建议，尚未修改产品规格或实现。无需推翻八阶段模型，也无需为维修案例继续增加专用逻辑。

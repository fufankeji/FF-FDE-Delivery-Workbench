# @deepseek-ai/dsh-fde-semantica

[English](README.md) | 中文

FDE 项目第四阶段使用的 Workspace 隔离式 Semantica 集成。本包把机制选择、语义定义、知识候选、图谱构建、独立验证、有边界的 Agent 上下文、纵向切片证据和 FDE 决定保留为相互独立的事实。它不会替 FDE 选择本体路线、放行抽取候选、宣称业务任务已经运行，也不会自行推进阶段。

## 第四阶段合同

工作台先记录两项彼此独立的选择：系统如何完成工作，以及普通数据／接口 Schema 是否已经足够。简单路线沿开发 Spec 和一条真实纵向切片推进，不创建本体或图谱占位。正式本体路线增加两个循环：先发布最小语义定义，再针对该精确版本构建并验证项目图谱，验证通过后 Agent 才能查询。

本体工作状态保存在 `.fde/design/semantica/`；渲染器只读取经过校验的当前项目快照 `.fde/design/knowledge-graph.json`。内容摘要把所选路线、绑定材料版本、定义、候选决定、Provider 运行、图谱修订、验证回执、有边界上下文、纵向切片和 FDE 决定绑定在一起。任何受治理证据发生变化，依赖结果和原人工决定都会进入待重评，而不是继续显示为完成。

最终机制结论只能是 `not_required`、`validated`、`validation_failed` 或 `insufficient_evidence`。该结论与 FDE 的 `Go`、`Revise`、`Narrow`、`Stop` 决定彼此独立。只有当前有效的 `Go` 才能调用既有阶段推进门禁。

## Semantica 运行时边界

Host Adapter 面向 Semantica `0.6.7`。通过 Web App Loader 环境配置一份本地安装；代码不硬编码任何机器路径，也不打包 Semantica 源码、虚拟环境、全局图谱或演示数据。

```yaml
pythonCommand: !!js process.env.FDE_SEMANTICA_PYTHON ?? 'python3'
semanticaSource: !!js process.env.FDE_SEMANTICA_SOURCE ?? ''
operationTimeoutMs: 60000
maxSourceBytes: 2097152
maxSources: 12
```

随包 Python Bridge 使用 Semantica SDK 完成 Provider 健康检查、抽取、本体建议与校验、图谱构建和图谱验证；有边界任务查询由 Adapter 在该图谱上执行。每项操作都必须显式触发并分别记录。进程成功退出不会被解释为 Schema 质量合格、图谱有效或纵向切片成功。

当前规则管线不需要模型 API Key。运行真实 SDK 集成测试时，将 `FDE_SEMANTICA_TEST_PYTHON` 指向可导入 Semantica `0.6.7` 的解释器，否则这些测试会跳过。该测试变量不改变 Web 服务的运行配置；后者使用 `FDE_SEMANTICA_PYTHON`。仅提供模型密钥不会自动启用 Adapter 的大模型抽取。

```sh
FDE_SEMANTICA_TEST_PYTHON=/path/to/semantica/.venv/bin/python \
  corepack pnpm exec vitest run packages/fde/semantica/tests/semantica.spec.ts \
  packages/fde/semantica/tests/sdk-generality.spec.ts -t 'real.*SDK'
```

## 项目数据与操作

只能绑定当前已注册 Workspace 中已经建立索引并在本地完成解析的 Source。每次绑定都会固定材料 ID、摘要、本地内容引用、权威级别和项目专属权限范围；源文件字节变化后必须重新绑定。候选实体和关系在人工明确接受或拒绝前始终保持待审核。

可编辑定义包括能力问题、类、别名、身份键、带类型属性、来源字段映射、包含 Domain／Range 与基数的关系、抽取 Pattern、来源规则、时间规则、置信度阈值和 SHACL 严重级别。发布动作会先执行结构校验并写入版本化 Ontology 与 SHACL，之后才开放图谱构建。

| 同源操作 | 用途 |
| --- | --- |
| `/api/fde-semantica/route` | 保存执行机制和语义基础选择。 |
| `/api/fde-semantica/sources` | 绑定有版本的项目 Source 及其获准用途。 |
| `/api/fde-semantica/definition` | 保存一个精确的可编辑 Ontology 定义修订。 |
| `/api/fde-semantica/candidates` | 应用有数量边界的人工接受或拒绝决定。 |
| `/api/fde-semantica/run` | 显式执行一次健康检查、抽取、建议、发布、构建、验证或上下文步骤。 |
| `/api/fde-semantica/slice/report` | 保存已执行切片的真实结果和项目证据。 |
| `/api/fde-semantica/decision` | 保存绑定当前版本的 FDE 决定，不与 Provider 结果混淆。 |

所有操作都要求可信本机请求、已存在的 WorkspaceId 和有界 JSON。路径只在已注册项目内解析，写入采用原子方式；会影响人工决定的操作还会拒绝过期浏览器修订，避免覆盖较新的证据。

## Agent 集成

本包注册两个稳定的模型工具。`semantic_context_query` 默认只读消费，不改变第四阶段文件、切片与 FDE 决定，返回结果由 Harness 留痕；显式 `purpose=validation` 才生成编制验证上下文并使旧切片待重跑。`semantic_slice_report` 保存调用者报告的结果及非空项目内证据；它不执行任务、不独立认证声明，也不能提交 FDE 决定。

上下文操作要求选择已发布能力问题或精确起始实体，遍历最多三跳。`query` 只描述任务，不执行自由文本语义检索。绑定来源、置信度和已声明有效时间先于遍历过滤；文字规则与 `permissionScope` 是说明，不是已执行的授权政策。本体切片必须引用当前编制验证上下文 ID，而非普通消费查询 ID。

## 模型体验

### Semantica Agent 工具

#### 模型看到什么

两个固定工具 Schema：`semantic_context_query` 和 `semantic_slice_report`。路线选择、材料绑定、Schema 编辑、候选审核、构建、验证和 FDE 决定仍是受信工作台操作，不暴露为模型工具。

#### Token 影响

能看到全局工具注册表的请求会增加两个固定 Schema 的输入 Token。项目图谱内容只通过一次有边界查询结果进入上下文；纵向切片证据只通过显式报告结果进入。

#### KV 缓存影响

工具 Schema 在不同项目和请求之间保持稳定。项目专属问题、图谱事实、修订和证据只会在工具调用后改变普通对话后缀。

## 已知限制与延期工作

- 当前 Adapter 使用 Pattern NER 与项目关系规则，不自动选择模型。实体规则分数 0.82、关系规则分数 0.78 是启发式分数，不是校准后的事实可信度。身份键决定对象身份，缺身份或关系端点歧义不静默合并，属性冲突保留独立候选供人工处理。
- 独立图谱验证在 SDK 类型检查之外执行支持的项目字段类型、必填／唯一、身份键、Domain／Range、基数、来源及时间结构检查。生成 SHACL 不代表执行全部 SHACL 语义；能力问题的结果数量只证明可检索性，不证明业务答案正确。旧验证记录须重新验证以取得 project-constraints-v1 回执，原图谱及阶段历史不被改写。
- Semantica 当前提供的是一组有效 SDK 模块，而不是一个能够把任意文档可靠变为生产图谱的一键操作。本 Adapter 会显式编排并验证每一步，不依赖单一 build 端点。
- 本包不执行项目业务切片。可见 Agent 或 FDE 负责真实运行任务，之后再提交项目内证据。
- `Stop` 会记录当前第四阶段决定，并让项目留在第四阶段；独立的项目生命周期停止或归档操作目前尚未定义。
- 三维 Explorer 是有界检查界面，不是 Ontology 编辑器，也不是图谱有效性的证明。只有当前项目存在非空且已验证的图谱快照时才会出现。

# Semantica Agent 接入验证

日期：2026-09-08。仓库：`FDEDeliveryWorkbench` 主工作树 `main`；基线：`d26509afef4d724d0c792a62717329608c51cb52`。本轮未提交或推送 Git。

## 范围与结论

对应 REQ-014、REQ-028，PSC-013、PSC-023，以及 F008 的 T012、T013。补全 Agent 与工作台共用的项目级 Semantica 操作，恢复本机运行配置，并验证后续项目开发能够只读使用当前有效图谱。没有更换图谱渲染器、修改示例项目或自动推进阶段。

- 新工具 `semantic_workspace` 支持检查、运行环境检查、绑定来源、编辑定义草稿、抽取候选、建议 Schema、构建和验证；检查支持分页查看材料和候选。
- 沿用现有 Provider 的项目隔离、版本与证据失效规则。定义输入必须符合现有合同，不能提交发布状态、摘要或系统修订号。
- 机制选择、候选接受／拒绝、Schema 发布和 FDE 决定不作为 Agent 工具操作开放，仍由工作台人工确认。
- 后续 `semantic_context_query(purpose=consume)` 核对来源版本、验证版本及实际 SDK 版本，只读返回有限实体、关系和来源；不会替换第四阶段验证上下文或撤销人工决定。显式重建／重验仍会使相关旧证据失效。
- 阶段 Skill 指向真实工具，禁止直接修改 Provider JSON 冒充运行结果。

## 运行条件

- 复用本机已有 Semantica `0.6.7`；源码提交 `3acf8012733ec6a1b07508660fe69c1e58e70242`，没有更新 SDK 或安装模型。
- 测试解释器：`/Volumes/SemanticaRuntime/semantica/.venv/bin/python`。该绝对路径仅是本次运行证据，不进入产品默认值。
- 测试使用 `HF_HUB_OFFLINE=1`、`TRANSFORMERS_OFFLINE=1`、`PYTHONDONTWRITEBYTECODE=1`；没有读取凭证、调用计费模型或写入客户外部系统。
- 材料和图谱在临时隔离目录中生成；新增工具组合测试在结束后清理其目录。Loader 会持久化显式插件停用，因此组合测试先把配置复制到临时目录，避免测试污染源夹具。

## 最窄检查

以下命令在 `upstream/deepseek-harness/` 执行。本轮分批运行；只按各文件最后有效结果计数，重跑不增加覆盖数。

| 文件／检查 | 最终结果 | 证明范围 |
| --- | --- | --- |
| `semantica/tests/semantica.spec.ts` | 5 项通过 | 真实 SDK 构建、验证与带来源的系统责任查询；消费前后文件不变，重抽取后旧验证不可再消费 |
| `semantica/tests/sdk-generality.spec.ts` | 1 项通过 | 出版领域真实 SDK 抽取及项目约束，不依赖门店案例 |
| `semantica/tests/context-consumption.spec.ts` | 1 项通过 | 普通消费不修改设计文件；显式验证上下文使旧切片失效 |
| `semantica/tests/definition.spec.ts` | 1 项通过 | 拒绝系统元数据注入与不符合合同的定义类型 |
| `semantica/tests/routes.spec.ts` | 6 项通过 | 既有路线、阶段与人工决定边界 |
| `semantica/tests/tools-composition.spec.ts` | 2 项通过 | 实际 Loader／ToolRuntime 装载与卸载；无路线拒绝、人工操作拒绝、真实 SDK 工具流程、跨项目及来源变更拒绝 |
| `stage/tests/stage.spec.ts` | 26 项通过 | 阶段操作及新增工具指引的直接回归 |
| 合计 | 42 项通过 | 包含上述真实 SDK 分支，没有以跳过计为通过 |

实际 SDK 测试命令如下（按验证范围列出，不代表各批次首次全部通过；最终结果见上表）：

```sh
FDE_SEMANTICA_TEST_PYTHON=/Volumes/SemanticaRuntime/semantica/.venv/bin/python \
PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
corepack pnpm exec vitest run \
  packages/fde/semantica/tests/semantica.spec.ts \
  packages/fde/semantica/tests/sdk-generality.spec.ts \
  packages/fde/semantica/tests/context-consumption.spec.ts \
  packages/fde/semantica/tests/definition.spec.ts \
  packages/fde/semantica/tests/routes.spec.ts

FDE_SEMANTICA_TEST_PYTHON=/Volumes/SemanticaRuntime/semantica/.venv/bin/python \
PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
corepack pnpm exec vitest run \
  packages/fde/semantica/tests/tools-composition.spec.ts \
  packages/fde/stage/tests/stage.spec.ts

FDE_SEMANTICA_TEST_PYTHON=/Volumes/SemanticaRuntime/semantica/.venv/bin/python \
PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
corepack pnpm exec vitest run \
  packages/fde/semantica/tests/semantica.spec.ts \
  packages/fde/semantica/tests/tools-composition.spec.ts
```

中间失败来自新增测试断言放置位置和 Loader 停用时写回测试配置，修正后定向复跑通过；没有以失败批次宣称一次性全绿。

真实组合测试直接调用 ToolRuntime，使用实际 Session、Workspace 和已构建的 Semantica 插件；不是模拟模型回复，也没有执行 LLM 对话轮次。出版资料经绑定、保存定义、抽取，在测试人员通过人工所属操作确认后构建和验证，查询结果得到作者 `Lin`、作品 `Research` 及一个实际 SourceId；保存的 FDE 决定仍为空。另一个系统责任领域验证了消费时既有人工决定不被改写。

编译与静态检查均退出 0：

```sh
corepack pnpm exec tsc -b packages/fde/semantica packages/fde/stage
corepack pnpm exec tsdown --filter @deepseek-ai/dsh-fde-semantica --filter @deepseek-ai/dsh-fde-stage
corepack pnpm exec oxlint \
  packages/fde/semantica/src/definition.ts \
  packages/fde/semantica/src/tools.ts \
  packages/fde/semantica/tests/fixtures/driver.ts \
  packages/fde/semantica/tests/tools-composition.spec.ts \
  packages/fde/semantica/tests/definition.spec.ts
```

PRD、Product Spec 与 F008 的相应规格检查通过；受影响的包 README 和 Agent Note 双语对照检查通过。没有修改客户端源码，因此没有重复构建客户端或执行浏览器回放。

## 本机配置与 3080

- 新增被 Git 忽略的 `.runtime/dsh-home/.env`，只记录 `FDE_SEMANTICA_PYTHON` 和 `FDE_SEMANTICA_SOURCE`，没有凭证。启动说明使用可替换路径，不把本机路径写入默认代码。
- 通过现有 `loadLayeredEnv` 从该隔离目录读取配置，再运行已构建 Bridge 的真实 `health` 操作，结果为 `{"version":"0.6.7"}`。该检查不改项目内的历史 Provider 记录。
- 仅重启主工作树 3080，最终监听 PID `68699`，工作目录为 canonical 仓库下 Harness，显式 `DSH_HOME=../../.runtime/dsh-home`。主页返回 HTTP 200；没有操作 3081。

```sh
DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

前后相同的 SHA-256：

| 文件 | 摘要 |
| --- | --- |
| 现有项目 `.fde/design/semantica/workspace.json` | `23c7f95f88c322b0adfb42cb91d076da7b0216b2b46b55a4ca7d8e18972d42b0` |
| 现有项目 `.fde/design/knowledge-graph.json` | `960a8b029c76ccb9c50d38c2ab1aa6f9852c1df3e781d6356e692fef6f4adec2` |
| 隔离运行区 `storages/workspace.json` | `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9` |

原三个登记项目保持不变，没有导入、替换或推进其中任何项目。已有 SDK 环境继续复用，构建输出仍在被忽略的 `lib/` 中；没有新增长期工作树、备份或模型副本。

## 人工验收与剩余边界

1. 在 3080 的当前项目 Agent 对话中，可先说：“调用 semantic_workspace 检查当前项目，告诉我已有材料、本体定义、候选知识、验证状态，以及下一步需要我确认什么。”该检查不改项目。
2. 本机原项目历史验证缺少 `project-constraints-v1` 检查版本，不能自动视为符合新规则。本轮保留历史；重新验证可能使旧切片和决定依据需要重评，必须由用户明确开始，不能为了显示通过修改 JSON。
3. 当前适配器继续使用明确的规则抽取及有限图查询，不等于接通任意文档自动理解、向量检索、原生 AgentContext 或完整 OWL／SHACL 推理服务。此轮没有扩大这些能力声明。
4. 人工操作 UI、真实模型是否按提示依次使用工具以及客户任务答案正确性仍待用户验收。Loader／SDK 测试、构建和 HTTP 200 不替代这些结论。

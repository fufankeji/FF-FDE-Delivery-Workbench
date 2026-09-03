---
document: fde-open-source-skills-integration-study
status: current-audit
updated: "2026-09-03"
product_revision: 7e5c42633284a200e7699fb8995b6833d348cd07
method_source: davidahmann/fde-guide@060ef0f3b67743b2e1fc3705763d423eae980236
engineering_source: rpraharaj/forward-deployed-engineer@ee045a66db5242617ccea9e5e33139a2980ab55e
---

# 两个 FDE 开源 Skill 项目与八阶段集成研究记录

## 1. 结论

`FF - FDE 交付工作台` 对两个开源项目的组合不是“把 54 个 Skill 全量安装后让 Agent 自由挑选”，而是三层分工：

1. `davidahmann/fde-guide` 提供业务方法、Artifact、证据要求和决策门，回答“为什么做、要形成什么、什么证据足以请求下一项决定”。
2. `rpraharaj/forward-deployed-engineer` 提供现场工程程序，回答“怎样调查、设计、实施、验证、发布、观察和交接”。
3. `FF - FDE 交付工作台` 把两类能力固定到八阶段，翻译为用户能理解的业务动作，约束输入、固定产物、状态文件和人工阶段门；DeepSeek Harness 提供 Skill 注册、Session、工具执行和审计能力。

最核心的组合公式是：

```text
用户目标与当前阶段
→ 读取上一阶段已确认 Artifact、当前资料和事实缺口
→ 先选 fde-guide 方法 Skill，确定工作目标、证据与决策条件
→ 再按缺口选最少的工程 Skill，完成调查或工程动作
→ 用 DeepSeek Harness 工具真实执行
→ 将结果写回固定 Artifact 和阶段状态
→ 由 FDE 人工做 Go / Revise / Narrow / Stop 决定
```

Skill 只能生成或更新候选结果，不能授予权限、证明未执行的外部动作、替客户确认事实，也不能自行推进项目阶段。

## 2. 本地研究快照

两个仓库已下载到本项目被 Git 忽略的本地参考区，不会进入产品源码提交：

| 项目 | 本地路径 | 固定版本 | 许可证 | 规模 |
|---|---|---|---|---|
| [`davidahmann/fde-guide`](https://github.com/davidahmann/fde-guide) | `.references/fde-skills/fde-guide/` | `v1.29.0` / `060ef0f3b67743b2e1fc3705763d423eae980236` | Apache-2.0 | 11 个方法 Skills；本地约 5.8 MiB |
| [`rpraharaj/forward-deployed-engineer`](https://github.com/rpraharaj/forward-deployed-engineer) | `.references/fde-skills/forward-deployed-engineer/` | `ee045a66db5242617ccea9e5e33139a2980ab55e` | MIT | 43 个工程 Skills；本地约 1.3 MiB |

两个 checkout 都处于 detached HEAD，目的是保证学习内容与产品记录的来源 commit 完全一致。GitHub 是来源真值；本地目录是可再生研究副本。研究结束且不再需要离线阅读时，可以删除整个 `.references/fde-skills/`；以后按上述 URL 和 commit 重新克隆即可恢复。

这些本地副本不参与产品运行。当前产品运行时使用的是 `packages/fde/stage` 中已经提取、缩写、中文化并绑定产品合同的 Adapter 内容；逐项语义和许可审查是否完整，仍应以对应 Feature 的完成证据为准。

## 3. 两个项目各自解决什么问题

### 3.1 `fde-guide`：控制业务方向与证据门

该项目的中心思想是：从真实工作与被接受的业务结果开始，而不是从模型、Agent 或框架开始。它要求先观察现实流程，分开记录 `sold`、`stated`、`observed`、`system_enforced` 和 `policy_authorized`，再定义 owner、verifier、基线、价值、风险上限和停止条件。

它的 11 个 Skill 覆盖：

| 生命周期责任 | Skill |
|---|---|
| 现场发现与重新界定 | `qualify-ai-workflow`、`reframe-ai-engagement` |
| 价值与机制选择 | `engineer-ai-value`、`select-ai-mechanism` |
| 生产级设计与动作边界 | `design-production-ai-system`、`secure-ai-action-boundary` |
| 评估与生产就绪 | `build-ai-evaluation`、`review-ai-production-readiness` |
| 生产运营、交接与复用 | `operate-ai-service`、`transfer-ai-service`、`productize-field-learning` |

它不仅提供 Skill，还提供 Workflow Charter、Value Case、Data Context Manifest、Tool Contract、Evaluation Report、Production Readiness、Handoff 等模板、Schema、Control 和完整案例。因此本项目主要把它当作“方法与 Artifact 合同来源”。

### 3.2 `forward-deployed-engineer`：控制现场工程动作质量

该项目的中心思想是：把资深 FDE 在陌生组织和陌生代码库中的工作程序固化为可组合 Skill，并让发现结果沉淀为持久 Artifact，而不是只留在聊天记录里。

它的三条工作纪律是：

- Artifact 优先：每个 Skill 读取上游 Artifact 并产生下游 Artifact，减少跨 Session 重复推导。
- 证据或置信度标签：结论必须有代码、命令、系统读回或访谈来源，否则标记为 confirmed、inferred 或 unverified 中的真实状态。
- 按现场类型组合：先识别 brownfield、integration、migration、rescue、data、COTS 等任务类型，再安装或加载必要 Pack，不让 43 个 Skill 同时污染上下文。

43 个 Skill 分为 5 个 Pack：`fde-core` 30 个，`fde-data`、`fde-migration`、`fde-platform`、`fde-operate` 各 3～4 个。它们主要提供调查、代码、数据、测试、发布、运维和交接动作，不负责替客户定义业务价值或批准阶段。

## 4. 当前产品是怎样集成的

### 4.1 固定来源，不追随网络最新版

运行时代码把两个来源 commit 写成常量。上游升级必须作为独立变更重新审查，不能让网络最新版自动改变生产行为。

### 4.2 使用 Adapter，不直接远程执行外部仓库

产品没有在运行时读取 `.references/`，也没有将两个仓库的全部 `SKILL.md` 原文塞入上下文。当前做法是：保留上游 Skill 名称和来源，提取适合本产品阶段的核心程序，改写为中文业务说明、使用条件、固定产物和安全边界，再注册为 DeepSeek Harness Skill。

这意味着产品 Skill 与上游之间是“来源可追溯的适配关系”，不是逐字镜像关系。若要判断某项语义有没有被正确保留，应同时阅读上游 `SKILL.md` 与本项目 Adapter，而不能只看名称相同。

### 4.3 注册、目录和系统提示三件事分开

- Host 启动时通过 `ctx.skills.register(...)` 注册可用 Skill。
- `/api/fde-stage/skills` 返回当前阶段的业务化方法目录、用途、使用条件、来源和完整 Adapter 内容。
- 当前 Session 的系统提示只注入当前阶段与最小路由规则；真正需要某项工作时再加载相应 Skill 正文。

因此“在目录里看得到”不等于“每轮都加载”，而“已经注册”也不等于“已经真实执行并形成证据”。

### 4.4 Artifact 与阶段状态共同收口

阶段 2～8 的 Adapter 统一要求：

- 只维护每阶段声明的固定产物，不创建 `final`、`new`、`v2` 等平行最终稿；
- 同时维护 `.fde/stages/<stage>.json`；
- 区分 `working`、`blocked`、`review-ready`；
- 显式记录工作项、阻塞和 `pending/go/revise/narrow/stop` 建议；
- 固定产物齐备且不存在未解决的 high/critical 阻塞，才可建议进入人工评审；
- 只有 FDE 人工阶段门能推进或返回阶段。

阶段 1 使用更细的逐条证据合同：`.fde/discovery/workflows.json` 保存候选工作流和 evidenceRefs，`.fde/discovery/artifacts.json` 保存 Artifact 来源、版本、结构成熟度、证据状态和上下游引用。

## 5. 八阶段实际运行时映射

下表以当前 `packages/fde/stage/src/index.ts` 与 `v2-skills.ts` 为准。`核心`表示正常完成本阶段需要的工作，`条件`表示只有出现对应事实缺口或项目类型时才使用。

### 阶段 1：发现高价值问题

| 来源 | 当前 Skill | 使用方式 |
|---|---|---|
| `fde-guide` | `qualify-ai-workflow` | 方法核心：把模糊诉求还原成有 owner、verifier、基线、边界、回退和停止条件的候选工作流。 |
| `fde-guide` | `reframe-ai-engagement` | 条件方法：现场事实推翻原简报、边界或成功标准时，保留历史并请求有权人处置。 |
| 工程仓 | `fde-orient`、`knowledge-interview`、`ownership-map`、`repo-recon`、`stakeholder-brief` | 按缺口分别完成项目定向、访谈、责任映射、代码库勘察和负责人简报，不一次加载全部。 |

集成思路：先证明“问题真实且值得继续”，不在第一阶段提前设计技术方案。方法仓决定观察什么、怎样区分冲突说法、何时可以形成候选；工程仓负责把访谈、责任、系统和代码事实找出来。

固定结果：

- `fde-deliverables/01-requirement-research/requirement-research-report.md`
- `fde-deliverables/01-requirement-research/confirmation-checklist.md`
- `fde-deliverables/01-requirement-research/requirement-baseline.md`
- 条件产物 `fde-deliverables/01-requirement-research/engagement-reframe.md`
- `.fde/discovery/workflows.json`
- `.fde/discovery/artifacts.json`

### 阶段 2：定义结果、范围与责任

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| `fde-guide` | `engineer-ai-value` | 核心 |
| 工程仓 | `requirements-to-spec`、`feasibility-probe`、`estimation`、`delivery-plan` | 核心 |
| `fde-guide` | `qualify-ai-workflow`、`reframe-ai-engagement` | 条件回退／重新界定 |
| 工程仓 | `stakeholder-brief`、`escalation-and-renegotiation` | 条件决策／重谈 |

集成思路：方法仓先把“业务结果值不值得投入”变成可测量的价值合同；工程仓再把结果转成可验收要求，用真实系统条件做可行性检查，最后给出带不确定性的估算和按风险排序的计划。范围、周期、资源不能同时成立时，不静默改范围，而是带证据重谈。

固定结果：`outcome-contract.md`、`value-case.md`、`delivery-plan.md`，状态为 `.fde/stages/definition.json`。

### 阶段 3：调查数据、系统、接口、安全与组织

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| `fde-guide` 派生 | `data-readiness-assessment`、`secure-ai-action-boundary` | 核心 |
| 工程仓 | `access-and-onboarding`、`trace-the-flow`、`data-archaeology` | 核心 |
| 工程仓 | `git-archaeology` | 条件 |
| 产品内置 | `governance-boundary-review` | 条件 |

集成思路：把“数据存在”“能登录”“文档说可以”拆成不同证据。方法仓负责判断数据是否适合当前业务决定，以及模型、工具和人员究竟能读什么、做什么；工程仓沿真实案例追系统链路、访问、数据口径和历史原因；产品内置方法把安全、隐私、法务与客户治理拆开，不让一种批准替代另一种。

注意：`data-readiness-assessment` 来源于 `fde-guide` 的模板、Playbook 和数据合同，但不是该仓 11 个可选 `SKILL.md` 之一；它是本产品从上游方法体系抽出的独立 Adapter。

固定结果：`data-readiness.md`、`system-access-map.md`、`governance-review.md`，状态为 `.fde/stages/investigation.json`。

### 阶段 4：设计方案并完成端到端纵向切片

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| `fde-guide` | `select-ai-mechanism`、`design-production-ai-system` | 核心 |
| 工程仓 | `solution-design`、`contract-design`、`nfr-baseline` | 核心 |
| 工程仓 | `safe-change`、`integration-adapter` | 条件 |

集成思路：先按每个业务决策点比较人工、规则、传统软件、ML、RAG、LLM 和 Agent，选能达到结果的最小机制；再把选定机制放入完整生产系统，补齐状态、接口、失败、恢复、人工复核和责任。工程仓负责 ADR、接口兼容、NFR，以及陌生系统或外部系统下的最小安全改动。

固定结果：`mechanism-selection.md`、`solution-design.md`、`vertical-slice-record.md`，状态为 `.fde/stages/design.json`。

### 阶段 5：运行 PoC 与 Eval

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| `fde-guide` | `build-ai-evaluation` | 核心 |
| 工程仓 | `verification-plan`、`test-data-strategy`、`nfr-validation` | 核心 |
| 工程仓 | `characterization-tests`、`security-compliance-check`、`ci-forensics` | 条件 |

集成思路：方法仓验证真实产品主张，而不是孤立模型答案；工程仓把每条验收条件映射到可复现证据，准备合规而真实形状的测试数据，并实测 NFR。遗留系统、安全敏感或 CI 异常时再加载条件 Skill。

固定结果：`evaluation-plan.md`、`evaluation-report.md`、`evaluation-baseline.md`，状态为 `.fde/stages/evaluation.json`。

### 阶段 6：完成企业集成、可靠性改造与受控试点

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| `fde-guide` | `review-ai-production-readiness` | 核心 |
| 产品内置 | `pilot-scope-and-authority`、`enterprise-integration-readiness`、`reliability-and-recovery`、`pilot-evidence-review` | 核心 |
| 工程仓 | `change-control-navigation`、`deploy-runbook` | 条件 |

集成思路：不因为 Eval 通过就直接进入生产。方法仓先审查一个精确候选版本的生产条件；产品内置方法把试点范围与授权、企业接入、可靠性恢复和试点证据固定成工作台责任；工程仓只在客户有变更流程或真实部署动作时补充审批与可执行回滚手册。

固定结果：`pilot-scope.md`、`pilot-runbook.md`、`pilot-report.md`，状态为 `.fde/stages/pilot.json`。

### 阶段 7：进入生产、推动采用并验收交接

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| `fde-guide` | `transfer-ai-service`、`operate-ai-service` | 核心 |
| 工程仓 | `release-readiness`、`post-deploy-watch`、`handover-pack`、`enablement-handoff` | 核心 |
| 工程仓 | `cutover-plan`、`decommission-plan` | 条件 |

集成思路：上线、采用、验收和交接是四件不同的事。方法仓要求客户团队实际证明能运行、变更、恢复和退役，并持续观察被接受的业务结果；工程仓负责发布证据、观察窗口、可取得交付包和接收团队实操。存在新旧系统切换或旧系统下线时，再使用不可逆状态迁移相关 Skill。

固定结果：`production-review.md`、`customer-acceptance.md`、`handover-record.md`，状态为 `.fde/stages/production.json`。

### 阶段 8：持续改进并沉淀可复用能力

| 来源 | 当前 Skill | 分组 |
|---|---|---|
| 产品内置 | `production-evidence-review`、`improvement-prioritization`、`improvement-validation` | 核心 |
| `fde-guide` | `productize-field-learning` | 核心 |
| 工程仓 | `incident-triage`、`observability-gap` | 条件 |
| 产品内置 | `improvement-release-control` | 条件 |

集成思路：先从生产结果、采用、事故、成本和反馈中选出有证据的问题，再复测改进；只有在多个独立现场证明可复用、并且剥离了客户数据、政策、阈值和偶然 workaround 后，才能沉淀为共享能力。事故与不可见故障是条件输入，改进发布仍需小范围、可观察、可回退。

固定结果：`field-learning-register.md`、`improvement-record.md`、`controlled-release-record.md`，状态为 `.fde/stages/improvement.json`。

## 6. 当前接入覆盖面

对当前运行时定义与两个固定上游快照做名称对账，结果是：

- `fde-guide` 的 11 个上游 Skill 名称都能在当前运行时定义中找到。
- 产品另外从 `fde-guide` 的模板与方法中派生了 `data-readiness-assessment`，所以当前有 12 个 `fde-guide` 来源标签的唯一 Skill 名称。
- 工程仓 43 个 Skill 中，当前运行时定义引用了 35 个。
- 当前没有引用的 8 个工程 Skill 是：`blast-radius`、`context-strategy`、`cots-configuration`、`data-pipeline-work`、`db-change-management`、`dependency-upgrade`、`env-bootstrap`、`refactor-seams`。
- 产品增加了 9 个 `bundled-v2` 方法：阶段 3 的 1 个治理方法、阶段 6 的 4 个试点方法、阶段 8 的 4 个改进方法。
- 八阶段目录共有 59 个展示位置；扣除阶段 1 与阶段 2 复用的 `qualify-ai-workflow`、`reframe-ai-engagement` 和 `stakeholder-brief`，对应 56 个唯一运行时 Skill 名称。

这组数字只证明“当前代码定义和注册了哪些 Adapter”，不证明这些能力都已经在真实客户项目中执行过。

## 7. 规划合同与当前运行时的差异

`docs/specs/skill-routing.md` 描述了较完整的目标路由，当前 `v2-skills.ts` 则是已经注册到运行时的较窄目录。两者目前不是完全一一对应：

- 阶段 3 的目标路由还列出 `context-strategy`、`env-bootstrap`、`repo-recon`、`ownership-map`、`blast-radius`、`security-compliance-check`；当前阶段目录没有这些项。
- 阶段 4 的目标路由还列出 `verification-plan`、`characterization-tests`、`test-data-strategy`，并允许 `refactor-seams`、`dependency-upgrade`、`db-change-management`、`data-pipeline-work`、`cots-configuration` 等条件能力；当前目录更窄。
- 阶段 6 的目标路由包含动作边界、交接、改动、适配、发布、上线观察、NFR 和安全能力；当前目录用 4 个产品内置试点方法收敛了大部分责任，只保留两个条件工程 Skill。
- 阶段 7 的目标路由还包含生产就绪复审、部署、变更审批、事故和可观测性能力；当前目录没有全部展示。
- 阶段 8 的目标路由还要求按条件复用 `operate-ai-service`、`engineer-ai-value`、`reframe-ai-engagement`、`stakeholder-brief`、`escalation-and-renegotiation`、`post-deploy-watch` 等跨阶段能力；当前目录主要使用产品内置闭环加 `productize-field-learning`。

这些差异不能仅凭名称判断为缺陷：一部分是为了减少上下文和避免重复，一部分责任被产品内置方法收敛。但在宣称“两个开源项目已完整集成”之前，需要逐阶段决定：

1. 目标路由中的每项能力是继续保留为可条件调用但不展示，还是正式从该阶段合同移除；
2. 产品内置方法是组合上游程序的 Adapter，还是独立产品方法；
3. 每个 Adapter 是否已经完成许可证、语义、工具假设、固定产物和负向边界审查；
4. 是否有真实输入、真实工具结果、Artifact 和人工阶段门组成的端到端证据。

## 8. 当前成熟度判断

当前已经落地的部分：

- 两个来源版本固定；
- 八阶段 Skill 名称、中文业务名称、用途、条件和来源进入 Host；
- Skill 在 Host 启动时注册；
- 当前阶段通过系统提示限制最小加载；
- 阶段目录可以返回完整 Adapter 内容与来源；
- 阶段 1 有逐条 evidenceRefs 与 Artifact Catalog 合同；
- 阶段 2～8 有固定产物和状态文件合同；
- Agent 不能通过 Skill 自行推进阶段。

当前不能声称已经完成的部分：

- 不能声称两个外部仓库已原样安装或 54 个上游 Skill 全量启用；
- 不能声称 56 个当前 Adapter 都完成了真实项目端到端验证；
- Feature Map 中共享的 F001、F003、F004 仍为 `planned`，阶段 Feature 仍为 `in-progress`；
- 规划路由与运行时目录的差异尚未逐项形成最终产品决定；
- 代码注册、单元测试和文件存在不能替代真实客户证据、授权、生产动作或人工验收。

因此最准确的现状表述是：**两个开源方法体系已经被固定版本引用，并形成了八阶段的可运行 Adapter、目录和基础状态合同；完整语义审查、逐阶段真实执行闭环与最终验收仍在进行中。**

## 9. 建议的学习顺序

### 第一轮：先理解两套心智模型

1. `fde-guide/guide/fde-guide-in-five-minutes.md`
2. `fde-guide/README.md`
3. `forward-deployed-engineer/README.md`
4. `forward-deployed-engineer/USAGE.md`
5. `forward-deployed-engineer/DESIGN.md`

### 第二轮：沿八阶段阅读，而不是按 54 个目录逐个背

1. 阶段 1：`qualify-ai-workflow`、`reframe-ai-engagement`、`fde-orient`、`knowledge-interview`。
2. 阶段 2：`engineer-ai-value`、`requirements-to-spec`、`feasibility-probe`。
3. 阶段 3：`secure-ai-action-boundary`、`access-and-onboarding`、`trace-the-flow`、`data-archaeology`。
4. 阶段 4：`select-ai-mechanism`、`design-production-ai-system`、`solution-design`、`contract-design`。
5. 阶段 5：`build-ai-evaluation`、`verification-plan`、`test-data-strategy`、`nfr-validation`。
6. 阶段 6：`review-ai-production-readiness`、`change-control-navigation`、`deploy-runbook`。
7. 阶段 7：`transfer-ai-service`、`operate-ai-service`、`release-readiness`、`enablement-handoff`。
8. 阶段 8：`productize-field-learning`、`incident-triage`、`observability-gap`。

每读一个上游 Skill，立即对照本项目同名 Adapter，回答四个问题：保留了什么、删掉了什么、增加了什么产品合同、怎样证明它在当前阶段真实工作。这样比先通读 54 个 Skill 更容易理解集成设计。

用于实际走通八阶段的仿真案例、分阶段素材、提示词和执行台账，见 [`docs/case-studies/smart-maintenance-work-orders/README.md`](../case-studies/smart-maintenance-work-orders/README.md)。

## 10. 项目内证据入口

- 产品级路由合同：[`docs/specs/skill-routing.md`](../specs/skill-routing.md)
- Feature 总图：[`docs/specs/feature-map.md`](../specs/feature-map.md)
- 共享路由 Feature：[`docs/specs/F004-skill-artifact-evidence/spec.md`](../specs/F004-skill-artifact-evidence/spec.md)
- 阶段 1 Adapter 方案：[`docs/specs/F005-discover-value/plan.md`](../specs/F005-discover-value/plan.md)
- 阶段 1 来源、路由与 Artifact 校验：[`packages/fde/project/src/discovery-stage.ts`](../../upstream/deepseek-harness/packages/fde/project/src/discovery-stage.ts)
- 八阶段 Skill 定义、固定产物与系统提示：[`packages/fde/stage/src/v2-skills.ts`](../../upstream/deepseek-harness/packages/fde/stage/src/v2-skills.ts)
- Skill 注册与阶段目录：[`packages/fde/stage/src/index.ts`](../../upstream/deepseek-harness/packages/fde/stage/src/index.ts)
- 路由与注册测试：[`packages/fde/stage/tests/stage.spec.ts`](../../upstream/deepseek-harness/packages/fde/stage/tests/stage.spec.ts)

## 11. 本次核对证据

- 两个本地 checkout 的 `git rev-parse HEAD` 分别等于文档声明的两个固定 commit。
- 文件统计确认 `fde-guide/.agents/skills/` 有 11 个 Skill 目录，工程仓有 43 个 `SKILL.md`。
- 名称交集对账确认当前运行时引用 35 个工程仓 Skill，另外 8 个未被当前定义引用。
- `corepack pnpm exec vitest run packages/fde/stage/tests/stage.spec.ts`：exit 0，1 个测试文件、22 项测试通过。
- `git check-ignore` 确认 `.references/` 已被忽略；`git diff --check` 通过。
- 本次没有修改运行时代码，没有启动浏览器，没有调用模型或付费服务。

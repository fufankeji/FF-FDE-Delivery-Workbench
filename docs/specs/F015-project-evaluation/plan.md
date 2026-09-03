---
document: feature-plan
feature: F015
status: ready
updated: "2026-08-27"
---

# F015 · 评估优化实施计划

## 现有上下文与复用

- 固定 `dsh-eval-harness@2f59376e2a2f22c151f75de446d5cde764dd5aff`。它通过 YAML 用例驱动真实 `dsh --profile headless` 子进程，读取 JSONL/Zstd Session Trace，支持工具/输出/Turn 等断言、重试、多 Trial、Token、Baseline 对比和 PASS/WARN/FAIL，公开仓库约 12 Stars；package 声明 MIT，但仓库缺少根 LICENSE，复用前保留来源并完成许可复核。
- `dsh-eval` 功能更丰富但关注度较低且面向 rc.6；Promptfoo/DeepEval/Langfuse 平台成熟但没有当前 DSH 原生运行适配。第一版优先选择 DSH 原生 Trace 证据，保留后续指标适配。
- F014 提供项目运行和 Trace 关联；F015 报告按 WorkspaceId 和候选版本持久化，不依赖外部 Langfuse 才成立。

## 影响范围

| 路径/模块 | 当前职责 | 计划变化 | 对应 AC |
|---|---|---|---|
| Web/Headless Profile 第三方依赖 | 无评估插件 | 固定并安装 `dsh-eval-harness`，保留 eval tools/runner/gate | AC-F015-001～003 |
| `packages/fde/project/` | 项目交付产物 Host | Workspace 报告路径守卫、报告索引、Baseline 原子批准与项目快照 | AC-F015-001～004 |
| `packages/client/ui-fde-project/` | 项目交付页面 Client | 从验证评估阶段开放的“评估优化”View、二次运行确认、Session 运行状态、报告/Baseline 与比较 | AC-F015-001～004 |
| 项目目录 `.fde/evaluations/` | 不存在 | 用例、不可变报告和 Baseline 索引；运行 Session/临时副本不入 Git | AC-F015-001～004 |
| Bundle/聚合/第三方声明 | FDE 组合 | 注册 Host/Client/外部插件与许可说明 | 全部 |
| Architecture/验证记录 | 技术决策和证据 | 记录隔离、费用、报告 schema、兼容性和真实检查 | 全部 |

## 实现方案

将 `dsh-eval-harness` 加入 Web Profile，但不自动运行。FDE 页面只从当前 Workspace 的 `.fde/evaluations/cases/` 形成 cases_dir；插件 output、Session、overlay 和独立工作副本全部写入项目 `.runtime/fde-evaluations/<EvalRunId>/`。工具完成后，当前 Agent 只把 `report.json` 与 `report.md` 发布到 `.fde/evaluations/reports/<EvalRunId>/`，不把临时目录带入报告或源码。

Host 提供项目级 list/read 和 Baseline 批准入口。运行由当前 Session Agent 在用户二次确认后调用固定插件 `eval_run`；执行前守卫把 cases、runtime output 和 gate report 限制到 calling Agent Workspace，检查现有符号链接，拒绝模型覆盖 dsh_bin/Profile，并在 V1 禁用 Judge 校准。正在运行时页面使用 Session 权威状态，但不提供外部 runner 未实现的独立取消。输出目录使用时间身份，Host 只索引当前 Workspace 下的有界报告，并拒绝把项目外路径或非 reports 文件批准为 Baseline。

Client 在 `conversation.view` 注册“评估优化”。没有用例时显示建立指引；有报告时显示最新结论、用例表、历史报告和 Baseline 同名用例差异。运行按钮先展示用例数量、当前 Agent 模型和费用提示，再要求用户二次确认；自动验证只证明未确认不调用，不执行付费模型。

Baseline 更新采用显式“设为当前基线”动作，Host 只接受当前项目报告索引内的有效 JSON，并通过带锁原子写入保存副本；任何 Candidate 报告都不会自动写入 Baseline。

## 实施顺序

1. 固定、许可复核并构建 `dsh-eval-harness`，验证当前 rc.2 的 CLI/runner/trace parser。
2. 建立项目 cases/reports/baseline 目录合同、路径守卫和报告索引。
3. 组合当前 Agent 的真实 run、运行状态、报告比较、隔离目录和重启恢复。
4. 实现“评估优化”View、验证评估阶段可见门、用例/报告/失败/Baseline 页面和明确运行确认。
5. 使用无模型 fixture/既有报告验证解析、门禁、隔离、损坏和兼容性；不自动执行付费 Trial。
6. 组合构建、重启 3080、记录真实验证和未运行模型评估边界。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证时机 |
|---|---|---|---|
| 外部插件面向较早 RC/宽 peer | 当前 rc.2 可能失配 | 固定提交，先类型/构建/无模型 runner spike；必要时最小适配 | T002 |
| 仓库根许可证缺失 | 直接复制源码风险 | 优先包依赖；记录 package MIT 与来源，复制实质代码前补齐许可审查 | T002 |
| UI 运行评估可能产生费用 | 未授权模型调用 | 只在用户明确确认后运行；自动验证只用无模型 fixtures/报告 | T003～T005 |
| 路径参数可越界 | 读取/写入其他项目 | WorkspaceId 映射和 realpath 守卫；不接受任意 output/session 根 | T002～T003 |
| Host 重启留下子进程 | 假运行或资源泄漏 | 运行属于当前 Session Agent 和插件子进程；重启后页面只读取已落盘报告，不把缺失进程显示为 running | T003 |
| 单一断言/总分误导 | 假通过 | 用例级证据、关键失败优先、未覆盖项、Baseline 人工复核 | T004～T005 |

## 回退策略

移除 FDE Evaluation Client/Host 后现有项目与观测保持可用；移除 `dsh-eval-harness` 不删除项目用例、报告或 Baseline。当前固定 runner 未暴露可靠取消，因此页面不显示评估专用取消，移除插件前必须等待运行结束。外部插件不兼容时页面保留只读已有报告，并明确“评估执行不可用”。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F015-001 | 验证评估阶段开放、用户触发、费用提示、隔离运行 | Host 路径/编排测试＋Client 状态/阶段可见性测试 | validation 起可见且无自动运行，独立 Session/工作副本 |
| AC-F015-002 | 真实用例报告与恢复 | 固定插件 fixture/报告解析测试 | PASS/WARN/FAIL、失败/Token/耗时/Trace 齐全 |
| AC-F015-003 | Baseline 不变比较 | compare/schema 测试 | 差异准确，不兼容拒绝，不自动覆盖 |
| AC-F015-004 | 报告版本与阶段证据 | Host 合同测试 | 无效/旧版本不通过，F015 不推进阶段 |

---
document: feature-plan
feature: F006
status: ready
updated: "2026-08-27"
---

# F006 · 验证评估与进入部署试运行实施计划

## 现有上下文与复用

- 复用 F015 的真实 Agent Trial、断言、PASS/WARN/FAIL、报告和 Baseline，并把它明确限定为“固定用例回归”，不另建评估执行器。
- 复用 F004/F018/F020 的单一 Skill、固定产物快照和安全 Markdown 预览模式。
- 复用 F005 的 expected revision 人工门和 F011 的完整项目进度页面。
- 复用 F020 的验收方案、研发基线和当前候选版本作为上游输入，不复制研发任务数据。

## 影响范围

| 模块 | 变化 | 对应 AC |
|---|---|---|
| `packages/fde/project` | 有界解析验证合同、指标来源、方案定义摘要、FDE 方案确认、问题/必需指标人工接受、证据和三份固定产物，提供验证阶段快照 | AC-F006-001～005 |
| `packages/fde/stage` | 注册 `fde-validation` Skill/Prompt 和 `validation → pilot` 人工门 | AC-F006-001, AC-F006-003 |
| `packages/client/ui-fde-project` | 扩展评估页的生成方案/确认方案/开始验证、指标来源和固定用例回归，并在项目进度展示问题/必需指标人工接受、产物和二次确认 | AC-F006-002～005 |
| 数据分析项目 | 增加基于现有真实研发证据的验证准备样本，不伪造未运行结论 | AC-F006-001, AC-F006-002 |
| 文档与测试 | 更新共享合同、聚焦测试与验证记录 | 全部 |

## 实现方案

在现有 FDE Project、Stage 和 UI 插件内做最小扩展。Project Host 解析固定 JSON 合同，校验项目相对来源/证据，并把 FDE 确认绑定只覆盖候选、环境、数据和指标定义的 SHA-256 摘要；执行结果与问题状态不进入摘要，避免正常验证写回使确认失效。EvaluationView 同时消费验证快照和既有评估快照，用当前 Session Prompt 完成生成方案和开始验证并切回对话；Project Progress 复用既有 Artifact 预览。Stage 继续只提供验证 Skill 和固定人工路由，不增加 Agent 可调用推进工具。项目数据、指标和证据继续落在项目目录，不建立服务端数据集或指标数据库。

验证结果继续使用单一主证据路径：`result.evidence` 为项目相对字符串，多份底层记录由该主证据文件索引；WARN 只读取 `result.waiverReason`。`fde-validation` Skill 内置可直接仿写的精确结果示例和错误字段禁用说明。Host 先解析合同顶层信息，再逐项解析指标；任一指标失败时返回无效合同、具体错误和其余有效投影，不计算摘要或开放人工门，避免一个字段错误把整个页面降为全零。

EvaluationView 在 Client 内从同一验证快照派生完成率、结果分布、证据覆盖、类别分布和阶段产物状态，使用 CSS 图形与可访问文字同时表达，不引入图表依赖或第二份统计状态。指标筛选只保存在页面本地状态；页面刷新后仍以 Host 快照为准。

项目进度的问题人工关闭直接更新同一 `.fde/evaluations/validation.json`，不建立浏览器覆盖状态。Client 提交 WorkspaceId、当前方案摘要、IssueId 和非空理由；Host 在合同文件锁内重读当前文件，确认方案定义未变化且目标问题仍为 open，再保留原问题字段并写入 `status=waived`、`waiverReason` 和 `waivedAt`。方案摘要继续排除执行结果与问题处理状态，因此正常接受问题不会使当前评估方案失效；该动作也不修改任何指标结果或证据。

必需指标人工接受复用同一合同文件锁与方案摘要。Client 提交 WorkspaceId、当前方案摘要、MetricId 和非空理由；Host 重读合同，确认目标指标仍为必需、仍未通过正常结果与证据满足门槛，保留原 `result.status`、证据、数值和说明，只追加 `result.manualAcceptance.reason` 与 `acceptedAt`。门槛把完整人工接受视为该指标已由 FDE 决策，不把它计入真实 PASS，也不清除其他阻塞。

项目进度的输入和问题行统一收紧 Grid 子项的 `min-width`，长哈希、路径、问题说明和接受理由允许在容器内断行；操作区在窄宽度下换行，不扩大独立页面的最小内容宽度。

## 实施顺序

1. 冻结 PRD、Product Spec、Feature Map 与 F006/F005 文档。
2. 增加验证合同类型、有界解析、证据路径校验和三份产物快照。
3. 注册 `fde-validation` Skill 与短阶段提示，增加 `validation → pilot` Host 固定门。
4. 扩展评估页和项目进度，接入三份产物预览与 FDE 二次确认。
5. 为数据分析项目建立真实验证准备合同和计划；未执行的指标保持待运行。
6. 运行一次最窄 Host/Client 聚焦测试和相关类型检查，记录证据后交给用户手工验收。
7. 补充指标来源、方案摘要确认和三步工作入口；把旧运行入口改名为固定用例回归，并更新数据分析样本。
8. 增加问题人工接受路由与项目进度内联确认，修复输入和问题长文本溢出，并用 Host/Client 聚焦测试固定原子更新与可见状态。
9. 增加必需指标人工接受路由与项目进度内联确认，保持原结果和证据状态，用 Host/Client/Stage 聚焦测试固定单项解除阻塞和阶段门行为。

## 依赖与风险

| 风险 | 应对 | 验证 |
|---|---|---|
| JSON 被写入任意路径或超大数组 | 固定路径、字段枚举、长度/数量上限和 realpath 检查 | Host 边界测试 |
| 旧候选结果误满足新候选门槛 | Skill 在候选版本、环境、输入、方法或阈值变化时把受影响指标重置为 NOT_RUN；旧证据只作历史 | Skill/Prompt 合同测试与无证据门槛测试 |
| WARN 或总分掩盖关键失败 | 必需指标逐项判定；关键问题阻塞；WARN 需要理由 | 门槛组合测试 |
| UI 和合同形成双状态 | Client 只读 Host 快照，不在浏览器保存指标通过状态 | 组件测试 |
| 既有评估页面回归 | 保留 F015 运行区与测试，只在上方增加验证摘要 | EvaluationView 聚焦测试 |
| Agent 修改已确认的方案定义后仍沿用旧确认 | FDE 确认保存方案定义摘要；候选、环境、数据或指标定义变化立即 stale，结果/证据写回不改变摘要 | Host 摘要/确认测试 |
| 指标看似由平台凭空生成 | 每项指标至少一个可读取前阶段来源和编号，并在表格直接展示 | Host 来源边界＋组件测试 |
| Agent 写出数组证据或错误的接受理由字段 | Skill 固定 `evidence` 字符串与 `waiverReason` 示例；Host 对无效指标显式报错且保留其他真实投影 | Skill 文本测试＋Host 部分投影测试 |
| 人工接受覆盖 Agent 同时写入的问题或方案变化 | 合同文件锁内重读，校验当前方案摘要与目标问题仍为 open 后再原子写入 | Host 并发/过期摘要测试 |
| 人工接受被误读为真实指标通过 | UI 逐字说明只接受该问题风险；Host 不修改 metric 结果，阶段门仍独立检查必需指标与证据 | Host 快照＋Project Progress 组件测试 |
| 长哈希、路径或接受理由撑破页面 | Grid 子项允许收缩，元信息按任意连续字符断行，操作区响应式换行 | CSS 合同与组件 DOM 测试 |

## 回退策略

移除验证 Skill、验证快照扩展、验证阶段 UI 与 `/api/fde-stage/validation/complete` 即可停止新能力；项目已有 `validation.json`、证据和三份 Markdown 不删除。已经由 FDE 进入 pilot 的项目不自动退回。

## 验收映射

| AC | 最窄验证 | 预期证据 |
|---|---|---|
| AC-F006-001 | Skill/Prompt + Host 合同解析测试 | 缺失事实保持缺口，项目适用数据可为空且不造假 |
| AC-F006-002 | Project Host + EvaluationView 组件测试 | 候选版本、输入、指标、证据和问题与真实合同一致 |
| AC-F006-003 | Stage 路由/CAS + Project Progress 组件测试 | 缺失/失败不推进，完整门槛且二次确认只推进一次 |
| AC-F006-004 | Project Host 原子更新测试 + Project Progress 交互测试 | 理由必填、过期合同拒绝、原问题保留、状态变为 waived 且指标结果不变 |
| AC-F006-005 | Project Host 原子更新测试 + Project Progress 指标交互测试 | 理由必填、过期合同及非必需/已满足指标拒绝；原 NOT_RUN/FAIL 与证据保持不变，仅该指标解除阻塞 |

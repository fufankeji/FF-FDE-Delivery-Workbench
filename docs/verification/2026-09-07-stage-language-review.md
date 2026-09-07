# 八阶段页面用语检查与调整

日期：2026-09-07。范围：执行现有产品语言约束 PSC-021 / PSD-017，检查八阶段工作台、阶段方法说明、项目进展及直接关联的架构、用量、评估页面。不重新设计生命周期。

## 验收标准

- 页面使用具体业务对象、开发任务、交付动作与可观察状态，不用抽象包装词代替工作内容。
- 保留既定八阶段名称及必要专业术语；本体、知识图谱、API、Schema、PoC、Eval 等不作为禁词，编辑说明补充中文含义。
- 同一状态在前端、阶段说明和操作反馈中含义一致；不把选择方案、文件存在或构建成功表述成人工验收通过。
- 不改客户填写的记录、阶段 ID、持久化枚举、资料路径和人工推进规则。

## 调整范围

| 页面范围 | 原用语示例 | 调整后的表达 |
| --- | --- | --- |
| 阶段一、二及通用阶段操作 | 事实还原、流程冻结、阶段门 | 梳理业务流程、记录流程选择、阶段评审 |
| 阶段三 | 环境调查驾驶舱、阶段骨架、可投影字段 | 调查结果、尚未保存详细调查结果、字段质量与缺失情况 |
| 阶段四 | 双轴机制判断、本体能力问题、受控上下文、Provider | 实现方案与本体选型、图谱业务问题、Agent 任务参考信息、本地 Semantica 服务 |
| 阶段五 | 指纹、等待有效验证 | 版本校验值与受测文件、等待测试结果 |
| 阶段六至八 | 信号与发现、责任与实操、项目语义依赖 | 运行问题与反馈、培训与运维交接、知识图谱接入与版本 |
| 关联页面 | 候选产物、数据底座、累计投影 | 待审核记录、数据存储、累计用量 |

图谱构建状态、查询类型与资料解析状态增加可读中文标签，底层枚举未改。Go / Revise / Narrow / Stop 的操作标签说明继续、修订、缩小范围和停止投入，保存的决定类型不变。客户原始描述仍按原文显示，未批量清洗既有项目文件。

同时修正两处容易夸大状态的表述：已记录选型结果不再显示成已由 FDE 接受；历史阶段只读查看不宣称文件已经不可变封存。缺失具体来源时明确显示尚未登记，不显示已绑定证据。

## 验证结果

以下命令在 `upstream/deepseek-harness/` 执行，另有说明的除外。

- 客户端四个定向测试文件：`stage-workbench.client.spec.tsx`、`delivery-stage-panel.client.spec.tsx`、`project-progress-page.client.spec.tsx`、`project-views.client.spec.tsx`，共 85 项。首次运行发现旧文本断言；修正对应断言后，失败项定向重跑通过。最后一次本体编辑按钮文案调整又单独运行对应 1 项，通过；其余 52 项是筛选未执行，不是依赖缺失跳过。
- Host 的 `project.spec.ts`、`generality-gates.spec.ts`、`stage.spec.ts` 共 56 项；其中两项旧文案断言修正后定向通过，其他 54 项通过结果复用。条件分支未因本次文案改动放宽。
- `DSH_EXAMPLE_MODE=lib DSH_SNAPSHOT=replay corepack pnpm exec vitest run --config vitest.snapshot.config.ts apps/cli/tests/fde-generality.snapshot.ts --update`：退出 0，1 项通过并更新快照。实际 Loader 加载已构建包，真实 HTTP 返回阶段说明和方法说明；运行区为隔离测试项目。
- `corepack pnpm exec tsc -b packages/fde/project packages/fde/stage packages/client/ui-fde-project`：通过。
- Host 的 `@deepseek-ai/dsh-fde-project`、`@deepseek-ai/dsh-fde-stage` 构建及 `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`：通过。
- 根仓库 `git diff --check`：通过。

未运行整套浏览器回放、截图或视觉验收；按照仓库人工优先约定，页面阅读体验留给用户确认。

## 实际预览版本

仅重启主工作树 3080，显式使用 `DSH_HOME=../../.runtime/dsh-home`。3081 前端分支和其他业务服务未操作。

- `http://127.0.0.1:3080` 返回 HTTP 200。
- 实际启动清单版本：`f0953815c653`。
- 实际客户端地址：`/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=89db8c4fc081`。
- 在线包包含本轮 6 处指定新标签，且不含 5 处指定旧标签；其中包括“实现方案与本体选型”“本体构建与业务验证进度”“编辑本体定义”。
- 监听进程确认使用项目隔离的运行目录；`workspace.json` 与 `fde_stage.json` 的 SHA-256 与操作前相同，未调整真实项目进度。

## 发布检查边界

全仓 `doc-sync` 初次运行为 19 项通过、9 项失败，并非全仓通过。本次引入的双语跳转及新增 README 章节位置已修正；受影响的 5 对文档翻译配对检查通过。仓库仍有既存 JSDoc、目录生成、版权换行、旧 Agent Note 等文档检查问题，未为本轮用语调整进行全仓重构。项目与阶段 README 中原有 Model Experience 检查问题已对照 HEAD，相关段落未改。

GitHub 发布就绪扫描未发现敏感文件、密钥、超大文件或冲突；扫描失败项仅为根 `docs/` 被跟踪。发布技能默认排除根文档与本仓库明确要求“规格、验证记录与源码同仓管理”冲突，因此遵循仓库约定保留文档，不删除远端规格。

此前已完成的通用性修复和真实 SDK 测试一并交付，独立证据见 `2026-09-07-platform-generality-repair.md` 与 `2026-09-07-semantica-sdk-verification.md`。本轮文案验证未读取凭证、调用模型或重跑无关 SDK 测试。

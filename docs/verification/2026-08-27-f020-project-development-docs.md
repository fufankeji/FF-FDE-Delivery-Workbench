# F020 项目开发规范与研发进度验证

## 范围

- Feature：F020 项目开发规范与研发进度
- 分支：`main`
- 基线：`ed6a99dfe448`
- 用户可见目标：项目进入项目开发后，Agent 可按需加载单一开发 Skill；项目进度直接读取项目自身 `docs/`，展示核心文档、Feature、任务证据、已声明周期与研发收口产物；评估从开发阶段可见；只有 FDE 能在三份收口产物齐备后进入验证评估。
- 真实验证项目：`/Users/muyu/test/ai-analysis`
- 保持项：不新增任务数据库，不自动推算日期/进度，不原样引入 Spec Kit CLI/分支约定，不由 Agent 推进阶段。

## 规格证据

| 检查 | 结果 |
|---|---|
| `validate_prd.py . --require-confirmed` | exit 0；PRD confirmed，23 个 REQ、10 个 NFR、22 个 AC；仅保留“功能需求超过 12 条”的既有范围复核 warning |
| `validate_product_spec.py . --require-confirmed` | exit 0；Product Spec confirmed，28 个 PSC、33 个需求映射、22 个 AC；无错误或警告 |
| `validate_feature_specs.py . --feature F020 --require-ready` | exit 0；F020 Spec/Plan ready，7 个任务的格式与追踪有效；无错误或警告 |
| F020 完成态检查 | 未宣称 overall completed：F005、F009、F015、F018 仍为进行中，且等待用户手工验收；本轮实现任务已有证据 |

## 实现与构建证据

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run packages/fde/project/tests/project.spec.ts packages/fde/stage/tests/stage.spec.ts packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx packages/client/ui-fde-project/tests/view-availability.client.spec.ts` | exit 0；4 个文件、27 项全部通过 |
| `pnpm exec tsc -b tsconfig.host.json --pretty false` | exit 0 |
| `pnpm exec tsc -b tsconfig.client.json --pretty false` | exit 0 |
| `pnpm run build:lib:host` | exit 0；包括 `@deepseek-ai/dsh-fde-project` 与 `@deepseek-ai/dsh-fde-stage` 最新 Host 工件 |
| `ui-fde-project` 定向 bundle | exit 0 |
| `ui-fde-document-preview` 定向 bundle | exit 0 |
| 四组新增/更新 README 与 Agent Note 翻译配对 | exit 0；4 个命名文档对一致 |
| 重启隔离 Web 工作台后 `curl http://127.0.0.1:3080/` | HTTP 200；3080 使用项目 `.runtime/dsh-home` 并加载最新构建工件 |

聚焦测试覆盖：空 docs；核心文档 3/3；Feature 元数据和 Markdown 任务计数；三份研发收口文件；安全 ArtifactId 和未知 ID；开发 Skill/阶段提示；缺少收口文件与成功人工门；项目进度开发阶段视图、预览和两步确认；评估从开发阶段可见、观测保持从验证评估阶段可见。

## 数据分析项目 docs 验证样本

- 项目 PRD、架构、产品总规格、Feature Map、源码证据台账均基于现有源码逆向整理。
- 共拆分 7 个真实 Feature，每个均包含 `spec.md`、`plan.md`、`tasks.md`：项目与数据资产、安全查询与探索、数据质量与特征工程、机器学习训练与预测、Agent 与 Skills、血缘与报告、运行配置与系统管理。
- F020 扫描器真实结果：核心文档 `3/3`，Feature `7`，任务 `47/47`，研发收口产物 `3/3`，扫描问题 `0`。
- 7 个 Feature 未发现源码中的真实计划日期，因此 `planned_start` 和 `planned_end` 均明确写为 `待确认`，未虚构排期。
- 三份研发收口文件为实施报告、运行手册和研发基线；研发基线明确记录“本轮未重新运行数据分析项目自身运行测试”，不把逆向文档当作运行验收。

## 手工验收与边界

- 按协同开发约定，未执行浏览器端到端回放、自动截图或视觉对比；页面交给用户在 3080 手工验收。
- 建议手工检查：进入数据分析项目的“项目进度 → 阶段产出”，确认核心文档、7 个 Feature、47/47 任务、待确认日期、三份收口产物和 Markdown 预览均来自同一真实项目目录；再检查评估入口可见以及完成项目开发的两步人工确认。
- 未重新运行 `/Users/muyu/test/ai-analysis` 自身前后端、模型或数据库测试；本轮对该项目的改动仅为 docs 和 `fde-deliverables/03-project-development/` 验证材料。

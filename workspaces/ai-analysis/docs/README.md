# DS4-AI 数据分析系统研发文档

本目录依据当前源码、测试、运行脚本和已有交付文档逆向整理，作为 FDE 工作台“项目开发”阶段的唯一研发文档事实源。

## 文档入口

- `PRD.md`：产品目标、用户旅程、需求、边界和验收。
- `architecture/architecture.md`：当前实现架构、运行边界和关键技术决定。
- `specs/product-spec.md`：跨 Feature 的对象、状态、不变量和共享行为。
- `specs/feature-map.md`：七个 Feature 的范围、依赖和源码证据。
- `specs/FNNN-slug/`：每个 Feature 的 `spec.md`、`plan.md`、`tasks.md`。
- `verification/source-evidence.md`：本轮逆向使用的源码与测试证据台账。

## 状态说明

Feature 标记为 `completed`，表示当前项目中已经存在相应源码和聚焦测试证据，不代表本轮已重新执行全部运行验收。计划日期没有项目事实依据，统一保留为“待确认”。真实复验结果应追加到对应 `tasks.md` 和 `fde-deliverables/03-project-development/development-baseline.md`，不能仅凭 Agent 结论修改任务状态。

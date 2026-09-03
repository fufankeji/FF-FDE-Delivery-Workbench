---
document: feature-plan
feature: F020
status: ready
updated: "2026-08-27"
---

# F020 · 项目开发规范与研发进度实施计划

## 现有上下文与复用

- 复用 F004/F018 的 Skill 注册、短阶段提示、固定产物快照和只读预览。
- 复用 F005 的 expected revision 人工门，不增加 Agent 可调用推进工具。
- 复用 F011 的完整项目进度页面与阶段变化通知。
- 阶段页签继续由 F014/F015 独立负责：观测从项目开发开放，评估只在进入验证评估后开放；F020 不改写两者业务归属。
- 借鉴 GitHub Spec Kit 的规范驱动顺序，不原样接入 `dsh-specify` 的分支/CLI/目录约定。

## 影响范围

| 模块 | 变化 | 对应 AC |
|---|---|---|
| `packages/fde/project` | 扫描固定 docs、解析 Feature/frontmatter/tasks、固定 ArtifactId 预览 | AC-F020-002 |
| `packages/fde/stage` | 注册项目开发 Skill/Prompt 与 `development → validation` 人工门 | AC-F020-001, AC-F020-003 |
| `packages/client/ui-fde-project` | 项目开发阶段文档/Feature/任务/收口产物展示和二次确认 | AC-F020-002, AC-F020-003 |
| 数据分析项目 | 根据真实源码逆向完整 docs，作为功能验证样本 | AC-F020-001, AC-F020-002 |
| 文档与测试 | 更新合同、双语 README、Agent Note、聚焦测试和验证记录 | AC-F020-001～AC-F020-003 |

## 实现方案

在现有 FDE Project、Stage 和项目进度插件内做最小扩展。Stage 只注册一个按需开发 Skill 和带 expected revision 的人工门；Project Host 把固定 `docs/` 树解析成只读快照和 ArtifactId 白名单；Client 只消费快照并复用既有文档预览。研发任务、日期和状态继续写在项目自身 Markdown 中，不新增数据库、任务编辑器或 Spec Kit 分支工作流。

## 实施顺序

1. 冻结 PRD、Product Spec、Feature Map 与 F020 Spec/Plan/Tasks。
2. 在 FDE Project Host 增加有界 docs 扫描、动态 ArtifactId 白名单和快照。
3. 在 FDE Stage 注册 `fde-project-development`，增加固定开发提示和第三个人工门。
4. 在项目进度增加开发阶段视图与文档预览，不在 F020 中改变观测或评估的页面合同。
5. 基于 `/Users/muyu/test/ai-analysis` 真实源码逆向完整 docs，不修改业务源码和 README/AGENTS。
6. 运行一次最窄 Host/Client 测试和相关类型检查，记录证据，交给用户手工验收。

## 依赖与风险

| 风险 | 应对 | 验证 |
|---|---|---|
| 大项目 Feature 目录过多 | 扫描限定固定根与最大数量，排序稳定 | Host 边界测试 |
| 任意路径读取 | 浏览器只提交 Host 生成 ArtifactId；每次解析并检查 realpath | 预览路由测试 |
| frontmatter 不完整 | 状态降级为真实缺失/待确认，不猜测 | 解析测试 |
| UI 与 docs 形成双状态 | Client 只读快照，不提供任务编辑 | 组件测试 |
| 旧阶段门回归 | 保留 requirements/solution 路由与测试 | Stage 回归测试 |

## 回退策略

移除项目开发 Skill、开发 docs 快照、开发阶段 UI 与 `/api/fde-stage/development/complete` 即可停止新能力；项目已有 docs 与收口产物不删除，已经人工进入 validation 的项目不自动回退。

## 验收映射

| AC | 最窄验证 | 预期证据 |
|---|---|---|
| AC-F020-001 | Stage Skill/Prompt 测试 | 只在 development 提示固定 docs 和人工边界 |
| AC-F020-002 | Project Host + 项目进度组件测试 | 真文件、Feature、任务和预览一致，缺失不造假 |
| AC-F020-003 | Stage 路由/CAS + Client 测试 | 三份产物与 revision 有效时仅推进一次 |

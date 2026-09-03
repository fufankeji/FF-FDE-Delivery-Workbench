---
document: feature-plan
feature: F018
status: ready
updated: "2026-08-27"
---

# F018 · 方案设计标准产物实施计划

## 现有上下文与复用

- F004 已验证内置 Skill、固定产物快照和 Markdown 预览路径。
- F005 已提供带 expected revision 的固定单步人工门。
- F013 已提供项目级架构 schema、候选发布和人工确认状态。
- F011 已提供项目进度详情、阶段产物预览和阶段变化通知。

## 影响范围

| 模块 | 变化 | 对应 AC |
|---|---|---|
| `packages/fde/project` | 五份固定方案文档的快照、安全解析和预览路由 | AC-F018-002 |
| `packages/fde/stage` | 方案设计 Skill/Prompt 与 `solution → development` 固定人工门 | AC-F018-001, AC-F018-003 |
| `packages/client/ui-fde-project` | 方案文档、架构状态、预览与二次确认 | AC-F018-002, AC-F018-003 |
| 文档/测试/Bundle | 合同、聚焦测试、构建和隔离运行交付 | AC-F018-001～AC-F018-003 |

## 实现方案

在现有 FDE Project、Stage 与项目进度插件内做最小扩展：复用需求调研 Skill/固定产物/人工门模式，复用 F013 的项目架构存储和确认状态，不引入新的模板引擎、数据库或附件规则系统。Host 分别拥有固定文件解析、架构权威状态和阶段 CAS；Client 只提交 WorkspaceId 与 expected revision。

## 实施顺序

1. 在 FDE Project Host 维护五份固定方案文档的安全解析、快照和只读文件路由，新增项目 PRD 并保持 ArtifactId 白名单。
2. 在 FDE Stage 注册 `fde-solution-design` Skill 与仅在 `solution` 生效的短提示。
3. 扩展 Host 阶段状态和路由：五份文档存在、架构已确认、阶段/revision 一致时允许 FDE 单步进入 `development`。
4. 扩展项目进度：方案设计阶段展示五份文档、架构状态、Markdown 预览和两步人工确认。
5. 更新 Client 阶段控制器和阶段变化通知，让项目进度与项目交付读取同一已提交状态。
6. 运行聚焦 Host/Client 测试、相关包构建并重启隔离 3080 服务，交给用户手动验收。

## 依赖与风险

| 依赖/风险 | 影响 | 应对 | 验证 |
|---|---|---|---|
| F004 既有需求门 | 新逻辑可能破坏 `requirements → solution` | 保留原路由与测试，新增独立 solution 路由 | FDE Stage 回归测试 |
| F013 架构候选/确认 | 候选被误判为可进入开发 | 只接受当前架构 `status === confirmed` | 未确认架构路由测试 |
| 固定文件 URL | 任意项目路径读取 | 浏览器只提交合同内 ArtifactId，Host 做 realpath 约束 | FDE Project 路由测试 |
| Client 缓存 | 阶段门成功后页面仍显示旧阶段 | 复用 WorkspaceId 范围的阶段变更通知 | Controller 联合测试 |

## 回退策略

移除方案设计 Skill、五份方案产物快照和 `/api/fde-stage/solution/complete` 路由即可停止新阶段门；原需求调研门、现有架构和项目文件不删除。已经由 FDE 确认进入项目开发的项目不得因 UI 回退自动退回。

## 验收映射

| AC | 实现结果 | 最窄验证方法 | 预期证据 |
|---|---|---|---|
| AC-F018-001 | Skill 和 solution 阶段提示固定文档/架构边界 | Stage Skill/Prompt 测试 | 仅 solution 生效，不含推进工具 |
| AC-F018-002 | 五份文档和架构状态进入项目快照与页面 | Project Host＋项目详情组件测试 | 真文件可预览，候选架构不冒充确认 |
| AC-F018-003 | 只有 FDE 满足前置条件后单步进入开发 | Stage 路由/CAS＋Client controller 测试 | 缺失/冲突不推进，成功仅一次 |

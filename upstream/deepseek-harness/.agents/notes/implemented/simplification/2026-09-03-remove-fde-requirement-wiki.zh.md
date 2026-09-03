# Agent Note: 移除 FDE 需求 Wiki

Status: implemented

[English](2026-09-03-remove-fde-requirement-wiki.md) | 中文

## Problem

需求 Wiki 会把用户明确选择且已经本地解析的项目 Source 梳理为带来源引用的知识页、关系、冲突和未知项，再发布一个不可变 revision，并通过 Galaxy View 与无障碍列表展示。这个可追溯的跨文档视图单独看具有价值，但它与当前 FDE 产品路径重复：项目 Source 和固定需求产物已经携带证据并进入人工确认。保留这条并行路径还意味着继续维护两个模型可见 schema、独立的磁盘生命周期、Session／提供方／模型确认逻辑、Three.js 客户端体积、轮询，以及项目详情中的 5 个额外区块，而产品已经不再需要这项能力。

## Decision

FDE 项目包不再提供需求 Wiki 运行时。`@deepseek-ai/dsh-fde-project` 不注册 Wiki 工具或启动／取消 route，不读取或发布 Wiki revision，也不在项目快照中包含 Wiki 状态。`@deepseek-ai/dsh-client-ui-fde-project` 不创建 Wiki controller、不排队 Wiki prompt、不轮询构建、不渲染 Wiki／问题／Galaxy 区块，也不再为这条流程依赖 Three.js 和模型目录服务。项目详情继续保留项目 Source 摄取、本地解析与预览、3 份固定需求调研产物，以及只由 FDE 控制的需求阶段门。

已有 `.fde/requirement-wiki/` 目录属于不再生效的用户项目数据。产品既不读取也不修改这些目录，本次移除也不会扫描无关 Workspace 并删除此前生成的文件。

## Verification

交付的 Host 与 Client Bundle 不包含 Wiki route、工具、controller、prompt、面板、Galaxy 实现或依赖。聚焦 Host 与 Client 测试覆盖保留下来的项目快照、插件应用、项目详情、Source 路径和交付收口行为。生成的工具目录只包含仍受支持的 FDE 架构与 OpenAPI 工具。

## Alternatives considered

**隐藏 Wiki 界面但保留 Host 工具与存储。** 拒绝，因为即使用户无法到达结果，模型 schema、写入路径、Source 依赖、持久状态机和维护成本仍然存在。

**为已有 Wiki revision 保留只读兼容。** 拒绝，因为这会为没有现行产品消费者的预发布能力继续保留快照类型、解析器、界面分支和兼容合同。已有文件仍可直接从项目目录恢复，无需受支持的运行时路径。

**移除 Galaxy View，但保留纯列表 Wiki。** 拒绝，因为重复的梳理、模型授权、来源校验、revision 发布、冲突和未知项仍会形成一条与固定产物并行的第二需求流程。

## Consequences

项目只保留一条需求路径：Source 进入可见的 Agent 工作和固定需求产物，最终由 FDE 确认需求基线。每个 Agent 请求不再携带两个 Wiki 工具 schema，客户端不再为该功能携带 Three.js，Host 也不再拥有第二套从 Source 派生的 revision 生命周期。

产品不再提供带来源引用的跨文档知识页、关系浏览、冲突与未知项聚合、不可变 Wiki 历史，以及带语义列表降级的 Galaxy 可视化。若要重新引入其中任何能力，必须建立新的明确产品 Feature，证明固定产物与普通 Source 引用无法满足对应用户旅程，定义模型与数据授权，并重新建立从不存在到发布完成的端到端覆盖，而不是默认恢复已删除实现。

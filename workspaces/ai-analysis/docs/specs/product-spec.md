---
document: product-spec
title: DS4-AI 数据分析系统产品总规格
status: completed
updated: 2026-08-27
---

# DS4-AI 数据分析系统产品总规格

## 1. 核心对象

| 对象 | 稳定身份与归属 | 权威内容 |
|---|---|---|
| Project | ProjectId | 标题、状态、独立 workspace、创建/更新时间 |
| DataAsset | AssetId，全局 | 类型、原件/连接配置、画像、指纹、字段字典、项目使用关系 |
| Source | SourceId + ProjectId | 项目内数据源、状态、指纹、配置和画像基线 |
| Artifact | ArtifactId + ProjectId | 类型、路径、SHA-256、状态、元数据、lineage |
| Message | MessageId + ProjectId | 角色、意图、正文、工具名、ArtifactId |
| AnalysisRun | RunId + ProjectId | 触发/结果消息、计划、步骤、来源、Skill、状态、失败和产物 |
| ModelJob | JobId + ProjectId | 训练请求、运行状态、取消和最终模型产物 |
| ReportVersion | ReportKey + version + ProjectId | Markdown/HTML 路径、来源版本、说明和 ArtifactId |
| InstalledSkill | SkillId + version/hash | 内容、权限声明、脚本能力、默认状态和安装路径 |
| ProjectSkill | ProjectId + SkillId | 项目启用状态与实际授权权限 |

## 2. 全局状态机

### 2.1 项目

`ready ↔ archived`；创建、重命名、导出不改变项目数据。删除是明确动作：数据库级联删除项目对象，并把 workspace 移入运行根下的 trash，而不是直接复用已删除路径。

### 2.2 来源

`pending → profiling → ready ↔ changed`，任一步异常进入 `failed`。`changed` 表示当前文件/数据库指纹与画像基线不一致；只有显式重新画像才能发布新基线。

### 2.3 分析运行与步骤

Run：`running → succeeded | failed | cancelled`。  
Step：`pending → running → succeeded | failed | skipped`。  
取消请求与最终 `cancelled` 分开记录；重试通过 `retry_of_run_id` 保留来源运行。

### 2.4 报告

同一 `report_key` 的版本单调递增。create、revise、restore 均追加新版本；渲染失败可以保留 Markdown 版本并重试，不回写旧版本。

## 3. 共享不变量

1. 所有项目对象读取必须同时校验 ProjectId；知道其他项目的对象 ID 不构成访问授权。
2. DataAsset 属于全局，只有显式 bind 后才生成项目 Source；被项目使用的资产不能直接删除。
3. 原始来源和上游 Artifact 不可被清洗、特征、模型或报告覆盖；每一步发布新 Artifact 并登记 lineage。
4. SQL 仅允许一条只读查询；结果限制、超时、文件函数和 MySQL 表范围由服务端校验，前端提示不能替代服务端边界。
5. 普通聊天不注册数据工具；只有分析意图和明确来源/Skill 才建立数据运行能力。
6. Agent 结果必须以真实 ArtifactId 关联消息和 Run；自然语言提到文件不等于系统已经登记产物。
7. 报告只能引用当前项目已登记 Artifact；恢复旧版本也必须生成新版本。
8. 模型 API Key 和数据库秘密只进入受控运行过程，不进入公开状态合同、仓库、Artifact 元数据或 Agent 基线摘要。
9. Skill 安装与检查只在受控根内解析；权限升级、路径穿越和未声明脚本能力必须拒绝。
10. UI 加载、刷新、页面切换和报告预览不得自动触发模型调用、训练、查询或业务写回。

## 4. 共享交互与失败恢复

| 动作 | 成功证据 | 失败与恢复 |
|---|---|---|
| 创建/管理项目 | Project 记录与独立 workspace | 创建失败不发布项目；归档可恢复；导出不包含秘密 |
| 登记/绑定数据 | Asset/Source、指纹、画像和项目绑定记录 | 损坏文件保留 failed；变化显示 changed；重新画像恢复 |
| 运行查询 | Query Artifact、SQL、结果行列、lineage | 非只读/越界/超时不发布成功 Artifact，可修改后重试 |
| 清洗/特征 | 新 Derived Artifact 与父 ArtifactId | 参数无效不覆盖输入；旧产物保持可用 |
| 训练/预测 | Model/Predictions Artifact、配置、指标和状态 | 失败/取消可诊断；不把部分模型标记 ready |
| Agent 分析 | Message、Run、Step、Tool 与 Artifact 关系 | 流式失败保留 Run；可取消或基于失败 Run 重试 |
| 报告版本 | ReportVersion、Markdown/HTML 和证据审计 | 渲染失败保留 Markdown；恢复不覆盖历史 |
| 配置模型/数据连接 | 连接测试结果和脱敏状态 | 跨 Host Origin、缺少新 Key 或测试失败时不替换旧配置 |

## 5. 能力与降级

- 没有模型凭据：项目、资产、查询、图表、处理、建模、报告和 Skills 管理继续可用；在线 Agent 对话明确不可用。
- 没有 Docker：普通内置/内容型 Skills 可使用；需要脚本的 Skill 明确提示沙箱不可用。
- 没有 MySQL：CSV、Excel、SQLite 主路径不受影响。
- 没有 Olist 数据：系统仍可使用用户自己的数据；课程样例准备脚本不伪造数据已经存在。
- Windows 非 WSL2：当前启动与沙箱脚本不宣称已验证。

## 6. Feature 归属

- F001 项目与数据资产管理
- F002 安全查询与数据探索
- F003 数据质量、清洗与特征工程
- F004 机器学习训练与预测
- F005 Agent 对话、运行与 Skills
- F006 产物血缘、可视化与版本化报告
- F007 运行配置、沙箱与系统管理

具体行为、实施路径与证据见各 Feature 的 `spec.md`、`plan.md` 和 `tasks.md`。

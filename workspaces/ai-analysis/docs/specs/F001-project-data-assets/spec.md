---
document: feature-spec
feature: F001
title: 项目与数据资产管理
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 项目隔离与多数据源接入可用
updated: 2026-08-27
---

# F001 · 项目与数据资产管理

## 用户结果

用户可以建立隔离的分析项目，把 CSV、Excel、SQLite 或 MySQL 登记为全局数据资产，并在明确绑定后用于指定项目。系统持续显示来源画像、字段字典、使用关系、指纹与变化状态。

## 行为规格

1. 项目支持创建、列表、读取、重命名、归档/恢复、导出和明确删除。
2. 每个项目拥有独立 workspace；Source、Artifact、Run 和 Report 都必须按 ProjectId 读取。
3. 文件资产接受 CSV、Excel、SQLite；MySQL 先检查连接和表，再登记明确表集合。
4. DataAsset 是全局可复用对象；bind 为目标项目创建 Source 和使用关系，不能让项目直接共享另一项目 SourceId。
5. 画像至少保存表/Sheet、行列、字段类型、空值、样例策略、字节和来源指纹。
6. 用户可预览有界行数、修改资产名称/描述/标签和字段字典。
7. 使用中的资产不能删除；来源内容改变时进入 `changed`，显式 reprofile 才发布新基线。

## 边界与失败

- 上传大小和项目来源累计大小服从服务端限制。
- 损坏或无法画像的来源持久化为 `failed`，保留诊断，不伪装 ready。
- 删除项目必须拒绝跨项目路径，并把 workspace 移入受控 trash；导出不得包含模型/数据库秘密。
- MySQL 连接秘密使用临时别名/运行凭据，不能写入 Source 公开响应。

## 验收

- 两个项目不能读取彼此的 Source/Artifact。
- 同一资产可绑定多个项目并生成不同 SourceId。
- 修改文件后检查显示 changed，重新画像后恢复 ready 并更新指纹。
- 有项目使用关系的资产删除请求被拒绝。

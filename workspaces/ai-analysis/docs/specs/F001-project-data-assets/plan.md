---
document: feature-plan
feature: F001
title: 项目与数据资产管理
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 项目隔离与多数据源接入可用
updated: 2026-08-27
---

# F001 实施计划

## 实施切片

1. 以 SQLAlchemy 建立 Project、Source、DataAsset、ProjectDataAsset 等稳定对象和级联边界。
2. 由 Repository 统一执行项目级寻址、跨项目拒绝、workspace 创建/导出/回收。
3. 为 CSV、Excel、SQLite、MySQL 建立画像、指纹和变化检测适配器。
4. 实现全局数据资产的登记、预览、字段字典和项目绑定。
5. 在首页、数据资产页和项目来源页呈现真实状态与恢复动作。
6. 使用项目隔离、资产复用、预览、变化/失败恢复测试冻结行为。

## 影响范围

- 后端：`models.py`、`repository.py`、`workspace.py`、`data_assets.py`、`data_sources.py`、`api.py`。
- 前端：`HomePage.tsx`、`DataPage.tsx`、`SourcesPage.tsx`、`api.ts`。
- 持久化：`.runtime` SQLite 与每项目 workspace。

## 风险与回退

- 画像大文件可能耗时/超限：保持状态机和大小限制，失败不删除原件。
- 删除可能误伤项目目录：只使用 Repository 已登记 workspace，并移动到受控 trash。
- MySQL 凭据泄漏：公开配置仅保存非秘密别名，异常和导出做脱敏。

## 验证

聚焦验证以 `test_workspace_repository.py`、`test_data_assets.py` 和 `test_data_query.py` 中来源变化/损坏/大小测试为准；页面旅程另做人工复验。

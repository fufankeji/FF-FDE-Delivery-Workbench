---
document: verification-record
feature: F008
status: implemented-with-manual-visual-review
date: "2026-09-04"
---

# 第四阶段 `3d-force-graph` 共享知识图谱渲染器验证

## 本轮目标

- 把自绘 React Three Fiber 场景替换为 `3d-force-graph 1.80.0` 的通用力导向渲染层。
- 渲染器只消费标准项目知识图谱快照，不内置门店维修或其他业务领域类型。
- 保留现有星空粒子背景，并让节点、搜索结果和直接关系进入同一个实体详情与镜头聚焦链路。
- 保留当前项目证据、Semantica Provider 和既有未提交滚动修复不变。

## 实现证据

- `KnowledgeGraphExplorer.tsx` 不向渲染器注入业务场景坐标：真实项目节点与关系进入 `3d-force-graph` 原生力导向引擎，快照中的任意社区再通过同一个通用吸引力形成分离、非规则的簇。
- 默认节点保持小比例，普通关系使用恒定一像素原生线；只有悬停或选中邻域才启用关系圆柱和方向粒子。搜索结果、画布点击、沿关系跳转与镜头聚焦进入同一详情状态。
- 1200 个 Three.js 星空粒子作为低不透明度独立 Scene 对象保留；低强度 Bloom 与雾化不再压过真实图谱。
- 56 个实体、56 条关系的当前 FDE-Agent 快照只用于只读验收；渲染器不把其中 10 个社区或任何业务实体写入常量。
- 生产渲染源码未匹配 `门店`、`设备`、`故障候选`、`告警`、`报修`、`维修`、`Store`、`Asset`、`Vendor` 或 `Repair`。
- `3d-force-graph 1.80.0`、固定源码修订、GraphRAG Workbench 初始布局来源及两份 MIT 许可均已写入包级 `THIRD_PARTY_NOTICES.md`。

## 验证结果

| 检查 | 命令／证据 | 结果 |
|---|---|---|
| 布局与通用交互 | `pnpm exec vitest run .../knowledge-graph-layout.client.spec.ts .../knowledge-graph-explorer.client.spec.tsx` | 2 个文件、3 项测试全部通过 |
| 客户端 Bundle | `pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | 退出状态 0 |
| 3080 在线 Bundle | 实际下发文件与 `packages/client/ui-fde-project/lib/client.js` SHA-256 一致，并包含 `3d-force-graph` 与本轮节点比例配置 | 通过 |
| 真实页面默认态 | 项目本地 Playwright/Chromium 打开 3080，进入第一项目并截图当前 56 实体／56 关系画布 | 画布 `1076 × 522`，横纵无溢出，控制台 0 项错误 |
| 搜索与详情 | 搜索真实 `Store` 类型并打开 `SZ-014` | 详情标题为 `SZ-014`，关系与来源面板正常出现，控制台 0 项错误 |
| 参考图差异 | 对同尺寸 `725 × 362` 图谱区域运行绝对像素比较 | `mean_pixel_similarity=0.931550`；因参考为 1238/2602 的另一数据集，状态为 `IMPLEMENTED_WITH_GAPS`，不冒充像素级 1:1 |

## 未验证项

- 官方首图使用约 1238 个节点、2602 条关系，当前项目快照只有 56 个实体、56 条关系；本轮只对齐视觉语言与交互，不伪造节点，因此不能把两个不同数据集声明为像素级 1:1。
- 项目本地 Chromium 已验证默认态、搜索选中态、无溢出和无控制台错误；拖拽手感与最终主观视觉仍由用户在 3080 确认。
- `StageWorkbench.module.css` 中既有的两行滚动修复属于进入本轮前的未提交改动，本轮未修改其内容。

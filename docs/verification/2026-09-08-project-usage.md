# 项目用量统计修正验收

日期：2026-09-08。范围：F002 / T014。实现及定向运行核验完成，视觉效果由用户在 3080 刷新确认；未自动操作浏览器、调用模型、推进阶段或启用外部监控。

## 行为与验证

- 默认项目累计；今天、7 天、30 天按调用开始时间统计。卡片、图表、会话表口径一致；无活动可回累计，加载／失败／部分数据不当作零值。
- 33 项唯一用例通过：`session-stats/tests` 的投影和真实 Loader；`ui-fde-project/tests/project-data.client.spec.ts`、`project-views.client.spec.tsx`、`usage-controller.client.spec.ts`、`apply.client.spec.ts`。覆盖跨午夜、回执替换、取消、检查点恢复、长期区间合并、范围切换、空状态、过时请求及插件注入。F002 定向规格校验与四组包文档配对校验通过。
- `tsc -b packages/session/session-stats packages/fde/project packages/client/ui-fde-project` 通过；两个 Host 包及 `ui-fde-project` Client Bundle 构建通过。
- 3080 真实读取返回两个已登记会话，均为 ready。累计为 31 轮、228 步，直接输入 1,085,583、缓存读取 40,427,776、输出 185,142 Token，共 41,698,501 Token；18 个活动时段逐项合计与累计完全一致，其中一个时段在当天。测试过程中未添加用量数据；这些数字来自现有日志，不是最初截图的旧快照。
- 未登记项目返回 404，请求额外指定 sessionId 返回 400，外部 Origin 返回 403。未接入其他项目作为回退数据。
- 最终在线 `ui-fde-project` 资源 revision 为 `043352141c77`，HTTP 200，与本地构建逐字节一致。SHA-256：`02f392a3fadec30f9411ffd5e2fe800b9965b3890be22daa2d02703c795b773d`。

## 原始记录与运行边界

只重启 3080；3081 未操作。重启前没有正在运行的 Agent 会话。用量接口通过公开投影缓存补齐历史数值，不打开 Agent。

首次更新重启时，非空会话文件 SHA-256 由 `405f41c1799477bab5561cbdf450bba56f17a925c85a525617c88dd3c4205ceb` 变为 `65af3bdd7204d97b46e50f3f6ea38dcea9aa16c6c79dd260a318b7082fd8f27f`。逐帧核对确认旧文件完整保留为新文件前缀，只由正常服务关闭追加一条 `session/end-seed`（seq 179443），未改写历史事件。空会话 SHA-256 保持 `2e6ed2657cf028d97e46436b0eae4bd343643db41844c709bf306aea3f6690a0`。不把整个文件哈希变化误报为“完全未变”；最终日期标签修订后再次更新了 Client 并重启主环境。

文档归属依据当前 V2 Feature Map，使用 F002 工作台合同；旧 F014 未列入当前 Feature Map，因此未继续改写该旧规格。未扩大为全仓文档迁移。

# 项目中心待处理原因核验

## 范围与结果

对应 F002 / T012 / AC-F002-003。卡片以具体原因替代“优先关注”，顶部、列表、统计、筛选和优先排序使用同一判定。普通未完成、读取中和会话运行中不再构成待办；当前阶段显式问题、当前版本执行失败、Host 可评审状态和有效已登记过期计划日期参与判定。读取失败单独标记，缺失文件不冒充业务风险；已解决、历史阶段和已完成项目不误报。

保持默认最近操作排序与原查看/进入项目流程，不新增接口、存储、模型调用或项目特判。保留上一轮“新建项目”按钮的青绿色及居中改动。未改写真实项目资料或推进阶段，未提交或推送 Git。

## 已执行验证

命令除文档校验外均在 `upstream/deepseek-harness` 执行。

- PRD、Product Spec 校验器 `--require-confirmed` 均通过；F002 校验器 `--feature F002 --require-ready` 通过。
- 原项目中心组件测试文件首次回归 11 项通过。
- 最终命令：`DEBUG_PRINT_LIMIT=1000 corepack pnpm exec vitest run packages/client/ui-fde-project/tests/project-attention.client.spec.tsx packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx -t 'Project Center evidence-backed attention|shows every real project by default'`，20 项通过，10 项未选择。覆盖普通/加载/运行状态不误报、历史与已解决问题排除、已完成项目排除、本地日期当天/未来/无效日期、多个待办真实原因及排序、卡片/列表/统计/筛选一致、解决后刷新清除、无效记录、测试与交付失败结果、旧版评估方案人工确认。
- `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` 退出码 0。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` 退出码 0。
- 3080 首页和 Boot Manifest 指向的 `/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=7e3eec6ada06` 均返回 200；在线资源包含具体原因及新空状态，不再包含“优先关注”。原服务不需要重启。

## 验证边界

仅执行本轮定向检查；未运行全仓测试、完整文档同步、浏览器自动化、截图对比或付费模型。页面实际观感待用户刷新后确认，构建与组件测试不代替人工视觉验收。

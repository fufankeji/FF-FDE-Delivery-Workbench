# 第四阶段 Schema 与交付收口区域

## 范围与实现

- 参考 `/Users/muyu/Desktop/阶段 4 3.png`、`/Users/muyu/Desktop/阶段 4 4.png`，调整 05 Schema 与 07–09 上下文、运行证据、人工决定区域。保留 01–04、06 图谱和既有页面滚动容器。
- Schema 按能力问题、领域类、关系表、来源与时间规则分组；数量、字段、阈值均读取当前项目定义。关系超过 5 条时支持展开与收起。
- 运行证据默认显示最近 8 条，可展开全部；每个证据按钮仍调用项目文件入口。上下文与切片按钮继续使用验证及上下文状态作为前置限制。
- 人工决定保留所有阻塞原文，按上下文、本体、权限及其他条件分组。构建成功不替代验证或人工 Go，历史阶段保持只读。
- 没有修改业务数据、调用模型、运行构建任务或提交阶段决定。这里的“构建任务”指产品内 Semantica/业务操作，不包括前端打包。

## 最窄检查

工作目录：`.worktrees/frontend-polish/upstream/deepseek-harness`。

| 检查 | 结果 |
| --- | --- |
| `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx --reporter=dot` | 退出 0，17 项通过；覆盖展开/收起、证据文件回调、禁用条件、已有人工决定和历史阶段路径 |
| `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` | 退出 0 |
| `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | 退出 0 |
| `git diff --check` | 退出 0 |

## 隔离预览

- 地址：`http://127.0.0.1:3081`，首页与实际 Client Bundle 均返回 HTTP 200。
- 启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3081`。
- 已核对监听进程的工作目录和 `DSH_HOME`；Workspace 登记中的三个项目均指向当前 worktree 的 `.runtime/workspaces/`。
- Boot Manifest 实际 Bundle：`/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=3e040392c27b`。在线内容包含 `data-design-schema`、`data-design-closeout`、关系展开、运行记录展开及新布局样式。

## 待人工确认

遵循仓库人工优先验收规则，本轮未执行浏览器自动点击、截图或像素对比。实现和定向检查完成，不宣称已通过 1:1 视觉验收；字体、比例、短视口下的实际滚动及操作观感等待用户在预览中确认。

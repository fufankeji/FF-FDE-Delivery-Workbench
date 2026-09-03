# F011 需求调研阶段产出同页预览验证

日期：2026-08-27  
运行地址：<http://127.0.0.1:3080>

## 本轮结果

- “项目进度 → 项目详情 → 阶段产出”中的三份固定需求调研产物支持选择并在当前页面只读预览 Markdown。
- 页面复用项目资料现有的共享预览 Slot，没有建立第二套渲染器；阶段确认和“进入项目交付”行为保持不变。
- Host 只接受已登记 WorkspaceId 与 `research-report`、`confirmation-checklist`、`requirement-baseline` 三种固定产物标识，不接受浏览器传入文件路径。
- 产物缺失或读取失败时不提供预览入口；文件存在仍只代表“已有产物”，不会自动推进项目阶段。

## 自动验证

| 验证 | 结果 | 证据 |
|---|---|---|
| F011/Host/共享预览聚焦测试 | 通过 | 5 个测试文件、20 项测试全部通过；覆盖产物地址投影、固定标识与项目边界、产物选择、共享 Slot currency 与既有预览注册 |
| Host 构建 | 通过 | `pnpm run build:lib:host` 退出码 0 |
| F011 Client Bundle | 通过 | `@deepseek-ai/dsh-client-ui-fde-project` bundle 完成 |
| 共享预览 Client Bundle | 通过 | `@deepseek-ai/dsh-client-ui-fde-document-preview` bundle 完成 |
| 双语 README 配对 | 通过 | 3 组相关 package README 配对记录重新生成并校验一致 |
| 运行服务 | 通过 | PID 60123 监听 `127.0.0.1:3080`，根页面 HTTP 200 |
| 隔离 Workspace | 通过 | `.runtime/dsh-home/storages/workspace.json` 仅登记 1 个项目：`数据分析项目`，路径 `/Users/muyu/test/ai-analysis` |
| 真实固定产物接口 | 通过 | `research-report` 返回 HTTP 200、`text/markdown; charset=utf-8`、`no-store` 与 `nosniff` |

## 人工验收范围

按协同开发约定，本轮不运行浏览器截图、视觉对比或完整 E2E。请在当前页面手动检查：

1. 进入“项目进度 → 数据分析项目 → 阶段产出”。
2. 点击三份“已有文件”中的任意一份，确认同页出现真实 Markdown 内容与“下载原件”。
3. 切换不同产物，确认标题、路径、正文同步变化，阶段进度不会因预览自动改变。

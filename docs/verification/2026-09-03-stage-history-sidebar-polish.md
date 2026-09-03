# 阶段历史页与项目侧栏优化验证记录

## 验证范围

- 已完成第一阶段的历史回看页使用通用结构展示真实输入、阶段记录、人工结论、封存轨迹和原生 Composer，不写死项目名称、文件名称或数量。
- 项目工作台侧栏使用 354px 展开宽度，当前或正在查看的阶段项本身作为工作方法目录开关，不保留“本阶段工作方法”二级入口。
- 本轮只修改 `feature/frontend-polish` worktree，运行服务使用该 worktree 的独立 `DSH_HOME` 和 3081 端口。

## 验证结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 阶段历史页组件测试 | 通过 | `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx`，10/10 通过 |
| 侧栏交互与组装测试 | 通过 | `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/project-context-sidebar.client.spec.tsx packages/client/ui-fde-project/tests/apply.client.spec.ts`，10/10 通过 |
| Client Bundle | 通过 | `ui-fde-project`、`ui-conversation`、`ui-sidebar` 的 `bundle` 均退出 0 |
| Web 构建 | 通过 | `corepack pnpm --filter @deepseek-ai/dsh-web-frontend build` 退出 0 |
| 隔离运行 | 通过 | 3081 返回 HTTP 200；监听进程工作目录为 feature worktree；Workspace 登记仅包含隔离的数据分析和知识库快照 |
| 在线 Bundle | 通过 | 3081 Boot Manifest 下发的 FDE Bundle 包含 `openSidebar(354)` 与 `data-stage-method-tree` |

## 视觉证据与人工决定

- 阶段历史页最后一轮同视口比较的整体平均像素相似度为 `0.945617`；顶部会话栏为 `0.959026`，Composer 为 `0.966690`，阶段完成提示、Hero 与证据链未达到预设的 `0.95` 区域门槛。
- 侧栏在移除二级入口前的最后一轮局部比较整体平均像素相似度为 `0.944098`；品牌栏、项目摘要和底部入口达到 `0.95`，当前阶段方法区为 `0.929907`。随后用户明确取消“本阶段工作方法”二级入口，因此旧参考图不再是新交互状态的逐像素验收依据。
- 用户在 3081 人工检查后要求把本轮结果合并回 main。该决定允许保存当前视觉状态，但不把上述未达标区域重新标记为自动高保真通过。

## 未执行与边界

- 没有调用模型、外部服务或凭据。
- 没有修改或启动 3080；最终核验时 3080 未运行。
- 没有验证其他浏览器、深色主题、折叠侧栏或第 2～8 阶段历史页的逐像素结果。
- 临时视觉证据位于 `/tmp/codex-ui-fidelity/FDEDeliveryWorkbench/20260903-stage-one-right/` 和 `/tmp/codex-ui-fidelity/FDEDeliveryWorkbench/20260903-project-sidebar/`；合并确认后可以安全删除。

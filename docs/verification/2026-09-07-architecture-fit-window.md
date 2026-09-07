# 系统架构单屏适配

## 修改范围

- 架构图移除固定最小宽度和 620px/560px 最小高度，以输入框上方的实际可用空间作为画布视口；SVG 保持比例居中适配完整分组，窗口和侧栏尺寸变化由百分比布局自动响应。
- 分栏高度按真实最大节点数计算，去除强制 660px 产生的底部空段。架构数据、节点和连线不删减。
- 缩放相对于完整适配尺寸计算；“适应窗口”恢复总览并清零滚动位置。手动放大仍允许滚动；保留节点聚焦、锁定、暂停动画及完整 SVG/PNG 导出。
- 仅调整系统架构页面布局，没有修改业务项目、阶段状态或输入框公共布局。

## 验证

- 定向 Vitest：`project-views.client.spec.tsx -t 'renders architecture'`，1 项通过、3 项不相关测试跳过。覆盖四分栏、完整 viewBox、相对缩放、恢复总览和滚动复位、节点关系查看。
- `tsc -b packages/client/ui-fde-project/tsconfig.json` 与该 Client 包 `bundle` 通过；README 配对检查及本轮源码 whitespace 检查通过。
- 仅重启 3081，监听 PID 66876，显式 `DSH_HOME=../../.runtime/dsh-home`；三个 Workspace 均指向当前 worktree 隔离区。main 3080 返回 200，业务服务未重启。
- 在线 Boot Manifest 的 Client revision 为 `f842f1f7c410`；实际 bundle 包含“适应窗口”、百分比缩放变量及 `xMidYMid meet`。
- 按项目人工优先规则未运行浏览器自动化；单屏观感、侧栏开合与输入框占位待用户刷新手动确认，不以组件测试冒充视觉验收。

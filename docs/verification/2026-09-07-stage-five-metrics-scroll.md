# 第五阶段指标表格限高滚动

## 修改范围

- 仅调整第五阶段“测试指标与证据”表格的展示容器，当前阶段及历史只读视图共用。
- 表格区域最大高度为 `min(520px, 55dvh)`，内容较少时自然收缩；多条指标在区域内纵向滚动，窄屏保留横向滚动。
- 表头使用 sticky 固定，分离表格边框避免滚动时边框消失；滚动区域保留键盘焦点、清晰名称与稳定滚动条空间。
- 所有指标、结果、证据链接和当前阶段操作保留，不裁剪数据、不新增分页或改变验收状态。整体工作台及原生输入框布局不变。

## 验证结果

- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx -t 'stage-five information workbench'`：10 项通过，其余 20 项未运行。新增当前/历史视图各 12 条指标的验证，确认全部行仍存在、区域可键盘聚焦、末条证据可访问，历史视图不恢复执行按钮。
- `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` 与对应 Client `bundle`：退出 0。
- 中英文 README 单对校验通过，`git diff --check` 通过。
- 3080 使用主工作树与 `DSH_HOME=../../.runtime/dsh-home` 重启，PID 为 `89110`；首页及实际 Boot Manifest 指向的 Client Bundle 均返回 HTTP 200。
- 在线 revision 为 `a605acb5620b`，SHA-256 为 `58830a32a8f026e6734c99e9be5bd8841069209d085f18c4f9c7ac94ae296fa8`，与本地构建一致，包含双向滚动区域名称及 `55dvh` 高度规则。
- Workspace 登记文件重启前后保持相同 SHA-256，原三个项目不变。未操作 3081、4177 或客户项目数据。

## 验收边界

未运行浏览器自动化或截图；组件测试不模拟浏览器真实滚动几何。用户刷新 3080 确认滚动手感及短视口布局。保留此前未提交改动，本轮未提交 Git。

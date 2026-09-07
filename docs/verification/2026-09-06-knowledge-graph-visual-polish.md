# 知识图谱布局与交互优化验证

## 本轮范围

用户要求重新优化真实图谱并自行查看效果。本轮在主工作树 `main` 和 3080 中修改共享渲染层；3081、Semantica Provider、项目材料、Schema、图谱快照及阶段决定均不属于修改范围。保留工作树中原有的 `StageWorkbench.module.css` 滚动修改。

## 原因与实现

- 原有布局按实体类型施加较强的空间吸引，导致本来相连的不同类型实体被拉开，产生贯穿画面的交叉长线；离线布局还被渲染器的第二次模拟丢弃。
- 按真实关系划分连通分量，分别进行局部力导向布局，再按实际包围盒无重叠排布。局部布局先保证正面可读性，再增加有界展示深度。社区仅用于颜色和筛选，不决定坐标，不生成业务节点或边。
- 保留 `3d-force-graph` 和 Three.js 星空。调整节点颜色、柔和光晕、中性色细线、邻域高亮与方向粒子。缩放时限制节点的屏幕大小变化。
- 添加可点击的实体名称，按关联度选择显示内容并进行屏幕空间避让；聚焦时突出相关名称，为右侧证据面板预留空间。关闭详情返回总览，切换社区筛选清除旧实体选择。
- 添加浏览器全屏查看与退出，底部统计、操作提示和社区图例分别排布。

## 验证结果

- `corepack pnpm exec tsc --noEmit -p packages/client/ui-fde-project/tsconfig.json --pretty false`：通过。
- 两个定向 Vitest 文件：4 项通过，覆盖快照不变性、任意实体类型、连通关系不受类型重命名影响、真实关系数量、搜索与沿关系跳转。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`：通过。
- README 与已有 Agent Note 的两组双语配对检查：通过。
- 使用项目已有 Playwright 与受管 Chromium，实际访问 3080 并进入原项目；CSS 视口 1512×900，DPR 2。验证默认态、真实 Canvas 节点点击、旋转、社区筛选、全屏进入／退出、搜索后实体详情。
- 实际图谱仍为 56 个实体、56 条关系。默认图谱容器 1076×522，局部横纵向均无溢出；20 个可见实体名称没有互相重叠；浏览器未捕获运行异常。
- 3080 监听进程为当前主工作树启动的 PID 39847，启动显式使用根仓库 `.runtime/dsh-home`；其中登记的 Workspace ID 与 Workspace 行数均为 3。
- 首页实际引用 `/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=f051d97fec50`；在线与本地 Bundle SHA-256 均为 `1109f09ff7eceb11a9265f43f2f054fa06830cec98449dab37e4d698f71e0722`。在线资源包含实体名称实现，已不存在 `createCommunityForce`。

## 可视证据与边界

临时证据目录：`/tmp/fde-graph-polish-20260906.qA89XS/`。其中 `before.png` 为优化前，`final.png`、`final-selected.png`、`final-fullscreen.png` 为最终代码的真实渲染；`final.json` 保存交互与局部几何结果。目录由本地页面和脚本再生，人工确认后可安全清除，未进入 Git。

本轮验证的是图谱可读性与直接操作，不宣称与不同数据集的 GitHub 首图逐像素一致，也不代表图谱语义或第四阶段业务验收通过。视觉偏好仍待用户确认；尚未提交 Git。

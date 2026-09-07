# 第四阶段知识图谱视觉与动效增强

## 本轮范围

用户明确要求足够酷炫的真实三维图谱。修改共享 `KnowledgeGraphExplorer` 的渲染、标签和展示筛选，不修改 Provider、项目事实、人工决定或阶段流转。保留当前分支既有第二阶段底部溢出修复，未操作 main。

## 实现与边界

- 使用真实 Three.js 发光球体、连接度光环、Bloom 泛光和星空；沿已登记关系显示方向粒子。不是背景图片，也不添加假节点或假关系。粒子不代表实时传输或执行成功。
- 原生三维模拟继续拥有节点位置。只在渲染器中按真实连通分量施加柔性聚集力，不固定坐标、不按社区虚构关联；首次取景与尺寸变化适应图谱边界。
- 默认显示全部关系与避让名称。主干模式使用确定性的最大生成森林，保留连通性；不将主干解释为业务重要性。等权关系不再导致主干模式与全部模式完全相同。
- 保留搜索、实体详情、关联导航、社区筛选、重置和全屏入口。拖拽、滚轮、选中节点会暂停；减少动态效果偏好下预热后静止，保留静态光效。退出时释放新增材质、纹理与 Bloom 资源。
- 图谱黑色、冰白、青色角色由主题 token 提供，不改变其他阶段表面。按用户后续要求，WebGL 背景改为纯黑 `#000000`，主题背景同步使用既有纯黑 token；节点光效与动效不变。

## 已执行检查

工作目录为当前 worktree 的 `upstream/deepseek-harness/`。

1. `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false`：退出 0。
2. 定向 Vitest：`knowledge-graph-motion.client.spec.tsx`、`knowledge-graph-explorer.client.spec.tsx`、`knowledge-graph-layout.client.spec.ts`，3 文件共 8 项通过。覆盖三维初始化、无固定坐标、暂停恢复、减少动态效果、等权环与孤立节点保留、聚集力不污染快照、光效资源释放，以及既有搜索和关联导航。
3. `ui-fde-project` 与 `ui-theme` 的 `bundle`：均退出 0。
4. 两包 README 与既有图谱 Agent Note 的 3 组既定双语配对检查通过；`git diff --check` 通过。
5. 仅重启 3081。进程 `61420`，启动目录为当前 worktree 的 `upstream/deepseek-harness/`，环境 `DSH_HOME=../../.runtime/dsh-home`。登记的 3 个 Workspace 均指向本 worktree 的 `.runtime/workspaces/`；3080 与 3081 均返回 HTTP 200。
6. 从 3081 首页 Boot Manifest 获取实际资源，在线内容与本地 bundle 字节一致：
   - `ui-fde-project` revision `dc76e3938e29`，包含 `UnrealBloomPass`、`constellation` 与关系方向说明。SHA-256 `58bec9cbd4b357037eadd51495b9d9cc90609e71b40063024f47262a6db00858`。
   - `ui-theme` revision `60c5e161b929`，包含图谱新角色。SHA-256 `a5ba901c4913a300278e0ad1d1e078f1a01971a52b8553b0e1c153bb50f78f1e`。
7. 隔离项目图谱仍为 56 个实体、56 条关系；SHA-256 `960a8b029c76ccb9c50d38c2ab1aa6f9852c1df3e781d6356e692fef6f4adec2`，与本轮前已有验证记录一致。本轮没有写入该数据文件。

## 待人工确认

背景回调更新：两包重新 bundle 通过并仅重启 3081。在线 `ui-fde-project` revision 为 `03d1b3c9a5f2`，确认 `BACKGROUND_COLOR = "#000000"`；`ui-theme` revision 为 `6b206d0a201d`，图谱背景绑定纯黑 token。两份在线 bundle 与本地字节一致，3080 返回 200，Workspace 登记仍全部位于隔离目录。此项仅改颜色，不重复运行已通过的交互测试；下述视觉人工确认边界不变。

按项目人工优先规则，没有打开浏览器、截图或执行 WebGL 视觉验收。测试使用渲染器替身验证调用与交互逻辑，不证明实际 GPU 光效、帧率、标签避让或全屏构图已经达到审美要求。请在 `http://127.0.0.1:3081` 刷新第四阶段图谱，确认光效强度、默认构图和实际交互。

构建产物沿用现有被忽略的包 `lib/` 目录，可重新 bundle 生成；未创建新运行区、安装依赖或提交生成媒体。

# F025 公共入口的官方风格适配

状态：实现与技术检查完成，3082 已交用户人工确认；未提交、未推送。

## 范围与保留路径

本轮只适配总览、项目中心与一级导航。总览的实验室摘要同步字号、间距和轻量表面；不修改实验室内部场景或 iframe 生命周期。介绍首页、项目详情、八阶段业务工作台、技能正文、Host API、控制器与业务数据不变。

视觉沿用官方语义色、20/28 页标题、13/20 说明及共享按钮；收敛外层卡片、装饰横幅与重复边框。项目中心保留创建、优先事项、项目指标、卡片/列表、筛选、排序、搜索、分页、时间轴和详情入口。公共导航拥有同生命周期的全屏不透明底板，在其上绘制已有皮肤，防止半透明页面透出下层会话；不修改用户皮肤偏好。

## 验证结果

- PRD、Product Spec 的 confirmed 检查通过；F025 `--require-ready` 通过。修正 F025 两个旧 Task 对 F026 的 REQ-034 引用，使导航任务回到既定 REQ-033；未扩展产品范围。
- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx packages/client/ui-fde-project/tests/workbench-surface.client.spec.ts packages/client/ui-fde-project/tests/project-center-navigation.client.spec.tsx packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx packages/client/ui-fde-discovery-lab/tests/page-surface.spec.ts`：6 文件、27 项通过，5.62 秒。证据：`.runtime/harness-021-upgrade/native-style-tests.log`。
- `corepack pnpm run build`：10 项通过，23.65 秒，含 Client 制品和 Host/Client 聚合类型检查。证据：`.runtime/harness-021-upgrade/native-style-build.log`。
- ui-fde-project 包说明中英同步及命名配对检查通过；本轮 diff 空白检查通过。
- 以显式 `DSH_HOME=../../.runtime/harness-021-validation/dsh-home` 重启 3082；启动授权交换 303、首页 200、Boot 版本 0.2.1-rc.2。Workspace 登记仍只有隔离门店项目，路径位于验证区。
- 在线 Project Bundle 包含 `data-fde-workbench-backdrop` 与 `data-project-native`，5,565,690 字节，SHA-256 `dc11ed2179c6500e57816c03b2879b3a0991c3c2afd6e2e954a1fae73dafdbbd`。
- 在线 Lab Bundle 含编译后的新摘要布局 `grid-area:2/9/auto/17`，18,868 字节，SHA-256 `20e7ce29339e92b35b33e2e2e200306fa4e79f90b4d185864ff7a4e6c8699de7`。第一次文本检查按源形式查找 `grid-column:9/17` 未通过；核实构建器将 row/column 合并为 grid-area 后按实际制品核对，生产代码未因此改动。
- 通过系统打开命令把本实例授权地址交给 Chrome；没有输出或保存到文档中的授权参数。

## 人工确认与边界

请从“进入平台”检查总览和项目中心，重点确认皮肤可读性、列表密度、主按钮、窄屏布局以及切换体验。没有运行浏览器自动截图、全量 E2E、模型或付费服务；HTTP 和组件测试不替代视觉验收。T006 继续未完成，暂不推广到八阶段业务页面。

继续使用既有验证区，没有新增 worktree、运行副本、依赖或媒体文件。新增日志复用 `.runtime/harness-021-upgrade/`，验收及回退窗口结束后可随该目录清理；原运行区与业务项目原件未改动。

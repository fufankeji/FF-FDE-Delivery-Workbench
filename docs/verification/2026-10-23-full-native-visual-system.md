# F028 全系统官方风格适配

状态：实现、直接相关技术检查与隔离上线完成，待用户人工确认。未提交或推送 GitHub。

## 授权与覆盖

用户已确认 F025 总览、项目中心和一级导航样板，并明确要求整个系统适配。本轮先记录 REQ-037、AC-034、PSC-031 与 F028 三件套；保持既有工作树和 F025 改动。

| 页面/工作面 | 本轮结果 | 保留边界 |
|---|---|---|
| 总览、项目中心、一级导航 | 沿用用户确认的 F025 | 统计、排序、筛选、创建、时间轴及返回不变 |
| 项目详情与阶段侧栏 | 统一标题、轻量表面、主操作与导航密度 | V1/V2 身份、阶段浏览与人工决定不变 |
| 第一至第四阶段 | 移除妨碍阅读的重色横幅，固定浅色值改为语义主题色 | 工作项、状态、资料、证据与当前/历史/未来语义不变 |
| 第五阶段 | 统一运行与验证页头、指标表面与确认控件 | 真实结果、失效/未执行和评审保持 |
| 第六至八阶段 | 统一试点、生产交接、持续改进的视觉层级 | 受控环境、人工批准、证据与签收规则不变 |
| 资料/产物预览与方法说明 | 统一浮层、遮罩、主题表面与文字 | 原读取、下载、引用、关闭、返回与独立滚动不变 |
| 技能中心 | 轻量卡片、标题、搜索与阅读窗 | 平台/课程分类、内容、文件及许可不变 |
| 系统架构 | 外围与节点色板跟随主题，弱化装饰 | 节点、连线、缩放、审阅与导出不变 |
| 知识图谱 | 轻量外围边框 | 深色画布、分类色、图数据与专用交互保留 |
| 用量、评估、运行输出、项目预览 | 统一外层及操作控件 | 专用图表、终端输出及目标业务 iframe 不改 |
| 外观设置 | 统一标题、卡片与控件反馈 | 皮肤图片、预览、保存格式与偏好不变 |
| 介绍首页 | 统一操作按钮与品牌文字细节，弱化部分阴影 | 展示布局、配图、原浅色首页及进入路径保留 |
| 实验室大厅、访谈、资料与报告 | 新增同源主题白名单同步及原生外围样式 | 五案例、像素场景、训练状态和 iframe 保活不变 |
| 官方设置、插件、自动化任务、对话、编辑/Git/Review | 继续使用既有原生样式 | 不对原生或第三方页面做通配覆盖 |

## 检查结果

- 文档：PRD 与 Product Spec confirmed 检查通过，F028 `--require-ready` 通过；37 个 REQ、14 个 NFR、34 个产品 AC、31 个 PSC。数量提醒不作为错误。
- F025 用户确认任务已勾选；完成态校验指出其依赖 F002/F024 仍在进行，故将 Feature 状态保留 in-progress，没有代替用户确认依赖完成。
- 首批定向命令：`corepack pnpm exec vitest run packages/client/ui-fde-project/tests packages/client/ui-fde-stage/tests packages/client/ui-fde-discovery-lab/tests packages/client/ui-fde-appearance/tests`，42 文件、231 项中 221 通过，10 失败。记录在 `.runtime/harness-021-upgrade/full-native-style-tests.log`。
- 其中 9 项由旧 UI 测试夹具/文案预期未跟上现有源码引起：交付完成夹具缺少 metadata、归档会话与 Workspace 就绪字段；用量夹具缺少 Session 状态 hook；方法标题及旧“六阶段完成”预期已过时。只补齐实际接口或断言当前可见行为，不修改生产逻辑。`native-style-fixture-tests.log` 记录侧栏、用量及 Skills 双主题通过；`native-style-final-tests.log` 记录交付 7 项、首页、frame 主题和 Skills 双主题通过。
- 新主题合同检查最后通过：`corepack pnpm exec vitest run packages/client/ui-theme/tests/fde-native-style.client.spec.ts`，2 项，`native-style-theme-contract.log`。它检查阶段色板继承及失效样式变量已移除。
- 实验室新 `frame-theme.client.spec.ts` 验证：仅复制显示白名单、不复制无关变量；明暗切换不改变 iframe/document 身份或现有文本；卸载后停止属性与 load 同步。没有读取真实凭据或模型服务。
- 最终 `corepack pnpm run build`：10 项全部通过，25.94 秒；包含 Host/Client 聚合类型与 Client/实验室应用制品。记录：`full-native-style-build-final.log`。
- 五组直接相关包说明的中英配对检查通过；最后的三组段落归属调整重新配对通过。产品规格保持中文单一事实源。
- 代码和文档 diff 空白检查通过；无依赖安装、没有新 worktree、运行副本、模型权重或媒体输出。

## 单独记录的既有失败

`packages/client/ui-fde-project/tests/controller.client.spec.ts` 中 `cancels a pending project read when another project becomes active` 仍期望第二项目读取触发第一个请求的 `AbortSignal.aborted === true`，实际为 false。本轮未改该控制器或该测试；没有为视觉验收修改其语义、放宽断言或隐藏失败。该项需要独立确认当前多项目读取的取消合同，不属于本轮视觉修改；不宣称全部 FDE 测试或全仓测试全绿。

## 在线制品与运行区

继续使用 `DSH_HOME=../../.runtime/harness-021-validation/dsh-home`、端口 3082。授权交换 303，首页 200，Boot 版本 0.2.1-rc.2；验证区仍只登记门店示例项目，其路径位于既有隔离目录。

| 在线资源 | 字节数 | SHA-256 |
|---|---:|---|
| ui-fde-project | 5599050 | f49092262282f567eaa9a1b21018a1bd25fc87d5bc9a3014497a773b9e4504a9 |
| ui-fde-stage | 29073 | 5d50d3d20e88d99f72398bb385b6ee339b183464b68f93c531457330bbb60d44 |
| ui-fde-appearance | 49460 | bba8f83261235e005d74f57856504ee95ae809b632771c70092647a96873bb34 |
| ui-fde-discovery-lab | 21566 | b4e6f40cfdb260469234f212bed83a4b2255853b7fd3776725677932ea3f9b63 |
| ui-theme | 124943 | 72f6868423284c324cf350b783e2226491799d9cde65da0f0e1a483920deef67 |
| lab/app.css | 54612 | c52351b06af62b33adc68834f73693400c92a5f939b549e1ed5495e78884c4a7 |

所有资源返回 200。在线 Lab Client 含 `fdeNativeTheme` 同步代码，应用 CSS 含 `html[data-fde-native-theme]` 样式；公共 Project Bundle 保留已确认样板标记。已通过系统打开命令交给 Chrome，无授权参数进入文档。

## 人工体验与清理

请核对实际皮肤下的文字对比度、八阶段页头与证据区域、方法/资料浮层、技能正文、架构/图谱、用量评估及实验室主题切换。没有运行自动浏览器回放、截图或真实模型，最终视觉不以技术检查代替；T007 保留未完成。

仅在既有 `.runtime/harness-021-upgrade/` 增加样式迁移辅助脚本和验证日志，验收及回退窗口结束后可随该目录清理。原运行区和业务项目原件没有被新版打开或改写。

## 人工反馈修正：总览缺少可辨识边框

用户截图确认总览的透明、无边框容器导致区域层次不足。按先更新 F028 计划、再实现的顺序，仅修改两个总览 CSS Module：三项统计使用浅色表面和完整细边框，“继续工作”、实验室与技能中心改为完整卡片边界；统一圆角与内边距，保留原有业务内容和按钮。边框采用官方 `--dsw-alias-border-l4`，没有叠加阴影或固定浅色值。宽屏统计等宽留缝；窄屏同步内边距及统计排列，不改导航与数据逻辑。

- 定向检查：`corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-surface.client.spec.ts packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx`，3 文件、16 项通过；新增样式断言覆盖六个区域的轮廓、表面与盒模型。
- 构建：`corepack pnpm run build`，10 项通过、退出码 0，24.04 秒；日志 `.runtime/harness-021-upgrade/overview-boundaries-build.log`。
- 构建后重启同一 3082 服务，监听 PID 80099 使用显式隔离 `DSH_HOME`；授权交换 303、首页 200。工作区仍仅登记既有门店项目及其 3 个会话，路径位于隔离区。
- 实际 Boot 资源返回 200，并包含本轮 88px 统计容器、完整边框及窄屏 18px 内边距：Project Bundle 5,599,504 字节，SHA-256 `763e8e0ffb291f48106d5087af7af507eb2775f1e0928b552bfa8beb18fd8687`；Lab Bundle 21,882 字节，SHA-256 `3b14b5005872f06016847c2f9adc77dd9297778e6df95360d63caaf1e15fc1e8`。
- 本轮未运行浏览器自动化、未创建运行副本、未提交或推送。T007 保持待人工确认；技术检查不替代用户对边框清晰度和实际皮肤效果的判断。

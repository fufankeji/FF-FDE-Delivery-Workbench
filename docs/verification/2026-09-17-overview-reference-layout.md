# 工作台总览参考图布局调整

## 范围与验收边界

- 用户要求按所给总览效果图做 1:1 复刻，本轮延续 `feature/platform-navigation`，基线 `c10b68b61ce2535bedf4dd72dbaa1859a825909f`；不改首页、项目工作台、实验室原应用或既有数据。
- 参考 PNG 原始尺寸为 1586×992；原 CSS 视口、DPR、缩放与字体未知。暂以 CSS 1586×992、DPR 1、100% 缩放建立布局基准，不把假设当成已确认截图环境。
- 使用 `ui-fidelity-replication`，实现前建立视觉合同与素材清单，校验结果为 `PREFLIGHT_VALID`。按项目人工优先规则，不启动浏览器、不截图、不做像素或多视口自动化验收。
- 状态：`IMPLEMENTED_WITH_GAPS`。本轮交付供人工查看的实现，不声称逐像素 1:1 已验收；字体、颜色、几何间距、实际断点效果等待人工确认。

## 实现与保留路径

- 保留四个同级导航入口和导航行为，调整侧栏、品牌、选中项与底部署名的尺寸和间距；品牌使用原 Logo，不改源图。
- 总览按参考图组织为页头、三项紧凑统计、继续工作列表、实验室与技能中心双卡片；保持新建项目、查看项目、进入确切项目和技能占位入口。
- 列表仍按真实 `updatedAt` 倒序取最近三个项目。项目总数与列表条数分别展示；企业与当前阶段来自原数据。项目图标只是按行序呈现的装饰，不推断业务分类。
- 实验室摘要仍只发起一次只读目录请求，复用同一结果提供两项统计和卡片。`currentRunId` 决定是否显示继续已有训练；加载、失败、重试和无训练状态保留。没有新训练、模型调用或数据写入。
- 实验室 Slot 的 `display: contents` 宿主保持布局中性。构建产物核对发现 CSS Module 会按包重命名 `grid-area`；已改为数字行列跨 Slot 对齐，在相同断点调整位置，避免跨包命名失配。
- 技能中心独立占位页不改；没有新增目录、安装或执行功能。既有实验室 iframe 生命周期不变。
- 两包既有中英文 README 仅同步局部布局合同和状态边界；产品开发规格继续单一简体中文来源，本轮不增加产品行为或扩展 Feature。

## 定向检查

工作目录为当前 worktree 的 `upstream/deepseek-harness/`。

```sh
corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx
```

- 两文件共 10 项通过，退出 0；覆盖真实排序与目标项目动作、项目总数与最近三条、长标题与企业缺省、加载/失败/空态、技能入口、已有训练与无训练分支，以及原 iframe 切换保持。
- 三个改动的 TSX 使用仓库 `findUiI18nViolations` 做定向检查，零违规。
- 两对 README 配对检查通过。没有运行全量 GUI 或 Web E2E，也未重复执行输入未变的组件检查。
- `git diff --check` 通过；改动仅包含两个相关 Client 包与本验证记录。

## 构建与在线预览

```sh
corepack pnpm run build
DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3084
```

- 最终构建退出 0，记录 270 个 Client 产物；保留既有的 chunk 大小与跨平台包提示。CSS 行列修正后重新构建；未重复执行未改变的组件行为测试。
- 预览地址：`http://127.0.0.1:3084/`。最终监听 PID `92244`，cwd 为本 worktree 的 `upstream/deepseek-harness/`，`DSH_HOME=../../.runtime/dsh-home`；三个登记 Workspace 路径均指向本 worktree 的隔离 `.runtime/workspaces/`。
- 本地登录交换 HTTP 303，首页 HTTP 200。Boot Manifest revision 为 `95eb6f29aef5`，62 个条目。
- 首页声明的项目包 `rev=1bf616f2b56f44a5-37` 与实验室包 `rev=1bf616f2b56f44a5-22` 均返回 HTTP 200。前者包含新的总览/列表/技能卡片及阶段标签；后者包含新摘要和 `currentRunId`，以及最终编译的 `grid-area:2/7/auto/13`、`grid-area:2/13/auto/19`、`grid-area:4/1/auto/16` 数字定位。
- 以上只证明最新代码、构建与隔离服务就绪，不证明浏览器渲染、字体、像素相似度或人工产品验收通过。

## 临时产物

- 视觉合同、素材清单与人工状态说明：`/tmp/codex-ui-fidelity/FDEDeliveryWorkbench/overview-20260917.PYcSH3`，约 24 KB。原始参考图和本轮源码是事实源，验收后可删除该临时目录；未提交 Git。
- 构建日志：`/tmp/fde-overview-fidelity-build.log`，可重建；依赖与构建输出继续使用原 worktree，不创建新副本或浏览器运行时。
- 本轮没有提交、推送或合并；主工作树和 3080 服务保持不动。

## 后续反馈：底部设置入口

- 用户要求把可配置模型 Key 的设置入口放到截图所示侧栏最底部。保留返回介绍首页与研发署名，将“设置”放在两者下方；总览、项目中心、实验室和技能中心均共用该侧栏。项目内原设置入口继续保留。
- 通过可选 `sidebar.settings.shortcut` Slot 复用原设置外壳：两个入口共享一个仅含打开状态和分区选择的注册 Store；配置页面、模型/API Key 读写和首次引导仍由原功能持有，不创建第二个面板或配置副本。
- 关闭设置会把焦点还给实际打开它的按钮；平台导航、项目选择、训练页面均不因打开设置而切换。没有读取、验证、复制或修改用户真实 Key，没有调用模型。
- `settings-root.client.spec.tsx`、`workbench-navigation.client.spec.tsx` 和 FDE `apply.client.spec.ts` 共 32 项通过；包括新旧入口打开同一面板、进入模型分区、Escape/按钮关闭及焦点返回。
- 原 `shell.client.spec.ts` 装配测试在收集用例之前被 `client-test-runtime: bundle patch patch: entry "$main" not found` 阻塞，未计为通过，未修改其清单或无关基础设施。新增独立 `shortcut-registration.client.spec.ts` 通过 1 项，用真实 SlotRegistry 检查原设置与新入口共享 Store、入口随声明撤回且原设置仍保留。初次该定向夹具漏供 `remote.settings` 服务，改为仓库标准 `TestRemote` 后通过；产品源码不涉及该夹具问题。
- 合计 33 项定向检查通过；新增触达的两个 TSX 本地化检查零违规，三个包的既有中英文 README 配对检查通过，`git diff --check` 通过。
- `corepack pnpm run build` 退出 0，记录 270 个 Client 产物。日志为 `/tmp/fde-platform-settings-build.log`；没有运行浏览器、截图或填写真实凭据，视觉和真实 Key 配置仍待用户手动确认。
- 更新后的 3084 监听 PID 为 `95008`，仍使用本 worktree 的 cwd 与显式隔离 `DSH_HOME`，三个 Workspace 全部位于隔离目录。首页 HTTP 200，Boot Manifest revision `c06fe4adfaaf`；实际项目包 `a0870d66f88e2981-37` 和设置包 `a0870d66f88e2981-20` 均 HTTP 200 且包含 `sidebar.settings.shortcut`，模型设置插件仍在清单中。

## 后续反馈：返回首页入口精修

- 将两侧重复的斜箭头替换为一个左向 SVG 箭头，文案和 `showProjectHome` 动作保持不变。入口使用 14px 字号、整行点击区域和轻量悬停反馈，与设置入口对齐；保留键盘焦点指示和移动端入口，减少动态效果偏好下关闭按压缩放。不改设置、署名或其余导航。
- `workbench-navigation.client.spec.tsx` 5 项通过；新增断言只有一个 SVG、文字没有重复箭头，并复用原返回首页及导航退出断言。`git diff --check` 通过。
- `corepack pnpm run build` 退出 0，记录 270 个 Client 产物；日志 `/tmp/fde-home-entry-polish-build.log` 可随时按相同命令重建。
- 3084 预览更新至 PID `96271`，cwd 与隔离 `DSH_HOME` 正确。首页和项目包均 HTTP 200，Boot Manifest revision 为 `82f56af813bc`，实际项目包 `rev=30ead923d91aa295-37` 包含新按钮样式及保留的设置入口。
- 没有启动浏览器、截图或像素比较，视觉效果待用户手动确认；未提交、推送或合并，3080 服务不动。

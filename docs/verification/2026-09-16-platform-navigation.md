# 统一工作台导航与总览验证

## 授权与结果边界

- F025：保留介绍首页，“进入工作台”默认打开总览；平台侧栏提供总览、项目中心、实验室和技能中心。
- 总览读取现有项目与实验室案例事实，提供最近项目直接进入、新建项目和继续已有训练；失败、加载与空状态不冒充真实零值。
- 实验室不依赖项目。首次进入后，切换模块保持原 iframe；返回恢复之前工作面。已有训练字段使用真实接口的 `currentRunId`，不是训练快照中的 `runId`。
- 技能中心仅入口、待接入占位及返回操作，不调用 Skills 目录、安装或执行接口。项目内原有阶段方法保留。
- 未调用付费模型，未进行浏览器自动化、截图或视觉验收，未提交、合并或推送。T006 等待用户手动确认。

## 定向检查

命令工作目录为此 worktree 的 `upstream/deepseek-harness/`。

```sh
corepack pnpm exec vitest run packages/client/ui-fde-project/tests/page-controller.client.spec.ts packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx packages/client/ui-fde-project/tests/project-center-navigation.client.spec.tsx packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx packages/client/ui-fde-project/tests/apply.client.spec.ts packages/client/ui-fde-discovery-lab/tests/navigation.client.spec.tsx packages/client/ui-fde-discovery-lab/tests/page-surface.spec.ts
```

- 首次七文件 29 项通过，覆盖导航、原首页入口、项目中心与时间线返回、真实概况读取状态、继续目标项目、技能无请求边界、Slot 注册/卸载、实验室 iframe 身份保持。
- 随后只对发生修改的 `navigation.client.spec.tsx` 重跑：新增加载失败后显式重试并重建 iframe 的断言，同时以真实 `currentRunId` 字段校准概况夹具；该文件六项通过。合计 30 项不同测试已通过。
- 三个新增/重写导航组件使用仓库 `findUiI18nViolations` 检查，零违规。新增可见文案由 `fdeProject` 的中英文 locale 持有。
- 两个受影响包的既有中英文 README 保持同一合同；`verify-translation-pairing` 仅检查这两对，结果通过。产品规格维持单一简体中文来源。
- 测试日志为 `/tmp/fde-platform-navigation-tests.log` 与 `/tmp/fde-platform-navigation-retry-tests.log`，不提交 Git。

## 隔离运行数据

- 代码基线：主线 `55a7b02a19eae96d426ab616b8ab0f17b83f5fec`；分支 `feature/platform-navigation`。
- Worktree：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.worktrees/platform-navigation`。
- 三个已登记项目复制到本 worktree 的 `.runtime/workspaces/<WorkspaceID>`，共 503 个文件；复制后核对原始字节 SHA-256 与纳秒修改时间。排除依赖、缓存、构建目录、凭证、非示例环境文件、密钥及符号链接。
- Workspace ID 与七个登记 Session ID 保持一致；14 份项目/训练 Session 日志保持原版本文件名和事件帧，只把首个独立 header frame 的工作目录映射至隔离副本。
- 实验室 SQLite 使用只读源连接的 SQLite backup 创建一致副本；素材复用同版本只读构建输入，不访问或复制模型凭证。
- 工作区登记表仅包含三个隔离 Workspace；原项目文件、主运行区与主工作树已有改动保持不动。主服务仍为 3080。

## 构建与在线服务

- 最新 `corepack pnpm run build` 退出 0，完成 Host/Client TypeScript、插件 bundle 与 Web 构建，记录 270 个客户端产物；仅有已存在的大 chunk 提示。日志：`/tmp/fde-platform-navigation-build.log`。
- F025 的 `validate_feature_specs.py . --feature F025 --require-ready` 通过，无错误或警告；`git diff --check` 通过。
- 启动：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3084`。监听 PID `26966`，cwd 为此 worktree 的 `upstream/deepseek-harness/`，进程使用显式隔离 `DSH_HOME`。
- 本地启动链接认证交换为 HTTP 303，建立 Cookie 后首页 HTTP 200；无认证的裸地址要求先登录，未绕过官方认证。
- 首页实际 Boot Manifest revision 为 `c990e547b90f`，62 个条目。读取其声明的两个在线 Client Bundle，均 HTTP 200：项目包包含总览、技能待接入及实验室页面 Slot；实验室包包含概况 Slot、保持挂载的 hidden 行为、重试事件和 `currentRunId` 字段。
- `/fde-discovery-lab/` 与 `/api/fde-discovery-lab/cases` 均 HTTP 200；真实接口返回五个案例，其中一个有已有训练。只进行了读取，没有创建训练或调用模型。
- 三个 Workspace 路径均在隔离 `.runtime/workspaces/`，登记 Session 数依次为 3、2、2。主线 3080 仍由原 PID `198` 提供服务。
- 本轮验证是构建、组件行为及在线资源检查，不等同于浏览器渲染或人工产品验收。

## 首页入口反馈调整

- 根据用户反馈，介绍首页移除独立“业务挖掘实验室”按钮；顶部、首屏、页尾进入动作统一为“进入平台”，全部指向总览。首屏按钮不再绑定项目数量，项目数仍保留在原状态说明中。
- 移除仅服务旧首页入口的 module action Slot 及贡献；平台侧栏、总览实验室卡和项目内实验室入口保持不变。首页布局、生命周期说明和训练功能未变。
- `project-progress-page.client.spec.tsx`、`apply.client.spec.ts`、实验室 `navigation.client.spec.tsx` 共 18 项通过；首页断言覆盖顶部仅一个进入按钮、三处文案一致、均进入总览、不再渲染模块入口。两个包 README 配对校验通过。
- `corepack pnpm run build` 退出 0。日志为 `/tmp/fde-home-entry-tests.log`、`/tmp/fde-home-entry-build.log`。未做浏览器自审。
- PRD、总规格与 F025 增量同步已确认的首页入口规则，沿用原编号与范围。
- 更新预览使用原隔离 DSH_HOME 与 3084，最新 PID `43265`、Boot Manifest revision `34827055f957`；首页及两个实际在线 Bundle 均 HTTP 200，旧首页模块 Slot 已从两包移除，项目包包含统一平台入口文案。此前 PID/revision 仅为上一轮验证记录。

## 产物与清理

- Worktree 约 2.7 GB，其中 `.runtime/` 约 148 MB（项目副本约 138 MB，DSH 状态约 10 MB）；其余主要为本地依赖与构建输出。
- 单次预览准备脚本和路径映射留在被忽略的 `.runtime/`，可以从主线事实源重新生成，不属于产品源码。
- 用户验收后，在代码合并且独有运行数据已保存、服务停止并完成 worktree 状态检查后，才能清理此 worktree 与 Feature 分支。不能直接删除尚未合并的源码或用户在预览中新增的数据。

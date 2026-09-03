# F011 项目中心全屏响应式复刻验证

## 范围与环境

- 分支：`feature/frontend-polish`
- 服务：`http://127.0.0.1:3081`
- 隔离状态：当前 worktree 的 `.runtime/dsh-home`
- 参考图：`/Users/muyu/Desktop/Codex 图像 2026年9月3日 13_30_15.png`
- 参考环境：1536×1024、DPR 1、浏览器缩放 100%、浅色主题
- 扩展验收：1837×1205、DPR 1、浏览器缩放 100%、浅色主题
- 动态边界：参考图与隔离快照的项目名称、阶段、会话、周期和统计值不同；未伪造业务数据，也未用大块忽略区域排除差异。

## 实现结果

- 主内容从固定 `1288px` 改为以参考视口约 `75.52vw` 为基准的流式宽度，并设置桌面安全上下界。
- 1536×1024 下保留 64px 左侧导航轨道后的视觉中心；1040px 以下取消桌面偏移。
- 摘要区、项目集合、项目卡和底部信息区随大桌面视口平滑延展。
- 项目卡使用真实 Grid 行把操作底栏压到卡底，没有使用整页 `transform: scale()` 或浏览器缩放补偿。
- 项目身份色由项目名称稳定散列得到，不依赖阶段加载状态；当前数据分析和知识库快照分别使用绿色和紫色。
- 数据分析项目使用三柱线性 SVG；项目边界、阶段徽标、最近进展底色和主按钮复用同一项目身份色。
- 项目数据、阶段状态、卡片/列表状态和所有动作 handler 未修改。

## 真实验证

1. `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx`
   - 退出状态：0
   - 结果：1 个测试文件、8 项测试通过。
2. `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`
   - 退出状态：0
   - 结果：Node 与 Client Bundle 构建成功；在线 Boot Manifest 加载 `@deepseek-ai/dsh-client-ui-fde-project` 新 revision。
3. 固定视口几何与交互检查
   - 1536×1024：摘要区 `x=220, y=180, width=1160, height=164`；项目集合 `x=220, y=360, width=1160, height=444`。
   - 1837×1205：摘要区 `x=256.84375, y=215.265625, width=1387.296875, height=196.125`；项目集合 `x=256.84375, y=430.53125, width=1387.296875, height=531`。
   - 两个视口的 `scrollWidth` 均等于 `innerWidth`；卡片→列表→卡片切换成功；控制台错误为 0。
4. 参考视口像素差异
   - 完整配色前：`mean_pixel_similarity=0.957101`、`pixels_within_tolerance=0.874980`。
   - 项目身份色、SVG、状态面板和主按钮补齐后：`mean_pixel_similarity=0.957516`、`pixels_within_tolerance=0.873089`。
   - 没有忽略像素区域。差异仍包含真实项目数据、项目顺序和统计文字；全局均值只作记录，不再替代关键区域人工审查。
5. 运行隔离
   - 3081 返回 HTTP 200。
   - 主题为 `light`。
   - Workspace 注册表只指向 `.worktrees/frontend-polish/.runtime/workspaces/` 下的两个隔离快照。

## 未验证与人工确认

- 用户系统 Chrome 当前截图表现符合约 90% 浏览器缩放；该状态不是像素基准。最终人工验收前应使用 `⌘+0` 恢复 100% 后刷新 3081。
- 参考图与当前隔离快照数据不同，因此数据文字和项目排序未声明为像素一致；项目身份配色与 SVG 已按参考视觉实现。
- 移动端没有参考图，本轮只保留既有窄屏规则，不声称移动端高保真。

## llm-wiki 隔离快照更正

- 初次快照误用了已废弃的空目录 `/Users/muyu/llm-wiki-test/llm-wiki`，导致知识库项目只有阶段注册记录而没有项目内 `.fde` 事实。
- 已改为从当前主运行时登记的 `/Users/muyu/llm-wiki/llm-wiki` 创建独立快照，目标为 `.worktrees/frontend-polish/.runtime/workspaces/knowledge-base`。
- 快照共 80KB，包含 `.fde/discovery/artifacts.json`、`.fde/discovery/workflows.json`、`.fde/stages/definition.json`、派生资料、原始资料和交付物；排除了 `.env`、`.runtime`、依赖和构建产物。
- Feature 的 `fde_stage.json` 已把该隔离 Workspace 对齐到主运行时的 `currentStage=solution`、`v2Stage=definition`、`revision=2`，没有复用主 WorkspaceId、会话文件或凭据。
- 真实进入项目验证显示第 1 阶段已完成、第 2/8 阶段为当前阶段、项目记录 3/3、阶段输入 4 项，并能从 Files 查看隔离快照中的 `.fde`、`fde-deliverables` 与 `fde-resources`。
- 验证过程中只在隔离 Workspace 中建立了一条本地会话；主项目和 3080 未写入。

## 临时证据

- 路径：`/tmp/codex-ui-fidelity/FDEDeliveryWorkbench/20260903-project-center-responsive/`
- 内容：visual spec、两轮固定视口截图、差异图和临时 Playwright 脚本。
- 清理条件：用户完成人工验收且不再需要回看本轮像素证据后可安全删除。

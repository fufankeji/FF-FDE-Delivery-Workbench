# 第八阶段上下参考图实现与预览

## 范围与状态

- 用户参考：`/Users/muyu/Desktop/阶段 8 上.png`、`/Users/muyu/Desktop/阶段 8 下.png`，原图均为 1536×1024。作为同一长页面上下部分实现，不新增业务分页。
- 当前分支 `feature/frontend-polish-round-3`，在既有第六、七阶段未提交改动上继续，仅调整第八阶段展示。没有合并、提交或写入业务状态。
- 使用 `ui-fidelity-replication` 的 manual-first 模式；参考 CSS 视口、DPR、浏览器缩放未知。源码按 1 倍工作假设实现，字号分层独立于容器宽度，不整页缩放。
- 终态：`IMPLEMENTED_WITH_GAPS`。上下规格预检均为 `PREFLIGHT_VALID`；完成门禁因人工优先、字体估计、缺少浏览器几何与像素证据返回未通过，不宣称 1:1 视觉验收完成。

## 展示与真实行为

- 深蓝独立插画横幅、大号 08、分组统计、四个既有页签、下一动作区与信号表；下面为本轮固定记录、横向语义依赖和橙色人工评审操作。
- 信号标题和内容来自 `delivery.items`；仅按显式分号分栏，保留模拟和联调限定，没有独立判断时展示已有 criterion。完整原文仍可从详情查看，不注入截图上的 ID、数量或结论。
- 快捷记录按 `improvement-record` 定位并调用原 `openProjectFile`；缺失不可读时禁用。Agent 入口仍只预填草稿。
- 已完成轮次、最近评审 UTC 时间来自既有持久化状态。评审二次确认后仍调用原 `completeV2Stage`，不执行发布或进入第九阶段。带原因返回沿用原接口；未来预览仍只读。
- 继续由阶段页面纵向滚动，扣除既有 Composer 高度与 16px 安全间距；不固定整个内容高度、不把评审溢出裁掉。短屏表格可局部横向滚动，记录卡降为单列。实际尺寸和遮挡待用户人工确认。
- 第六、七阶段不消费第八阶段配色或新内容；公共页签包装使用 `display: contents` 并保留原兄弟区块间距。

## 最窄验证

在本 worktree 的 `upstream/deepseek-harness` 执行：

1. `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false`：退出 0。
2. `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/delivery-stage-panel.client.spec.tsx`：16 项通过、1 项测试查询因两个真实入口同名失败；将查询限定在 tabpanel 后仅重跑 `-t 'shows improvement signals'`：1 项通过。合计 17 项直接行为已验证，未重复运行通过项。
3. 两个 Client 包的 `bundle`：退出 0；`corepack pnpm run build:web`：退出 0。保留既有 Vite 大 chunk 提示，未扩大范围重构。
4. 受影响 README 双语对的 `verify-translation-pairing --write` 和定向检查：退出 0。`git diff --check`：退出 0。

未运行浏览器、自主截图、像素对比或全仓测试；测试不替代视觉验收。

## 实际预览

- 仅停止旧 3081 进程 93226，在相同隔离 worktree 启动新进程 95068。
- 启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3081`。
- 3081 与未重启的 3080 均返回 HTTP 200；进程环境提取确认正确 DSH_HOME，Workspace 注册路径全部处于当前 worktree 的 `.runtime/workspaces/`。
- Boot Manifest：`ui-fde-project` rev `51b4bc9e07bd`，在线 Bundle 包含“本轮记录与人工评审”“改进信号表”及新插画路径；`ui-theme` rev `9a2e734ca9d1`，在线包含第八阶段 hero 和 review 色彩角色。
- 在线新插画与本地文件 SHA-256 相同。沿用既有 FDE-Agent 单向同步，无新副本或新监听器；没有把预览写回业务事实源。

## 素材与临时文件

- 使用内置 imagegen 生成独立装饰图，第一版过高过亮，第二版调整为宽幅低对比蓝色面板。图标复用 `DeliveryIcon` 的 SVG；文本、统计和按钮是真实 DOM。
- 最终项目资产：`upstream/deepseek-harness/apps/web/public/fde-dashboard/improvement-panels.png`，2160×728，1,053,060 字节（约 1 MB）。这是页面直接依赖的运行资产，不能作为临时截图删除。
- 第二版原图：`/Users/muyu/.codex/generated_images/01a065a9-3f7d-7531-bc0b-b2056195f564/exec-b0b022f9-3344-4a99-b8c8-d71eb5b580ed.png`（约 1 MB）；未采用第一版为同目录 `exec-348038c8-e409-4e12-809f-414673654035.png`（约 1.7 MB）。均保留原件；确认项目资产后原图可按用户意愿清理，不影响运行。
- 临时规格与素材清单：`/tmp/fde-stage8-fidelity.YYQHnk`，约 48 KB。来源为本轮参考图与实现，供本轮人工验收补充；验收后可删除，通过文档和参考图重新生成。不进 Git，无浏览器配置或录屏。
- 最终编辑提示词（内置 imagegen；输入为第一版独立装饰图）：

```text
Edit this decorative image for a short, wide dashboard hero. Keep the three blue glass panels and fine circuit-line vocabulary. Change the composition to very wide 3:1 landscape, panels much shorter and wider, arranged horizontally with shallow overlaps. Remove all charts, donut rings, bar graphs, spheres and wave ribbons: panels contain only sparse horizontal abstract blue line bars, right panel two little checkboxes. Dim glass illumination substantially: subtle low contrast against uniform deep navy #0b3066 background, NO transparent checkerboard, no black background, no bright white edges. The central panel should be about 1.4 times taller than side panels, not a towering portrait. Preserve blue material, no words, no numerals, no extra objects. Final at least 1600x540, wide landscape.
```

插画已单独查看，无乱码或水印；构图和参考并非逐像素一致，最终真实背景中的融合、字号及长短视口上下布局仍需人工确认。

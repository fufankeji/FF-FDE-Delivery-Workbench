# 第六阶段上下两屏参考实现

## 范围与状态

- 参考：`/Users/muyu/Desktop/阶段 6 上.png`、`/Users/muyu/Desktop/阶段 6 下.png`，均为 1430 × 1100 图像；CSS 视口、DPR 和浏览器缩放未经确认。
- 仅调整 V2 第六阶段 `pilot`：深蓝横幅与独立插画、四项统计、等宽三栏证据、语义依赖、三份固定记录、人工评审。第七、八阶段继续原布局。
- 字号按参考估计：横幅标题 30/40，分区标题 18/27，正文 13/21，辅助文字 11/18；不随宽屏整体放大。宽度流动，850px 以下内容单列，500px 以下依赖路径纵向排列。
- 页面沿用阶段容器单一纵向滚动，当前阶段在输入框上方预留空间；历史只读沿用原产品合同隐藏输入框，不复制参考图中可执行输入框。
- 终态：`IMPLEMENTED_WITH_GAPS`。根据 ui-fidelity-replication 技能和仓库 manual-first 规则，未运行浏览器自动化、截图或像素差异；字体、素材在页面中的位置、短窗口尾部与抽屉展开后的几何仍待人工验收。没有提交本轮实现。

## 真实数据和交互边界

- 统计使用 Host 核验后的记录状态；不适用数量单独标注，不计作成功。
- 图谱数量和恢复时长仅从当前记录摘要提取；缺失数量保持未登记，不以参考图数字填充。当前 FDE-Agent 摘要登记 56 实体 / 56 关系及 2 分 10 秒；这是已有联调记录，不是本轮重新执行或验证真实生产。
- Schema、修订、路径、固定文件均读取原快照。证据详情、文件查看、版本清单、刷新、页签、返回当前阶段继续连接真实入口；新增修订复制只写剪贴板。
- 历史与未来预览不提供执行或阶段批准；当前阶段仍需显式二次确认，退回仍需填写原因。

## 工程验证

- `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false`：通过。
- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/delivery-stage-panel.client.spec.tsx`：10 项通过。覆盖原第六至八阶段入口、人工确认、只读，以及本轮真实路径、修订复制、动态数量和缺值展示。
- ui-fde-project、ui-theme Client bundle 与 `build:web`：通过。构建保留已有 chunk 大小提示，未为此扩大重构范围。
- 两组 README 双语配对检查、`git diff --check`：通过。
- 重启仅作用于隔离端口 3081：PID 89999，`DSH_HOME=../../.runtime/dsh-home`；三个 Workspace 路径均位于当前 worktree 的 `.runtime/workspaces/`。main 3080 返回 200，未重启主服务或项目业务服务。
- 从首页 Boot Manifest 读取在线产物：ui-fde-project revision `70eca7b2eb0d`，ui-theme revision `7ca0a8f5ee9a`。在线 JS 包含本轮插画路径、语义区、复制入口和 pilot 色彩角色。
- 在线插画返回 200，SHA-256 与源码文件相同：`0e26fca47f2de5d9db2ad529fab3831c8d5e7ed794b51c72c868cdb834f10ee7`。这证明资源已发布至本地预览，不替代浏览器渲染验收。
- 技能完成门禁返回 `IMPLEMENTED_WITH_GAPS`：manual-first、参考环境未知、字号估计、缺少布局/截图差异以及素材在页面内的人工确认。

## 素材及清理

- 使用内置 AI 图像工具生成独立插画，不将参考页面整图作为背景，也不把按钮文字烘焙进图片。
- 项目资产：`upstream/deepseek-harness/apps/web/public/fde-dashboard/pilot-delivery-lab.png`，1902 × 827，约 1.3 MB。它是页面依赖，不能当临时文件删除。
- 工具原始输出：`/Users/muyu/.codex/generated_images/01a065a9-3f7d-7531-bc0b-b2056195f564/exec-e912f415-1b0a-4267-80c3-d0ac938399f8.png`。第一版生成结果含假透明棋盘，未使用；第二版改为深蓝背景，通过 CSS 边缘蒙版融合到横幅。
- 临时视觉规格和素材清单：`/tmp/fde-stage6-fidelity.HmJDC4`，约 48 KB；源头是用户参考图和本轮组件，可再生成，人工验收结束后可清理。没有新增 worktree、依赖树或数据副本。

最终修订提示词（对第一版独立插画进行编辑）：

> Edit this illustration, change ONLY background and compositing lighting. Replace every white/gray checkerboard square with a seamless solid deep navy blue background exactly #052846. The checkerboard is NOT transparency; REMOVE IT ENTIRELY. Keep the same three stacked translucent blue document clipboards, small blue glass laboratory flask, delicate circuit traces and light dots in exactly the same positions and perspective. Composite the translucent glass naturally onto the dark navy background, with bright ice-blue rim lighting, as in a premium dark-blue software header illustration. Uniform dark navy background all around the outer edges, no border, no text, no UI, no extra objects. Wide landscape canvas. Do not output a transparency grid.

## 人工查看

刷新 `http://127.0.0.1:3081`，进入现有 FDE-Agent 项目，回看第六阶段。确认上方三栏等宽，滚动可到达语义依赖、固定记录与评审区；点击记录看详情、查看文件、复制修订并切换四个页签。再在常用短窗口和展开侧栏时检查遮挡、换行与滚动。不要为视觉验收推进真实项目阶段。

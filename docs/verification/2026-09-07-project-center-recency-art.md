# 项目中心最近操作排序与立体底图

## 本轮范围

- 按用户要求调整项目集合默认排序并替换顶部优先事项卡底图，不修改客户项目事实、阶段推进或顶部待处理动作优先级。
- 使用 feature-spec-planning 增量更新 F002 既有规格、计划与 T011；PRD 与总 Spec confirmed 校验、F002 ready 校验通过。
- 使用内置 imagegen 生成实际图片资产，未使用 CLI 或读取凭证；底图不是界面截图，不含文字、按钮或品牌图形。

## 实现

- 默认排序为最近操作，取 Workspace 创建/更新时间、最新 Session 活动时间、已读取阶段记录更新时间的最大值。卡片、列表、筛选和分页共用排序；快照更新后重排，不使用加载时刻或轮询时间。
- 手动优先事项排序保留；顶部优先事项卡仍按实际待处理动作选择，不以点击浏览自动改变项目优先级。
- 底图右侧使用玻璃、金属、悬浮层与蓝色光效；左侧留出文字空间。图片使用非交互层、空 alt、aria-hidden、右侧 contain 与渐变遮罩，避免截断主体或覆盖操作。
- 资产：[project-priority-depth.webp](../../upstream/deepseek-harness/apps/web/public/fde-dashboard/project-priority-depth.webp)，1881 × 836，119334 字节。PNG 原图保留在 imagegen 默认输出目录；WebP 仅作格式压缩，不改变构图。

## 验证

- 项目中心组件文件 11 项测试通过，覆盖五个项目的会话、阶段、项目更新、无会话创建回退，卡片/列表顺序一致，数据更新重排，手动优先事项排序、筛选、分页与入口保留；装饰图无文本替代和交互角色。
- `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false`、Client `bundle` 与 `build:web` 均退出 0。
- README 中英文配对记录更新且单对校验通过；未修改产品规格的语言约定。
- 仅重启主工作树 3080，PID `88253`，显式 `DSH_HOME=../../.runtime/dsh-home`。
- 首页返回 HTTP 200；Boot Manifest 的项目 Client revision 为 `700fb37df6f8`，在线 SHA-256 为 `61c7dfbdb942a78b551b14dd8524da6312ec0d9761793c61cd2a7b210c3a3592`，与本地一致，包含最近操作文案和新图片引用。
- 图片 URL 返回 HTTP 200，在线与本地 SHA-256 均为 `88770e32b299a62cfad7c829ec16a08d4a9b8eed6ffa546fecf784e96cc7c0af`。
- Workspace 登记 SHA-256 重启前后保持 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，原三个项目保持不变，未操作 3081、4177 或客户项目数据。

## 视觉确认边界

已检查生成图主体、无文字约束、左右构图与保存结果。按仓库人工优先规则，未启动浏览器自审、截图或视觉回放；整体页面效果由用户刷新 3080 确认。未提交 Git，保留上一轮已有的测试修正。

## 生图最终提示词

内置工具模式，单次生成，无外部参考图片输入；以下为实际提交的提示词：

```text
Use case: stylized-concept. Asset type: production website hero background for an enterprise AI project delivery workbench, not a UI mockup. Create one premium cinematic 3D render, very wide 3:1 composition, 3072 x 1024. The left 52 percent is quiet uninterrupted midnight navy negative space for live white interface text, smoothly blending into the scene. On the right, a meticulously designed floating multi-layer computational structure: five offset precision-cut sapphire glass and dark titanium plates with substantial bevelled thickness, visibly separated at different heights above a recessed circular platform; a small brilliant cyan crystalline core suspended between the layers; fine luminous circuit paths connecting a few small satellite components. Strong perspective depth, overlapping foreground and background, realistic refraction, dark polished metal, subtle floor reflection and contact shadows, delicate volumetric blue light, a few restrained glowing particles. The entire structure is contained within the right 46 percent with generous edge margins. Art-directed futuristic enterprise software visual, elegant and sophisticated, tactile physical materials, high detail, vivid electric blue and cyan accents on deep navy, crisp geometry with atmospheric distance. Clear three-dimensional volume and hierarchy, not thin flat transparent document sheets. No text, letters, numbers, logos, buttons, charts, border, watermark, people, wireframe spheres, excessive grid lines, fog covering the subject, or bright highlights behind the left text area. Full bleed background with dark navy at all outer edges.
```

# 第五阶段参考图布局

## 范围与状态

- 参考：用户 `/Users/muyu/Desktop/阶段 5.png`，1430×1100 像素。CSS 视口、DPR 和缩放未知，数字仅为实现预览假设。
- `ui-fidelity-replication`：extended / manual-first；视觉规格预检 `PREFLIGHT_VALID`，不代表高保真通过。未打开浏览器或生成自动截图。
- 页面限定 `EvaluationStagePanel`；初版新增的宿主输入框隐藏规则已在空白反馈后撤回，当前保留原有容器、常驻输入框与高度预留。未修改客户数据、运行服务实现、指纹计算或阶段门条件。
- 素材规格位于临时目录 `/tmp/fde-stage5-fidelity-dIyU82`，由参考图和源码可重建，验收后可删除，不提交 Git。

## 实现与保留行为

- 阶段横幅、等宽双栏、真实运行状态、SVG 图标、紧凑空态、登记信息与验收材料分组。
- 字号按角色区分：页面标题 28px、分区标题 20px、正文及按钮 13px、辅助文字 11px；不随宽屏整体放大。
- 信息页独立纵向滚动；指标表保留横向滚动；记录、阻塞详情和返回表单自然展开，不固定裁切面板。
- 补充记录入口复用 `prepareStageDraft`，进入原生 Agent 对话，不自动发送且保留已有草稿。历史页不提供补充、启动、验证和阶段验收操作。
- 版本与指标登记、阶段状态、材料状态分别读取真实字段。截图中的五项待核对、未启动和未形成不是硬编码。

## 验证记录

- 类型检查：`tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` 退出 0。
- 初次定向组件测试 24/25 通过；新增登记摘要使版本号合法出现在两处，原断言改为查询版本标题，未删除业务断言。
- 修正查询后定向组件测试 25/25 通过；Client UI FDE Project 和 UI Conversation 两包 bundle 退出 0，`git diff --check` 通过。
- 隔离预览 3081 监听 PID 54692，DSH_HOME 为 `../../.runtime/dsh-home`，首页 HTTP 200。Boot Manifest 在线 Project Bundle `0e4790e6b563` 包含新增补充记录与分组标记；Conversation Bundle `a9d67de592cf` 包含第五阶段信息页专属输入框规则。
- 最终素材门禁输出 `IMPLEMENTED_WITH_GAPS`：manual-first、环境与字体估计、插画缺口、缺少视觉与布局证据，均不能用构建或 HTTP 成功替代。保留未提交实现，未宣称 1:1 验收通过。

## 未验证

- 用户随后反馈第五阶段整页空白。已撤回本轮整页 Flex / 100% 高度和隐藏常驻输入容器的组合改动，恢复原有 block 与输入框高度预留；新卡片内容和操作保留。尚未获得实际 DOM / 控制台，因此不能把这两个可疑改动宣称为已证实的根因，也不能以构建成功声称空白已解决。已申请本次只读浏览器排查授权。

- 页头实验插画原素材不存在；本轮用户明确要求 AI 生图后，改用内置 imagegen 生成独立透明装饰插画，未裁取用户整页图片。见下方本轮补充。
- 未做像素差异、实际视口几何或短窗口截图验收；真实满指标状态不可取得，不向项目造数据。已有组件夹具覆盖指标、运行、失败、过期、二次确认和历史只读，但不是满数据视觉证据。

## 插画与配色补充

- 用户最新缺陷图：`/var/folders/rr/5rgrq49n6w38xlfcwfyp7qwr0000gn/T/codex-clipboard-k7Pelq.png`（current-defect）。截图证明主内容已恢复，但页头缺插画，按钮灰蓝、卡片透出背景。
- 新增回归项：`cobalt-primary-not-muted-theme`、`opaque-white-card-not-cat-overlay`、`generated-lab-art-contained`、`lab-art-not-over-title`。已登记在临时视觉规格中，缺少实际浏览器证据，均未关闭。
- 素材：内置 imagegen，原始 1536×1024 透明 PNG，保留在 `/Users/muyu/.codex/generated_images/01a065a9-3f7d-7531-bc0b-b2056195f564/exec-0eeb2c5d-01e6-4552-9b47-a0ec84e2131b.png`。仅格式压缩为 768×512 WebP，保留 alpha，86,622 字节，项目路径 `upstream/deepseek-harness/apps/web/public/fde-dashboard/evaluation-lab.webp`；这是运行所需资产，不是整页截图。
- 配色由 `ui-theme/src/styles/fde-evaluation.css` 持有，仅限定第五阶段面板：亮蓝 `#004cff`、不透明白卡片、浅色画布、深海军蓝横幅与金色待验证标签。其他阶段和外壳不变；深色主题保留原基础表面配色。数值是参考图视觉校准的实现目标，未声称逐像素取色一致。
- 插画使用独立无交互 DOM 区，宽度参与横向布局；窄于 760px 隐藏装饰，不遮挡真实标题和按钮。未修改阶段状态机、启动/验证动作、数据或滚动容器。
- 最窄检查：Stage Workbench 25 项和主题样式生命周期 1 项，共 26/26 通过；Project、Theme Bundle 和 Web 资产构建均退出 0。
- 3081 以显式 `DSH_HOME=../../.runtime/dsh-home` 重启，监听 PID 57633。Boot Manifest 中 Project rev=`4329e413c666`、Theme rev=`976c9a2d8c24`，在线包分别包含新素材路径与限定配色；旧输入框隐藏标记不存在。图片 HTTP 200、字节数与本地 SHA-256 一致；3080 未重启且 HTTP 200。
- 仍为 `IMPLEMENTED_WITH_GAPS`：按 manual-first 提供实现预览，不自动打开浏览器；实际颜色层叠、插画位置和响应式显示待人工确认，未提交。

### 实际生图提示词（内置工具）

```text
Use case: stylized-concept. Asset type: a single decorative 3D illustration for the header of a professional SaaS software evaluation workbench. Generate ONLY the illustration, no UI, no page mockup. Subject: an upright pale ice-blue laboratory clipboard, slightly tilted clockwise in three-quarter perspective, with a few embossed blank horizontal checklist bars, a glass magnifying lens leaning across its lower right, one small conical laboratory flask on the left and a round-bottom laboratory flask on the right. Composition: compact centered group, wide 3:2 canvas, all objects fully visible, modest transparent breathing room, clipboard taller than flasks. Materials: polished translucent blue glass, frosted ice-blue clipboard surface, crisp silvery blue rims, subtle cyan edge highlights and convincing depth, tasteful premium enterprise software style. Lighting: luminous soft blue frontal studio lighting with restrained glow, intended to sit on a very dark navy #062343 banner. Color palette: ice blue, cobalt blue, translucent cyan and cool white, no purple, no warm colors. Background: genuinely transparent alpha, not a checkerboard graphic, no opaque rectangle, no floor. Constraints: no readable text, no letters, no numbers, no logos, no watermark, no buttons or status badges, no extra objects. Generate at least 1024 pixels wide, sharp enough to display at 260 by 150 CSS pixels.
```

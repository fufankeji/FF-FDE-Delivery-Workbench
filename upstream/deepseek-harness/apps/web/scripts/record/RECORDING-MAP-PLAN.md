# 源码扫描与录制计划 · 生成剧本前必读

> 目标：先看清项目，再决定怎么录。不要从用户一句话直接脑补剧本。

## 1 · 什么时候必须读

凡是要新写录制剧本，都先读本文件，再写 JSON：

- 录完整项目展示视频
- 分功能点分别录制
- 根据用户描述录指定操作
- 给已有项目第一次建立录制能力

只有两类情况可以跳过：用户明确给了已验证剧本，或本次只是在修复录制/字幕/ffmpeg 问题。

## 2 · 第一步：源码扫描，生成 recording-map

扫描目标不是理解全部业务，而是判断“能不能录、怎么录”。

**先复用功能身份，再补录制信息**：若 `_docs/feature-discovery.json`、`journey-map.json` 或
`feature-manifest.json` 已存在，`features[].key` 必须原样继承，recording-map 只补
`entry` / `selectors` / `waits` / `scrolls` / `recordability`。只有完全没有上游功能目录时，
才在本步骤创建 `feat-...` key；一旦 recording-plan 经用户确认，后续不得重编号。遗留 map 的
`id` 可读，但新产物统一写 `key`。

> **无路由 SPA 怎么办**：没有真实 URL 路由时，`routes[]` 只会有一条代表应用整体外壳的伪路由（比如 `path: "/"`），其余 tab/phase/模式不是独立路由，归到这一条路由的 `modes[]`/`interactions[]` 下，靠点击/state 区分，不靠 path 区分。对应地，`features[].entry` 用 `clickPath`（有序 selector 数组，从源码反推出"从首屏到这个功能要点哪几步"，不是开着浏览器试错点出来的）代替 `route`+`selector`，见下方 JSON 示例的第二条 feature。

优先扫描：

- 路由：`app/`、`pages/`、`src/app/`、`src/pages/`、router 配置、导航链接
- 页面：每个路由的首屏、长页面 section、详情页、编辑页、结果页
- 页面模式：tab、sidebar item、view mode、空状态、loading、结果态、modal、drawer
- 可交互元素：`a[href]`、`button`、`input`、`textarea`、`select`、`form`、`data-testid`
- 行为证据：`onClick`、`onSubmit`、`href`、`router.push`、state 更新、API 调用、mock/fallback
- 等待点：上传、搜索、AI 生成、接口返回、动画结束、结果 selector 出现
  - ⚠️ **AI/流式输出类功能**的 `waitFor` selector 文字（如 `"text=排查 db 层回调用法"`）**无法从源码扫描中得到**——那是运行时 AI 生成的内容；必须先实际运行一次应用，观察输出后才能确定可用的等待 selector。扫描阶段只能标注"有 AI 输出"，具体 selector 留到试录时确认
- 滚动点：长首页用 `scrollFull`；结果区/详情区用 `scrollBy`；固定 section 用 `scene`

输出到目标项目：

```text
scripts/record/recording-map.md
scripts/record/recording-map.json
```

`recording-map.md` 面向人读，`recording-map.json` 面向后续生成剧本。

最小 JSON 结构：

```jsonc
{
  "project": "项目名",
  "routes": [
    {
      "path": "/",
      "title": "首页",
      "purpose": "展示核心价值与入口",
      "sections": [
        { "name": "Hero", "selector": "section[data-testid='hero']", "scroll": "scene" }
      ],
      "modes": [
        { "name": "默认态", "entry": "/", "notes": "首屏冷启动" }
      ],
      "interactions": [
        {
          "name": "进入知识点拆分",
          "selector": "a[href='/split']",
          "action": "click",
          "feedback": "route:/split",
          "waitFor": null,
          "recordability": "ready"
        }
      ],
      "scrollPlan": [
        { "type": "scrollFull", "reason": "首页长页面需要完整浏览" }
      ]
    }
  ],
  "features": [
    {
      "key": "feat-01-split",
      "name": "知识点拆分",
      "entry": { "route": "/split", "selector": "a[href='/split']" },
      "steps": [
        "进入拆分页",
        "输入主题或上传材料",
        "点击生成",
        "等待结果卡片出现",
        "滚动展示结果"
      ],
      "selectors": {
        "input": "[data-testid='split-input']",
        "submit": "[data-testid='split-submit']",
        "result": "[data-testid='split-result']"
      },
      "waits": [
        { "after": "submit", "selector": "[data-testid='split-result']", "timeout": 30000 }
      ],
      "scrolls": [
        { "after": "result", "action": "scrollBy", "y": 320 }
      ],
      "recordability": "ready",
      "evidence": "submit 有 onClick，result selector 存在"
    },
    {
      "key": "feat-02-agent-platform",
      "name": "Agent 平台",
      "entry": { "clickPath": ["button.nbo-g-btn-ghost", "[data-testid='nav-agent']", "[data-testid='tab-agent-admin']"] },
      "steps": [
        "进入自由探索模式",
        "切到 Agent 面板",
        "打开 Agent 管理 tab"
      ],
      "selectors": {
        "panel": "[data-testid='agent-manager']"
      },
      "waits": [
        { "after": "Agent 管理", "selector": "[data-testid='agent-manager']", "timeout": 15000 }
      ],
      "scrolls": [],
      "recordability": "ready",
      "evidence": "无真实路由的 SPA，靠 state 切换到这个面板，entry 用 clickPath 而不是 route"
    }
  ]
}
```

`entry` 字段二选一：有真实路由的功能填 `{route, selector}`；无路由 SPA 靠点击/状态切换到达的功能填 `{clickPath: [...]}`。
`key` 是跨产物身份，不是本文件内部序号；禁止用 recording-map 的扫描顺序覆盖已确认 key。

## 3 · 可录性分级

扫描时必须给每个功能打标：

| 标记 | 含义 | 后续处理 |
|---|---|---|
| `ready` | 真实交互 + 可见反馈 | 可以录，字幕可以正常描述功能 |
| `mock-visible` | mock/静态数据/fallback，但画面反馈完整 | 可以录，字幕必须中性，不说“真实/实时/已接入” |
| `blocked` | 死按钮、无反馈、页面空、selector 不稳定 | 不录；必须删掉或先修功能 |

后续 `PRE-RECORD-AUDIT.md` 只能允许 `ready` 和 `mock-visible` 进入剧本，禁止录 `blocked`。

## 4 · 第二步：理解意图，生成 recording-plan

根据用户话术选择一种模式：

| 模式 | 用户意图 | 剧本产物 |
|---|---|---|
| `full-project` | “录完整项目 / 展示所有功能 / 出一支总片” | 先选核心运行旅程，再产 `scripts/record/scripts/main-flow.json` |
| `feature-batch` | “每个功能点单独录 / 分开录所有功能” | `scripts/record/scripts/feat-01-*.json` 等多份 |
| `described-operation` | “按我说的操作录 / 录某个具体功能” | `scripts/record/scripts/custom-*.json` 或 `feat-*.json` |

### full-project 的旅程门

`full-project` 不能从路由顺序或 recording-map 的 `features[]` 直接拼总片。被上游编排时，
由上游传入已确认 `journey-map.json` 的绝对路径；独立调用时先查 `scripts/record/journey-map.json`。
没有时，按同项目 `product-showcase/references/JOURNEY-MAP.md` 的契约在
`scripts/record/journey-map.json` 生成最小旅程地图并让用户确认。它至少要说明：

- 选中的 `journey key`、涉及的 `featureKeys`、最终 `visibleResult` 和 `moneyShot`；
- 每条旅程的 `setup` / `reset` / 试跑结论，只有 `feasibility.status=verified` 才能进 Plan；
- 每条旅程的 `operationEvidence`：结果来源、状态证据 key、真实试跑、外部副作用与复位；
- 每个已发现功能的去向：`journey` / `standalone` / `excluded + reason`，禁止静默漏掉核心功能；
- 选择理由必须同时考虑核心性、步骤因果、结果可见、技术辨识度、观众清晰度与可复现性。

主旅程必须包含“操作前基线 → 输入或选择 → 提交/生成/保存等触发 → 本轮新结果或状态变化”。
只导航、切 Tab、展开设置或输入但不提交的素材只能标为 `feature-overview`，不能充当主演示。

若同项目安装了 `product-showcase`，进入 recording-plan 前运行其
`assets/validate-journey-map.mjs`。该旅程层用于选择和表达项目核心链路，不替代 recording-map
对 selector、等待点和真实可录性的验证。

输出到目标项目：

```text
scripts/record/recording-plan.md
scripts/record/recording-plan.json
```

计划必须先给用户确认，再写剧本。不要跳过确认门。

计划至少包含：

- 录制模式：`full-project` / `feature-batch` / `described-operation`
- 确认模式：独立录制用 `standalone-staged`；上游完整流水线用 `pipeline-batched`
- `approval`：已批准范围、`visualPolicy` 和对应 `reviewPolicy`；不得把上游 Skill 自己当用户授权
- `recordings[]`：每段的 `kind`（`journey` / `operation` / `feature-overview`）、
  journey key / feature key、顺序、项目相对剧本路径和预计产物
- 明确不录的功能及原因
- `full-project` 的覆盖对账结果，以及每条旅程要证明的可见结果与高潮画面
- `journey` / `operation` 的 `operationEvidence`：`live-result` 或 `fixture-result`、
  `evidenceKey`、结果说明、真实试跑、外部副作用、授权或 fixture 披露
- 每段入口路由、关键 selector、等待点、滚动点
- 测试数据与复位：输入文案、上传样例、搜索词、账号编号、setup、reset、预期终态
- 字幕草案：只写功能描述，不写品牌口号
- 风险：mock、慢接口、需要登录、死按钮、selector 不稳定

`described-operation` 匹配不到入口或关键动作时，只问一个最小澄清问题，例如：

```text
我找到两个可能入口：/split 和 /library。你要录哪个？
```

不要在缺入口时硬写剧本。

## 5 · 由 plan 生成剧本

剧本必须从 `recording-plan` 生成，不直接从用户原话生成。

生成规则：

1. 首跳可以用 `navigate`，之后页面切换必须 `moveTo` + `click` 导航。
2. selector 优先级：`data-testid` > 精确 `a[href]` > role/name > 稳定 id/class > 文案匹配。
3. 每个 `click` 前后都要有鼠标路径；点完回主内容区。
4. 主旅程在触发前用 `captureState` 捕获基线，触发后用同 key 的
   `waitForStateChange` 等待真实变化；普通 `waitFor` 不能替代结果证明。
5. 长页面用 `scrollFull`；结果区用小步 `scrollBy`；固定 section 用 `scene`。
6. `mock-visible` 功能可以录，但字幕中性化。
7. `blocked` 功能不得进入剧本。
8. `full-project` 的 step 顺序必须保持旅程因果，不能为了页面相邻把链路拆回页面巡游。
9. 写完剧本后必须继续走 `PRE-RECORD-AUDIT.md`。
10. 先运行 `pnpm record:validate`；不通过不得执行 `record:raw`，也不得称为完整运行演示。
11. `pipeline-batched` 已获一次性授权后，用慢速预演、结果门禁和抽帧审计跑到成品；
    不再为素版、放大或字幕逐段停轮，除非出现授权外的新风险或范围变化。

文件命名：

- 完整项目：`main-flow.json`
- 分功能点：`feat-01-xxx.json`、`feat-02-xxx.json`
- 指定操作：`custom-xxx.json`；若能归入功能点，也可用 `feat-xx-xxx.json`

## 6 · 与 feature-showcase-builder 的边界

`showreel-recorder` 只负责：

- 扫源码
- 生成录制地图
- 生成录制计划
- 生成一份或多份 JSON 剧本
- 录出一支或多支视频

不要在本 skill 里生成 HTML 功能画廊。需要视频卡片展示页时，交给 `feature-showcase-builder`。

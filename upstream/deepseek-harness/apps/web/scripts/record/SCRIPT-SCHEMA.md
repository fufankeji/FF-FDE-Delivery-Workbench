# 剧本 schema 速查 · runner.mjs 真支持的 action

> runner.mjs 是 source of truth。本文档摘录所有可用 action 与字段，方便写新剧本时即查即用。

## 顶层字段

```jsonc
{
  "name": "剧本名 · 仅打印用",
  "baseUrl": "http://127.0.0.1:3333",      // 必填 · dev server 地址 · 用 127.0.0.1 不用 localhost（避免部分环境 IPv6 解析卡 30s 超时）
  "demonstration": {                        // journey / operation 必填，且与 recording-plan 一致
    "kind": "journey",
    "mode": "live-result",
    "evidenceKey": "generated-report",
    "resultDescription": "本轮操作后出现新报告"
  },
  "viewport": { "width": 1920, "height": 1080 },
  "slowMo": 0,                              // 全局 step 间减速 ms · 调试用 · 也可 RECORD_SLOWMO=300 env 覆盖
  "speedup": 1.0,                           // ffmpeg setpts 倍速 · 1=原速 · 2=2x · 1.5=1.5x
  "subtitleColors": {                       // 可选 · 覆盖 orange-sticker / title-card 的 CSS 变量
    "text":   "#4ADE80",                    // --rec-text
    "stroke": "#064E3B",                    // --rec-stroke
    "glow":   "rgba(74, 222, 128, 0.40)"   // --rec-glow
  },
  "zooms": [                                // 可选 · zoompan 放大区间列表
    {
      "from": 47.0, "to": 50.5,            // WebM 实际秒数（由 record:raw 日志 t= 标定）
      "scale": 1.5,                         // 放大倍数（1.5 裁 2/3 区域；2.0 裁 1/2 区域）
      "cx": 285, "cy": 325,                 // 放大中心点像素坐标（或用 grid 字段替代）
      "easeIn": 0.8, "easeOut": 0.8,
      "subtitle": { "text": "匹配字幕文字", "position": "tr" }, // 可选 · 用于字幕补偿文字匹配
      "label": "说明标签 · 不影响输出"
    }
  ],
  "steps": [ ... ]
}
```

## step 通用字段

| 字段 | 类型 | 含义 |
|---|---|---|
| `action` | string | 必填 · 见下表 |
| `at` | string | 时序注释如 `"0:12"` · 仅打印 · 不参与逻辑 · **实际录制时间看 runner 打印的 `t=Xs`**，每个 moveTo/click 约消耗 350ms，`at` 标注与实际时间会有偏差 |
| `subtitle` | string | 在该 step 开始时显示字幕（除 `subtitle` action 自身外都可附带） |
| `subtitleHold` | number | 与 `subtitle` 同用 · 字幕停留毫秒（默认无限直到 clear）· `hold` 是别名，两者等价 |

## action 列表

| action | 主要字段 | 说明 |
|---|---|---|
| `navigate` | `url` · `settleMs` (默认 600) | 跳路由 · settleMs 等 hydration · ⚠️ Next.js 首跳建议 ≥ 1500 |
| `wait` | `ms` (默认 1000) | 死等 |
| `subtitle` | `text` · `hold` (默认 1500ms) | 仅显示字幕 · 不滚不动 · `hold=0` 立刻清 |
| `subtitleClear` | — | 立刻清字幕 |
| `scene` | `anchor` · `framing` · `settleMs` · `subtitle` · `hold` · `scrollDuration` | **强烈推荐 · 字幕锚点原子单元**（见下） |
| `scrollTo` | `y` · `duration` (默认 1500) | 平滑滚到绝对 y · 缓动函数 ease-out cubic |
| `scrollBy` | `y` · `duration` (默认 1500) | 相对滚动 · ⚠️ 紧跟 `subtitle` 会触发 lint "字幕飘"违规 · 改用 `scene` |
| `scrollFull` | `chunkY` (默认 900) · `duration` (默认 1600) · `settleMs` (默认 100) | **自动滚到底** · 每步 ≤ chunkY px · 每步后重新读 scrollHeight · 懒加载页面也能滚完 |
| `moveTo` | `selector` 或 `x,y` · `steps` (默认 30) · `moveMs` (默认 350) | 仅移动鼠标 · 不点 |
| `click` | `selector` 或 `x,y` · `steps` (默认 30) · `moveMs` (默认 350) · `preClickMs` (默认 140) | 移动 + 点击 · 自动等元素可见 · ⚠️ `x,y` 坐标形式直接点击（无 glideTo 移动动画）——通常先加 `moveTo` |
| `type` | `selector` · `text` · `speed` (默认 80ms/字符) | 自动 click + 清空 + 逐字打字 |
| `waitFor` | `selector` · `timeout` (默认 15000) | 等元素出现 |
| `captureState` | `key` · `selector` · `read` · `attribute` | 触发前读取结果基线；`read` 支持 count/text/value/checked/attribute/url |
| `waitForStateChange` | `key` · `timeout`，可覆盖 `selector/read/attribute` | 等同 key 的状态与基线不同；超时即失败 |

## scene action · 字幕锚点的唯一正确方式

```jsonc
{
  "action": "scene",
  "anchor": "#features",                     // (a) CSS selector（字符串形式，任何合法 CSS selector 或 text=xxx 均可）
  // "anchor": { "y": 1200 },                // (b) 滚到绝对 y
  // "anchor": { "scrollBy": 700 },          // (c) 相对滚动
  // ⚠️ anchor: { "selector": "..." } 对象形式 runner 不支持！会静默跳过滚动。
  //    要用 selector 定位，直接写字符串：`"anchor": "text=任务摘要"` 或 `"anchor": ".my-section"`
  "framing": "center",                       // 'center' (默认) | 'top'
  "scrollDuration": 1200,                    // 滚动时长 ms · 默认 1200
  "settleMs": 400,                           // 滚完等 fade-up / 图片渲染稳的缓冲
  "subtitle": "支持 6 工位等距俯视图调度",
  "hold": 6000                               // 字幕停留 ms
}
```

**内部时序**：滚到锚点 → wait settleMs → 出字幕 → wait hold → 下一步。
保证字幕一定绑死在视口可见的元素上，不会"飘在空白画面"。

## 运行结果证据

完整项目主旅程和指定操作必须形成以下顺序：

```jsonc
[
  {
    "action": "captureState",
    "key": "generated-report",
    "selector": "[data-testid='report-card']",
    "read": "count"
  },
  {
    "action": "click",
    "selector": "[data-testid='run-research']"
  },
  {
    "action": "waitForStateChange",
    "key": "generated-report",
    "timeout": 60000
  }
]
```

普通 `waitFor` 只证明元素可见；若元素在触发前已经存在，它不能证明本轮操作产生了结果。
生成剧本后先运行 `pnpm record:validate`。仅导航、切换或展开的剧本必须标成
`feature-overview`，不能作为完整项目主片。

## 字幕速记

**内容原则**：纯功能描述，让完全不懂代码的运营/老板/客户一眼看懂——不是 slogan，不是 PPT 备注。

- 长度 8–19 个汉字（hard 上限 **22 字符** · linter 强制 · 超出 exit 2）
- 句式从 SUBTITLE-STYLE 8 句中挑（支持/一键/自动/实时/精准/实现/基于/N 类）
- 5 禁令：比喻 / 第二人称 / 诗意 / 过渡词 / 教学元说明

**视觉规格（透明底大字）**：
- 字体：`"旁门正道标题体"` · 降级 `"PingFang SC", "Microsoft YaHei", sans-serif`
- 字号：56px（角落日常）/ 64px（mc 开场；zoom 补偿基数，zoom 区域内按 `Math.round(64/scale)` 缩小）
- 颜色：由 `subtitleColors` CSS 变量控制；**不填时用 orange-sticker 默认配色（白字 + 橙色描边/发光）**；填了则覆盖（顶层 `subtitleColors` 块里的绿色示例值是项目级 override，不是默认值）
- 主题：日常用 `orange-sticker`（2px 描边）· 开场项目名用 `title-card`（3px 描边 + 更强光晕）
- 背景：完全透明（不要黑色块）

**位置规范（强制）**：
- 开场第一条 → `mc`（上下左右真居中）· 写项目名字
- 日常字幕 → `bl`（左下）/ `tr`（右上）交替轮换 · 贴边贴角
- 收尾字幕 → `bl` 或 `tr`
- ❌ 连续两条不能停同一角 · ❌ `mc` 只留开场 · ❌ `bc` 已废弃

**剧本编排三原则（必须全部满足）**：
1. **全程模拟鼠标路径** — 每次 `click` 前必须有 `moveTo` 把鼠标移到目标，点完必须有 `moveTo` 把鼠标移回主内容区中心；页面切换优先用 `click 侧边栏链接`，不用 `navigate` URL 跳转
2. **充分点击展示功能** — 每个演示的功能点必须有真实的 `click` 交互，不能只是滚动看看或 `scene` 对准就算演示
3. **充分滚轮展示内容** — 不能只靠 `scene` 的 scrollIntoView 跳切；必须让观众看到页面被真实滚动浏览：
   - **长页面/首页** → 用 `scrollFull`，自动滚到底，无需估算页面高度
   - **短距离精确滚动**（如功能页展示结果区域）→ 用 `scrollBy`，`y` ≤ 350px/步

**鼠标与侧边栏**：
- 侧边栏导航链接**只在页面切换时短暂经过**，编排固定为：`moveTo 侧边栏链接` → `click` → `moveTo (720,450) 主内容区`
- ❌ 侧边栏以外的任何时间，鼠标必须在主内容区——否则 `scrollBy`/`wheel` 的滚动事件会被侧边栏吃掉，主内容区没有滚动效果
- `scrollDuration` 建议 1000–1500ms，不低于 800ms，连续滚动间加 `settleMs: 300–400`

**滚动节奏规范**：
- 手动 `scrollBy` 每步 `y` ≤ **350px**——`scrollFull` 的内部分块（默认 900px）不受此限制，两者分工不同
- 功能页节奏：**click 触发** → `waitFor` 结果 → `moveTo (720,450)` → `scrollBy` 展示结果 → 切换页面
- **`scrollFull` 默认参数** chunkY=900 / duration=1600 / settleMs=100，手感接近 trackpad 大幅滑动

**hold 速查（按重要度分级 · 整体 speedup 建议 1.8–2.0x）**：

| 级别 | 场景 | hold |
|---|---|---|
| 🔥 灵魂时刻 | 产品价值压缩点 · 每视频 ≤ 3 处 | 4500–5500ms |
| ⭐ 核心功能 | 功能展示 + 操作触发 | 3200–4000ms |
| 🌊 过场/导览 | 切场景 / scroll | 2000–2500ms |
| 💨 切换瞬间 | navigate 落地 · 通常无字幕 | 1500–1800ms |

## 环境变量

| ENV | 作用 |
|---|---|
| `RECORD_SLOWMO=300` | 临时全局减速 · 调试肉眼盯每个动作 |
| `RECORD_SKIP_LINT=1` | 绕过字幕 lint · 仅 emergency 用 |
| `RECORD_SKIP_ZOOM=1` | 字幕补偿生效但不加 zoompan · 用 `record:subtitle` 确认字幕位置 |

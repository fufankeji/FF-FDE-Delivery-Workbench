# Subtitle Themes

This recorder supports themed subtitle objects in addition to plain string subtitles.

## Shape

```json
{
  "text": "实时联网搜索",
  "position": "tr",
  "theme": "orange-sticker"
}
```

Fields:

- `text`: `string | string[]`
- `position`: `tl | tr | bl | br | mc` — 角落四选一或正中开场；`bc` 已废弃
- `theme`: `orange-sticker | title-card` — 见下；`cyan-glow` / `default` 已废弃

## Themes

### `orange-sticker` · 日常字幕（默认）

日常解说字幕，runner 自动补默认值，剧本可省略 `theme` 字段不写。

Visual traits:

- 颜色由 `subtitleColors` 顶层字段的 CSS 变量控制（--rec-text / --rec-stroke / --rec-glow）
- 同字体：旁门正道标题体 · 降级 PingFang SC / Microsoft YaHei
- 2px 描边 + 16px 光晕半径

Example:

```json
{
  "action": "subtitle",
  "text": { "text": "实时追踪多源知识摄入全流程", "position": "bl", "theme": "orange-sticker" },
  "hold": 3500
}
```

### `title-card` · 开场项目名专用

用于视频开场第一条字幕（position 固定 `mc`），比 orange-sticker 视觉分量更重。

Visual traits:

- 同色系（复用 subtitleColors CSS 变量）
- 同字体
- 3px 描边（更粗）+ 双层光晕（28px + 52px 半径）
- 字间距更宽（0.06em vs 0.03em）

Example:

```json
{
  "action": "navigate",
  "url": "/",
  "settleMs": 2500,
  "subtitle": { "text": "Cerebellum · LLM 知识图谱", "position": "mc", "theme": "title-card" },
  "subtitleHold": 5000
}
```

### ~~`cyan-glow`~~ · 已废弃

改用 `orange-sticker` 或 `title-card`。

### ~~`default`~~ · 已废弃

改用 `orange-sticker` 或 `title-card`。

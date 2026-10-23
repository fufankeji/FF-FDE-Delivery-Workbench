# Windows 兼容说明

本 skill 的模板默认在 **macOS** 下验证通过（`headless: false` + `deviceScaleFactor: 2` + `pos-tl/tr top: 36px`）。

> ✅ **已自动化**：`install.mjs` 会检测 `process.platform`，在 Windows 上自动把下列三处调整应用到拷贝后的项目副本，不需要手动改。本文件保留作为原理说明 / 排查参考。

---

## W-1 · runner.mjs：headless 模式

**问题**：Windows DPI 缩放（125% / 150%）与 `headless: false` 冲突，导致 viewport 偏移、元素点击坐标错位、视频画面被截断。

**改法**：`scripts/record/runner.mjs` 找到 browser launch 配置：

```js
// 改前（macOS 默认）
headless: false,
args: [
  "--disable-blink-features=AutomationControlled",
  "--no-default-browser-check",
],

// 改后（Windows）
headless: true,
args: [
  "--disable-blink-features=AutomationControlled",
  "--no-default-browser-check",
  "--font-render-hinting=none",           // headless 模式下字体不发虚
  "--disable-font-subpixel-positioning",
  "--force-color-profile=srgb",
],
```

---

## W-2 · runner.mjs：deviceScaleFactor

**问题**：macOS `deviceScaleFactor: 2` 在 Windows 上会造成渲染尺寸翻倍、坐标错位（因为 Windows 已在系统层做了 DPI 缩放）。

**改法**：`scripts/record/runner.mjs` 找到 newContext 配置：

```js
// 改前（macOS 默认）
deviceScaleFactor: 2,  // Retina 高清

// 改后（Windows）
deviceScaleFactor: 1,
```

---

## W-3 · cursor-overlay.css：pos-tl / pos-tr 字幕位置

**问题**：macOS 默认 `top: 36px`（含 OS 标题栏偏移）。Windows `headless: true` 模式下没有 OS 窗口边框，`top: 0` 即视频帧顶边，`36px` 过大导致字幕不贴角落。

**改法**：`scripts/record/inject/cursor-overlay.css`：

```css
/* 改前（macOS 默认） */
.__rec-subtitle-multi.pos-tl { top: 36px;  left: 16px;  }
.__rec-subtitle-multi.pos-tr { top: 36px;  right: 16px; }

/* 改后（Windows · headless · 与 pos-bl bottom: 16px 严格对称）*/
.__rec-subtitle-multi.pos-tl { top: 16px;  left: 16px;  }
.__rec-subtitle-multi.pos-tr { top: 16px;  right: 16px; }
```

**说明**：若项目导航栏较高导致字幕被遮，可根据实际导航栏高度上调（如 `top: 64px`）。

**角落字幕字数上限（Windows YaHei 字体）**：
- 纯中文 ≤ 13 字（13 × 51.68px ≈ 671px < 720px）
- 中英混排 ≤ 14 字（Latin 字符较窄，有余量）
- **禁止**在角落字幕中使用 5 字符以上的 Latin 长词（如 enrichment、deterministic）

---

## W-4 · runner.mjs：系统代理导致 `page.goto` 卡死在 localhost

**问题**：Windows 上若开了系统级代理（VPN / 公司代理 / 部分加速器），Playwright 启动的 Chromium 默认会读取系统代理设置，
导致连 `http://127.0.0.1:5173` 这种纯本地地址也被错误地转发给代理，代理对 localhost 不通或很慢 → `page.goto` 卡到
`Timeout 30000ms exceeded`。**`curl http://127.0.0.1:5173` 在同一台机器上是瞬间 200**——因为 curl 不读 Windows 系统代理，
这个反差是识别这个问题的关键信号：dev server 本身没坏，是 Chromium 的网络层在等代理。

> ✅ 已自动化：`install.mjs` 在 Windows 上会自动给 `args` 加 `--no-proxy-server`，不需要手动改。

**改法**（手动场景参考）：

```js
args: [
  "--disable-blink-features=AutomationControlled",
  "--no-default-browser-check",
  "--font-render-hinting=none",
  "--disable-font-subpixel-positioning",
  "--force-color-profile=srgb",
  "--no-proxy-server",   // ← 避免系统代理拦截 localhost 请求
],
```

**排查信号**：录制脚本第一步 `navigate` 报 `page.goto: Timeout 30000ms exceeded`，但同时 `curl` 直连同一地址立即返回 200——
这就是代理问题，不要去重启 dev server 或加大 timeout，加这条 flag 才是根因修复。这与 W-1 的 IPv6/IPv4 解析问题症状相同
（都是 30s goto 超时）但原因不同，排查时先用 curl 对照确认是否是代理问题。

---

## 四处改动速查表

| 文件 | 改动项 | macOS 默认 | Windows 改为 |
|------|--------|-----------|-------------|
| `runner.mjs` | `headless` | `false` | `true` |
| `runner.mjs` | `args` | 2 个基础 flag | 加 4 个 flag（3 个字体渲染 + `--no-proxy-server`） |
| `runner.mjs` | `deviceScaleFactor` | `2` | `1` |
| `cursor-overlay.css` | `pos-tl/tr top` | `36px` | `16px` |

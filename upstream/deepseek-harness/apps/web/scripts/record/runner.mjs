#!/usr/bin/env node
/**
 * Playwright 录制驱动 · headed Chromium + recordVideo + 虚拟鼠标 + 字幕
 *
 * 平台说明：
 *   macOS 默认 headless: false + deviceScaleFactor: 2（Retina 高清）
 *   Windows 需要手动调整三处，详见 scripts/record/WINDOWS-COMPAT.md
 *
 *   node scripts/record/runner.mjs scripts/record/scripts/hero-scroll.json
 *
 * 输出：
 *   artifacts/recordings/<timestamp>-<scriptname>.webm
 *   artifacts/recordings/<timestamp>-<scriptname>.mp4   （若装了 ffmpeg）
 *
 * 环境变量：
 *   RECORD_RAW=1      素版模式：跳过字幕、zoom、倍速，输出 -raw.mp4
 *   RECORD_SLOWMO=N   每步骤延迟 N ms（调试用）
 *   RECORD_SKIP_LINT=1 跳过字幕 lint（临时绕过）
 */

import { chromium } from "playwright";
import { readFileSync, mkdirSync, renameSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { lintScript } from "./lint-subtitles.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

/* ─────────── CLI ─────────── */

// 不传参数时默认 main-flow.json，方便 package.json 里固定的 record:raw / record:subtitle / record:prod
// 不必为每个 feat-XX 剧本各自硬编码——直接 `pnpm record:raw scripts/record/scripts/feat-01-xxx.json` 覆盖即可。
const scriptArg = process.argv.slice(2).find(arg => !arg.startsWith('--')) || "scripts/record/scripts/01-history.json";
const scriptPath = resolve(scriptArg);
if (!existsSync(scriptPath)) {
  console.error("剧本文件不存在:", scriptPath);
  process.exit(1);
}
const script = JSON.parse(readFileSync(scriptPath, "utf8"));

const baseUrl = script.baseUrl || "http://localhost:3333";
const viewport = script.viewport || { width: 1920, height: 1080 };
const slowMo = Number(process.env.RECORD_SLOWMO ?? script.slowMo ?? 0);
const RAW_MODE  = process.env.RECORD_RAW === "1" || process.argv.includes('--raw');
const SKIP_ZOOM = process.env.RECORD_SKIP_ZOOM === "1" || process.argv.includes('--subtitle');
const PREFLIGHT = process.argv.includes('--preflight');
if (PREFLIGHT) for (const step of script.steps) {
  for(const key of ['hold','subtitleHold','ms','moveMs','preClickMs','settleMs','scrollDuration','duration']) if(step[key]!==undefined)step[key]=60;
  if(step.speed!==undefined)step.speed=1;
}
if (RAW_MODE)  console.log("⚪ RAW 模式 · 仅鼠标 · 无字幕 · 无 zoom · 无倍速\n");
if (SKIP_ZOOM) console.log("🔍 SUBTITLE 模式 · 字幕补偿生效 · 不加 zoompan · 用于确认字幕位置\n");

/* ─────────── 输出路径 ─────────── */

const ts = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .replace("T", "-")
  .slice(0, 19);
const tag = basename(scriptPath, ".json");
const outDir = join(repoRoot, "artifacts/recordings");
mkdirSync(outDir, { recursive: true });

/* ─────────── 注入 cursor + subtitle ─────────── */

const cursorCssRaw = readFileSync(
  join(__dirname, "inject/cursor-overlay.css"),
  "utf8"
);
const cursorJs = readFileSync(
  join(__dirname, "inject/cursor-overlay.js"),
  "utf8"
);

/* ─────────── 字幕配色变量注入 · 仅 orange-sticker 生效 ─────────── */
const _sc = script.subtitleColors ?? {};
const cursorCss = (_sc.stroke || _sc.glow || _sc.text)
  ? `:root{--rec-text:${_sc.text ?? "#ffffff"};--rec-stroke:${_sc.stroke ?? "#d9482f"};--rec-glow:${_sc.glow ?? "rgba(255,209,26,0.50)"}}\n` + cursorCssRaw
  : cursorCssRaw;

/* ─────────── 字幕风格 lint · 违规拒跑 ─────────── */

const violations = lintScript(script);
if (violations.length > 0) {
  console.error(`\n❌ 字幕风格 lint 失败 · ${violations.length} 条违规\n`);
  for (const v of violations) {
    console.error(`  [${v.at || "#" + v.idx}] "${v.text}"`);
    for (const i of v.issues) console.error(`     · ${i.rule}: ${i.msg}`);
    console.error("");
  }
  console.error("→ 请按 scripts/record/SUBTITLE-STYLE.md 重写后再跑");
  console.error("→ 临时绕过：RECORD_SKIP_LINT=1 pnpm record:demo ...\n");
  if (process.env.RECORD_SKIP_LINT !== "1") process.exit(2);
  console.error("⚠️  RECORD_SKIP_LINT=1 · 已绕过 lint · 继续录制\n");
} else if (script.steps.some((s) => s.subtitle || s.action === "subtitle")) {
  console.log(`✅ 字幕风格 lint 通过 (${script.steps.filter(s => s.subtitle || s.action==="subtitle").length} 条字幕)\n`);
}

/* ─────────── zoompan 表达式生成器 ─────────── */

// ffprobe 检测视频帧率，失败时回退 25
function getVideoFps(videoPath) {
  const r = spawnSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=r_frame_rate",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath,
  ], { encoding: "utf8" });
  if (r.status !== 0) return 25;
  const raw = r.stdout.trim();
  const [n, d] = raw.split("/").map(Number);
  return d ? n / d : n || 25;
}

// zooms[] → zoompan filter string
// 用 on/fps 作为时间轴（zoompan 不支持 t 变量）
// from/to 支持秒数（number）或 "M:SS" 字符串
// 重要：from/to 必须是 WebM 实际秒数（newContext 调用时刻起算）
function buildZoompanFilter(zooms, viewport, fps = 30) {
  const W = viewport.width;
  const H = viewport.height;
  const F = fps;

  function sec(t) {
    if (typeof t === "number") return t;
    const p = String(t).split(":").map(Number);
    return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
  }

  const T = `on/${F}`;
  const list = [...zooms].sort((a, b) => sec(a.from) - sec(b.from));

  function pw(segs, def) {
    let expr = String(def);
    for (let i = segs.length - 1; i >= 0; i--) {
      const { f0, f1, v } = segs[i];
      expr = `if(between(${T},${f0},${f1}),${v},${expr})`;
    }
    return expr;
  }

  const zS = [], cxS = [], cyS = [];

  for (const z of list) {
    const f0 = sec(z.from), f1 = sec(z.to);
    const S  = z.scale   ?? 1.5;
    const ei = z.easeIn  ?? 0.8;
    const eo = z.easeOut ?? 0.6;
    const cx = z.cx ?? W / 2;
    const cy = z.cy ?? H / 2;
    const half = (f1 - f0) / 2;
    const hs = f0 + Math.min(ei, half);
    const es = f1 - Math.min(eo, half);
    const eiDur = Math.round((hs - f0) * 1e6) / 1e6;
    const eoDur = Math.round((f1 - es) * 1e6) / 1e6;
    // smoothstep 三次缓动：3t²-2t³，两端慢中间快，无线性抖动
    const zV =
      `if(lt(${T},${hs}),` +
        `1+(${S}-1)*(3*pow((${T}-${f0})/${eiDur},2)-2*pow((${T}-${f0})/${eiDur},3)),` +
        `if(lt(${T},${es}),${S},` +
          `${S}-(${S}-1)*(3*pow((${T}-${es})/${eoDur},2)-2*pow((${T}-${es})/${eoDur},3))))`;
    zS.push({ f0, f1, v: zV });
    cxS.push({ f0, f1, v: String(cx) });
    cyS.push({ f0, f1, v: String(cy) });
  }

  const zE  = pw(zS, 1);
  const cxE = pw(cxS, W / 2);
  const cyE = pw(cyS, H / 2);
  const xE = `max(0,min(iw-iw/zoom,${cxE}-iw/zoom/2))`;
  const yE = `max(0,min(ih-ih/zoom,${cyE}-ih/zoom/2))`;
  return `zoompan=z='${zE}':x='${xE}':y='${yE}':d=1:fps=${F}:s=${W}x${H}`;
}

/* ─────────── 九宫格坐标系 ─────────── */

// 基于 1440×900 标定的 3×3 九宫格，运行时按实际 viewport 等比换算
// 用法：zooms[] 中写 "grid": "mc" 代替手写 cx/cy
const GRID_MAP = {
  tl: { cx: 240,  cy: 150 },
  tc: { cx: 720,  cy: 150 },
  tr: { cx: 1200, cy: 150 },
  ml: { cx: 240,  cy: 450 },
  mc: { cx: 720,  cy: 450 },
  mr: { cx: 1200, cy: 450 },
  bl: { cx: 240,  cy: 750 },
  bc: { cx: 720,  cy: 750 },
  br: { cx: 1200, cy: 750 },
};

function resolveZoomGrids(zooms, viewport) {
  const scaleX = viewport.width / 1440;
  const scaleY = viewport.height / 900;
  return zooms.map((z) => {
    if (z.grid && GRID_MAP[z.grid]) {
      const { cx, cy } = GRID_MAP[z.grid];
      return { ...z, cx: cx * scaleX, cy: cy * scaleY };
    }
    return z;
  });
}

function toSec(t) {
  if (typeof t === "number") return t;
  const p = String(t).split(":").map(Number);
  return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}

function getActiveZoom(zooms, elapsedSec) {
  for (const z of zooms) {
    const f0 = toSec(z.from);
    const f1 = toSec(z.to);
    if (elapsedSec >= f0 && elapsedSec <= f1) return z;
  }
  return null;
}

// 按 zoom.subtitle.text 匹配，不依赖时钟——subtitle 模式和 prod 模式都能触发补偿
function getZoomBySubtitleText(zooms, text) {
  const flat = Array.isArray(text) ? text.join(" ") : String(text ?? "");
  for (const z of zooms) {
    if (!z.subtitle) continue;
    const zText = Array.isArray(z.subtitle.text) ? z.subtitle.text.join(" ") : String(z.subtitle.text ?? "");
    if (zText === flat) return z;
  }
  return null;
}

function buildZoomSubtitleOverride(zoom, vp, position = "bl") {
  const S  = zoom.scale ?? 1.5;
  const cx = zoom.cx ?? vp.width / 2;
  const cy = zoom.cy ?? vp.height / 2;
  const W  = vp.width;
  const H  = vp.height;

  const zW = W / S;
  const zH = H / S;
  // 与 ffmpeg zoompan 公式一致的裁切区边界
  const zLeft   = Math.max(0, Math.min(W - zW, cx - zW / 2));
  const zRight  = zLeft + zW;
  const zTop    = Math.max(0, Math.min(H - zH, cy - zH / 2));
  const zBottom = zTop + zH;

  const fontSizePx = Math.round(64 / S);
  const pad = Math.round(16 / S); // 原始像素 padding，zoompan 放大后恢复 ~16px

  if (position === "tr") {
    return {
      fontSize:  `${fontSizePx}px`,
      top:       `${Math.round(zTop + pad)}px`,
      right:     `${Math.round(W - zRight + pad)}px`,
      bottom: "", left: "", transform: "", textAlign: "right",
    };
  }
  if (position === "tl") {
    return {
      fontSize:  `${fontSizePx}px`,
      top:       `${Math.round(zTop + pad)}px`,
      left:      `${Math.round(zLeft + pad)}px`,
      bottom: "", right: "", transform: "", textAlign: "left",
    };
  }
  if (position === "br") {
    return {
      fontSize:  `${fontSizePx}px`,
      bottom:    `${Math.round(H - zBottom + pad)}px`,
      right:     `${Math.round(W - zRight + pad)}px`,
      top: "", left: "", transform: "", textAlign: "right",
    };
  }
  // bl 及其他 (bc/mc) fallback 到左下
  return {
    fontSize:  `${fontSizePx}px`,
    bottom:    `${Math.round(H - zBottom + pad)}px`,
    left:      `${Math.round(zLeft + pad)}px`,
    top: "", right: "", transform: "", textAlign: "left",
  };
}

/* ─────────── 启动 Playwright ─────────── */

const resolvedZooms = resolveZoomGrids(script.zooms ?? [], viewport);

console.log(`🎬 ${script.name || tag}`);
console.log(`   base=${baseUrl}  viewport=${viewport.width}x${viewport.height}`);
console.log(`   steps=${script.steps.length}\n`);

// 以录制页面创建为时间基准，排除后台认证耗时。
let recordStartMs = null;

// 当前鼠标位置追踪（runner 侧维护，不查 DOM）
let cursorX = viewport.width / 2;
let cursorY = viewport.height / 2;

const browser = await chromium.launch({
  headless: true,
  executablePath: chromium.executablePath(),
  slowMo,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-default-browser-check",
  ],
});

const context = await browser.newContext({
  viewport,
  baseURL: baseUrl,
  ...(PREFLIGHT ? {} : {recordVideo: { dir: outDir, size: viewport }}),
  deviceScaleFactor: 2,  // macOS Retina 高清；Windows 改为 1，见 WINDOWS-COMPAT.md W-2
});

// Authenticate before opening a recorded page. Never persist or print the launch token.
if (script.authLaunchLog) {
  const log = readFileSync(resolve(script.authLaunchLog), 'utf8');
  const launchUrl = [...log.matchAll(/dsh web: (http:\/\/[^\s]+)/g)].at(-1)?.[1];
  if (!launchUrl || new URL(launchUrl).origin !== new URL(baseUrl).origin) throw new Error('Unexpected recording login origin');
  const response = await context.request.get(launchUrl);
  if (!response.ok()) throw new Error('Recording login failed');
}

await context.addInitScript({
  content: `
    window.__REC_CSS__ = ${JSON.stringify(cursorCss)};
    ${cursorJs}
    // 全局滚动容器探针：优先 <main overflow-y:auto>，fallback window，排除 aside/nav/header/footer
    // 放在最前面定义，避免后面任何语句抛异常时连带这个核心函数都没定义成
    window.__getScroller = function() {
      if(window.__recordScroller?.isConnected && window.__recordScroller.clientHeight) return window.__recordScroller;
      const m = document.querySelector("main");
      if (m) {
        const cs = getComputedStyle(m);
        if (/(auto|scroll)/.test(cs.overflowY) && m.scrollHeight > m.clientHeight) return m;
      }
      const de = document.scrollingElement || document.documentElement;
      if (de.scrollHeight > de.clientHeight + 4) return de;
      const SKIP = new Set(["aside", "nav", "header", "footer"]);
      for (const el of document.querySelectorAll("*")) {
        if (SKIP.has(el.tagName.toLowerCase())) continue;
        if (el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
      }
      return de;
    };
    // 持续删除 Next.js dev overlay（Shadow DOM 宿主，无法用 z-index 盖住）
    // addInitScript 在文档创建前就执行，此刻 document.documentElement 可能还是 null，
    // 直接 observe(null) 会抛 TypeError 并中断脚本——轮询等它就位再 observe。
    const __recKillDevOverlay = () => {
      document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
    };
    function __recSetupDevOverlayKiller() {
      if (!document.documentElement) {
        requestAnimationFrame(__recSetupDevOverlayKiller);
        return;
      }
      __recKillDevOverlay();
      new MutationObserver(__recKillDevOverlay).observe(document.documentElement, { childList: true, subtree: true });
    }
    __recSetupDevOverlayKiller();
  `,
});

recordStartMs = Date.now();
const page = await context.newPage();
page.setDefaultTimeout(15000);

page.on("console", (m) => {
  const txt = m.text();
  if (txt.includes("[useDistill]")) {
    console.log("  📡", txt.slice(0, 200));
  }
});

/* ─────────── 步骤执行器 ─────────── */

async function showSubtitle(text, holdMs) {
  await page.waitForFunction(() => !!window.__rec, null, { timeout: 5000 }).catch(() => {});
  // 显式加载旁门正道字体，document.fonts.ready 对动态注入的 style 不可靠
  await page.evaluate(() =>
    document.fonts.load('64px "旁门正道标题体"').catch(() => {})
  ).catch(() => {});
  if (RAW_MODE) return;

  const elapsedSec = recordStartMs != null ? (Date.now() - recordStartMs) / 1000 : 0;

  // 统一补默认 theme/position，剧本可省略不写
  const normalized = typeof text === "string"
    ? { text, position: "bl", theme: "orange-sticker" }
    : { theme: "orange-sticker", position: "bl", ...text };

  let subtitleInput = normalized;
  if (resolvedZooms.length > 0) {
    // 优先按字幕文字内容匹配 zoom（不依赖时钟），fallback 到时间匹配
    const matchedZoom = getZoomBySubtitleText(resolvedZooms, normalized.text)
      ?? getActiveZoom(resolvedZooms, elapsedSec);
    if (matchedZoom) {
      const ov = buildZoomSubtitleOverride(matchedZoom, viewport, normalized.position);
      subtitleInput = { ...normalized, _zoomOverride: ov };
    }
  }

  await page.evaluate(
    ({ t, h }) => window.__rec && window.__rec.showSubtitle(t, h),
    { t: subtitleInput, h: holdMs ?? null }
  );
}

async function glideTo(x, y, steps = 30, durationMs = 350) {
  // 把移动分散到多帧，每步之间加延迟，确保 30fps 视频里看到连续弧线而非跳段
  // durationMs 默认 350ms：30fps 下约 10 帧，足够丝滑且不拖慢录制节奏
  const startX = cursorX;
  const startY = cursorY;
  const msPerStep = Math.max(8, Math.round(durationMs / steps));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // 三阶 ease-in-out：慢启动 → 匀速 → 慢收，模拟人手真实移动感
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const nx = Math.round(startX + (x - startX) * e);
    const ny = Math.round(startY + (y - startY) * e);
    await page.mouse.move(nx, ny, { steps: 1 });
    if (i < steps) await page.waitForTimeout(msPerStep);
  }
  cursorX = x;
  cursorY = y;
}

async function bboxCenter(selector) {
  const loc = page.locator(selector).filter({visible:true}).first();
  await loc.waitFor({ state: "visible", timeout: 10_000 });
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  if (!box) throw new Error(`无法取到 bbox: ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const capturedStates = new Map();
const stateReaders = new Set(["count", "text", "value", "checked", "attribute", "url"]);

function stateSpec(step, fallback = {}) {
  const spec = {
    selector: step.selector ?? fallback.selector,
    read: step.read ?? fallback.read ?? "text",
    attribute: step.attribute ?? fallback.attribute,
  };
  if (!stateReaders.has(spec.read)) throw new Error(`不支持的状态读取方式: ${spec.read}`);
  if (spec.read !== "url" && !spec.selector) throw new Error(`${step.action} 缺 selector`);
  if (spec.read === "attribute" && !spec.attribute) throw new Error(`${step.action} 缺 attribute`);
  return spec;
}

async function readObservedState(spec) {
  if (spec.read === "url") return page.url();
  const loc = page.locator(spec.selector);
  if (spec.read === "count") return loc.count();
  if ((await loc.count()) === 0) return null;
  const first = loc.first();
  if (spec.read === "text") return first.textContent();
  if (spec.read === "value") return first.inputValue();
  if (spec.read === "checked") return first.isChecked();
  return first.getAttribute(spec.attribute);
}

async function waitForObservedStateChange(spec, baseline, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const current = await readObservedState(spec);
    if (JSON.stringify(current) !== JSON.stringify(baseline)) return current;
    await page.waitForTimeout(100);
  }
  throw new Error(`等待状态变化超时（${timeout}ms）`);
}

function summarizeSubtitle(s) {
  if (!s) return "";
  if (typeof s === "string") return s;
  if (typeof s === "object") {
    const raw = s.text || s.main || "";
    const main = Array.isArray(raw) ? raw.join(" / ") : String(raw);
    const sub = s.sub ? ` / ${s.sub.slice(0, 24)}…` : "";
    const pos = s.position ? ` @${s.position}` : "";
    const theme = s.theme ? ` <${s.theme}>` : "";
    return `${main}${pos}${theme}`;
  }
  return "";
}

async function runStep(step, idx) {
  const stepTag = step.at ? `[${step.at}]` : `#${idx + 1}`;
  const subRaw = step.subtitle || (step.action === "subtitle" ? step.text : "");
  const sub = summarizeSubtitle(subRaw);
  const elapsedS = recordStartMs != null ? ((Date.now() - recordStartMs) / 1000).toFixed(1) : "?";
  console.log(
    `${stepTag} t=${elapsedS}s ${step.action.padEnd(10)} ${sub ? "· " + sub : ""}`
  );

  if (step.subtitle && step.action !== "navigate" && step.action !== "scene") {
    const holdMs = step.subtitleHold ?? step.hold ?? null;
    recordSubtitle(step.subtitle, holdMs);
    await showSubtitle(step.subtitle, holdMs);
  }

  switch (step.action) {
    case "navigate": {
      await page.goto(step.url, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(step.settleMs ?? 600);
      await page.evaluate(() => {
        document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
      }).catch(() => {});
      // settle 后立即把鼠标移到视口中心，触发 pointermove → cursor is-visible
      // 不依赖剧本写 moveTo，全程鼠标可见
      await page.mouse.move(viewport.width / 2, viewport.height / 2, { steps: 1 }).catch(() => {});
      cursorX = viewport.width / 2;
      cursorY = viewport.height / 2;
      // navigate 后的字幕在页面稳定、overlay 重新注入后才显示
      if (step.subtitle) {
        const holdMs = step.subtitleHold ?? step.hold ?? null;
        recordSubtitle(step.subtitle, holdMs);
        await showSubtitle(step.subtitle, holdMs);
        if (holdMs) await page.waitForTimeout(holdMs);
      }
      break;
    }

    case "wait": {
      await page.waitForTimeout(step.ms ?? 1000);
      break;
    }

    case "subtitle": {
      recordSubtitle(step.text, step.hold ?? 1500);
      await showSubtitle(step.text, step.hold ?? null);
      await page.waitForTimeout(step.hold ?? 1500);
      break;
    }

    case "subtitleClear": {
      clearLastSubtitle();
      await showSubtitle("", 0);
      break;
    }

    case "scene": {
      const settleMs = step.settleMs ?? 400;
      const framing = step.framing ?? "center";
      const dur = step.scrollDuration ?? 1200;

      if (typeof step.anchor === "string") {
        const target = page.locator(step.anchor).filter({visible:true}).first();
        await target.waitFor({state:'visible', timeout:15000});
        await target.evaluate(async (el, {framing, dur}) => {
          let scroller = el.parentElement;
          while(scroller && !(scroller.scrollHeight > scroller.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(scroller).overflowY))) scroller=scroller.parentElement;
          scroller ||= document.scrollingElement;
          window.__recordScroller = scroller;
          const rect=el.getBoundingClientRect(), bounds=scroller.getBoundingClientRect();
          const targetY=scroller.scrollTop+rect.top-bounds.top-(framing==='top'?24:Math.max(0,(scroller.clientHeight-rect.height)/2));
          const startY=scroller.scrollTop, finalY=Math.max(0,targetY), start=performance.now();
          await new Promise(resolve=>{const tick=now=>{const t=Math.min(1,(now-start)/dur);scroller.scrollTop=startY+(finalY-startY)*(1-Math.pow(1-t,3));if(t<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
        }, {framing,dur});
      } else if (step.anchor && typeof step.anchor === "object") {
        const anchor = step.anchor;
        if (typeof anchor.y === "number") {
          await page.evaluate(
            ({ y, dur }) =>
              new Promise((resolve) => {
                const scroller = window.__getScroller();
                const startY = scroller.scrollTop;
                const start = performance.now();
                const tick = (now) => {
                  const t = Math.min(1, (now - start) / dur);
                  const e = 1 - Math.pow(1 - t, 3);
                  scroller.scrollTop = startY + (y - startY) * e;
                  if (t < 1) requestAnimationFrame(tick);
                  else resolve();
                };
                requestAnimationFrame(tick);
              }),
            { y: anchor.y, dur }
          );
        } else if (typeof anchor.scrollBy === "number") {
          await page.evaluate(
            ({ dy, dur }) =>
              new Promise((resolve) => {
                const scroller = window.__getScroller();
                const startY = scroller.scrollTop;
                const target = startY + dy;
                const start = performance.now();
                const tick = (now) => {
                  const t = Math.min(1, (now - start) / dur);
                  const e = 1 - Math.pow(1 - t, 3);
                  scroller.scrollTop = startY + (target - startY) * e;
                  if (t < 1) requestAnimationFrame(tick);
                  else resolve();
                };
                requestAnimationFrame(tick);
              }),
            { dy: anchor.scrollBy, dur }
          );
        }
      }

      await page.waitForTimeout(settleMs);
      if (step.subtitle) {
        const hold = step.hold ?? 6000;
        recordSubtitle(step.subtitle, hold);
        await showSubtitle(step.subtitle, hold);
        await page.waitForTimeout(hold);
      }
      break;
    }

    case "scrollTo": {
      await page.evaluate(
        ({ y, dur }) =>
          new Promise((resolve) => {
            const scroller = window.__getScroller();
            const startY = scroller.scrollTop;
            const start = performance.now();
            const tick = (now) => {
              const t = Math.min(1, (now - start) / dur);
              const e = 1 - Math.pow(1 - t, 3);
              scroller.scrollTop = startY + (y - startY) * e;
              if (t < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          }),
        { y: step.y ?? 0, dur: step.duration ?? 1500 }
      );
      break;
    }

    case "scrollBy": {
      await page.evaluate(
        ({ dy, dur }) =>
          new Promise((resolve) => {
            const scroller = window.__getScroller();
            const startY = scroller.scrollTop;
            const target = startY + dy;
            const start = performance.now();
            const tick = (now) => {
              const t = Math.min(1, (now - start) / dur);
              const e = 1 - Math.pow(1 - t, 3);
              scroller.scrollTop = startY + (target - startY) * e;
              if (t < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          }),
        { dy: step.y ?? 0, dur: step.duration ?? 1500 }
      );
      break;
    }

    case "scrollFull": {
      const chunkY  = step.chunkY  ?? 900;
      const dur     = step.duration ?? 1600;
      const settle  = step.settleMs ?? 100;
      for (;;) {
        const done = await page.evaluate(
          ({ dy, dur }) =>
            new Promise((resolve) => {
              const scroller = window.__getScroller();
              const remaining = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
              if (remaining <= 1) { resolve(true); return; }
              const actualDy = Math.min(dy, remaining);
              const startY = scroller.scrollTop;
              const target = startY + actualDy;
              const start = performance.now();
              const tick = (now) => {
                const t = Math.min(1, (now - start) / dur);
                const e = 1 - Math.pow(1 - t, 3);
                scroller.scrollTop = startY + (target - startY) * e;
                if (t < 1) requestAnimationFrame(tick);
                else resolve(remaining - actualDy <= 1);
              };
              requestAnimationFrame(tick);
            }),
          { dy: chunkY, dur }
        );
        if (done) break;
        await page.waitForTimeout(settle);
      }
      break;
    }

    case "wheel": {
      // 把鼠标移到真实可滚动容器的中心，确保 wheel 事件命中正确区域而非侧边栏
      const mainCenter = await page.evaluate(() => {
        const scroller = window.__getScroller();
        const de = document.scrollingElement || document.documentElement;
        if (scroller === de) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const r = scroller.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.move(mainCenter.x, mainCenter.y);
      const deltaY = step.deltaY ?? step.y ?? 300;
      const steps2 = step.steps ?? step.count ?? 8;
      const interval = Math.round(
        (step.duration ?? (step.interval != null ? step.interval * steps2 : 800)) / steps2
      );
      for (let i = 0; i < steps2; i++) {
        await page.mouse.wheel(0, deltaY / steps2);
        await page.waitForTimeout(interval);
      }
      break;
    }

    case "drag": {
      const steps = step.steps ?? 60;
      await page.mouse.move(step.x1, step.y1, { steps: 5 });
      await page.mouse.down();
      await page.mouse.move(step.x2, step.y2, { steps });
      await page.mouse.up();
      break;
    }

    case "moveTo": {
      let x, y;
      if (step.selector) {
        ({ x, y } = await bboxCenter(step.selector));
      } else {
        x = step.x; y = step.y;
      }
      await glideTo(x, y, step.steps ?? 30, step.moveMs ?? 350);
      break;
    }

    case "click": {
      await page.evaluate(()=>{window.__recordScroller=null;});
      if (step.selector) {
        const { x, y } = await bboxCenter(step.selector);
        await glideTo(x, y, step.steps ?? 30, step.moveMs ?? 350);
        await page.waitForTimeout(step.preClickMs ?? 140);
        await page.locator(step.selector).filter({visible:true}).first().click({ timeout: 5000 });
      } else {
        await page.mouse.click(step.x, step.y);
      }
      break;
    }

    case "type": {
      const loc = page.locator(step.selector).filter({visible:true}).first();
      await loc.waitFor({ state: "visible" });
      await loc.click();
      await loc.press("ControlOrMeta+a");
      await loc.press("Delete");
      await loc.pressSequentially(step.text, { delay: step.speed ?? 80 });
      break;
    }

    case "captureState": {
      if (!step.key) throw new Error("captureState 缺 key");
      const spec = stateSpec(step);
      const value = await readObservedState(spec);
      capturedStates.set(step.key, { ...spec, value });
      console.log(`  ↳ 已捕获状态基线: ${step.key}`);
      break;
    }

    case "waitForStateChange": {
      if (!step.key) throw new Error("waitForStateChange 缺 key");
      const captured = capturedStates.get(step.key);
      if (!captured) throw new Error(`找不到状态基线: ${step.key}`);
      const spec = stateSpec(step, captured);
      const value = await waitForObservedStateChange(spec, captured.value, step.timeout ?? 15_000);
      capturedStates.set(step.key, { ...spec, value });
      console.log(`  ↳ 已验证运行结果发生变化: ${step.key}`);
      break;
    }

    case "waitFor": {
      await page
        .locator(step.selector)
        .filter({visible:true})
        .first()
        .waitFor({ state: "visible", timeout: step.timeout ?? 15_000 });
      break;
    }

    default:
      console.warn(`  ⚠️  未知 action: ${step.action} · 跳过`);
  }
}

/* ─────────── 字幕时间表（RAW 模式收集）─────────── */

const subtitleTimeline = []; // { startT, endT, text, position, theme }

function recordSubtitle(text, holdMs) {
  clearLastSubtitle();
  const startT = recordStartMs != null ? (Date.now() - recordStartMs) / 1000 : 0;
  const holdSec = (holdMs ?? 1500) / 1000;
  const raw = typeof text === "string" ? { text, position: "bl", theme: "orange-sticker" } : text;
  const label = Array.isArray(raw?.text) ? raw.text.join(" / ") : String(raw?.text ?? raw ?? "");
  subtitleTimeline.push({
    startT,
    endT: startT + holdSec,
    text: label,
    position: raw?.position ?? "bl",
    theme: raw?.theme ?? "orange-sticker",
  });
}

function clearLastSubtitle() {
  if (subtitleTimeline.length === 0) return;
  const last = subtitleTimeline[subtitleTimeline.length - 1];
  const nowT = recordStartMs != null ? (Date.now() - recordStartMs) / 1000 : 0;
  if (nowT < last.endT) last.endT = nowT;
}

/* ─────────── 主循环 ─────────── */

let stepError = null;
const t0 = Date.now();
try {
  for (let i = 0; i < script.steps.length; i++) {
    await runStep(script.steps[i], i);
  }
  await page.waitForTimeout(1200);
} catch (e) {
  stepError = e;
  console.error("\n❌ 步骤失败:", e.message);
}

const elapsedMs = Date.now() - t0;

/* ─────────── 收尾 + 转码 ─────────── */

const video = page.video();
await context.close();
await browser.close();
if(PREFLIGHT){console.log(stepError?'Preflight failed':'Preflight passed');process.exit(stepError?2:0);}

const rawPath = await video.path();
const targetWebm = join(outDir, `${ts}-${tag}.webm`);
renameSync(rawPath, targetWebm);
console.log(`\n✅ WebM: ${targetWebm}  (${(elapsedMs / 1000).toFixed(1)}s)`);

writeFileSync(targetWebm.replace(/\.webm$/, '-captions.json'), JSON.stringify({script: tag, subtitles: subtitleTimeline}, null, 2) + '\n');

if (RAW_MODE && subtitleTimeline.length > 0) {
  const lines = [
    `${script.name || tag}  字幕时间表`,
    `录制时间: ${ts}`,
    `WebM 总时长: ${(elapsedMs / 1000).toFixed(1)}s`,
    "",
    ` #   起始        结束        时长   位置                 字幕文字`,
    ` -   --------    --------    ----   ------------------   --------`,
  ];
  subtitleTimeline.forEach((e, i) => {
    const dur = (e.endT - e.startT).toFixed(1);
    const tag2 = `${e.position}/${e.theme}`;
    lines.push(
      `${String(i + 1).padStart(2)}   t=${String(e.startT.toFixed(1) + "s").padEnd(8)}` +
      `  t=${String(e.endT.toFixed(1) + "s").padEnd(8)}` +
      `  ${String(dur + "s").padEnd(5)}` +
      `  ${tag2.padEnd(20)} ${e.text}`
    );
  });
  const subtitleTxtPath = targetWebm.replace(/\.webm$/, "-raw-subtitles.txt");
  writeFileSync(subtitleTxtPath, lines.join("\n") + "\n");
  console.log(`✅ 字幕时间表: ${subtitleTxtPath}`);
}

const speedup = Number(script.speedup ?? 1);
const ffmpegFound = spawnSync("which", ["ffmpeg"]).status === 0
  || spawnSync("where", ["ffmpeg"]).status === 0;
if (ffmpegFound) {
  const suffix = RAW_MODE ? "-raw.mp4" : ".mp4";
  const targetMp4 = targetWebm.replace(/\.webm$/, suffix);
  const vFilters = ["fps=30"];
  if (!RAW_MODE && !SKIP_ZOOM && script.zooms?.length > 0) {
    const fps = getVideoFps(targetWebm);
    console.log(`   zoompan fps=${fps}`);
    vFilters.push(buildZoompanFilter(resolvedZooms, viewport, fps));
  }
  if (!RAW_MODE && speedup > 1) vFilters.push(`setpts=PTS/${speedup}`);
  const filterArgs = vFilters.length > 0 ? ["-vf", vFilters.join(",")] : [];
  const modeTag = RAW_MODE ? "素版转码" : [
    (!SKIP_ZOOM && script.zooms?.length > 0) ? `${script.zooms.length} 段 zoompan` : "",
    speedup > 1 ? `×${speedup} 加速` : "",
  ].filter(Boolean).join(" + ") || "转码";
  console.log(`🎞  ffmpeg ${modeTag} → ${basename(targetMp4)}`);
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i", targetWebm,
      ...filterArgs,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-crf", "18",
      "-r", "30",
      "-movflags", "+faststart",
      "-an",
      targetMp4,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  if (r.status === 0) console.log(`✅ MP4:  ${targetMp4}`);
  else console.warn("⚠️  ffmpeg 转码失败:", r.stderr?.toString().slice(-400));
} else {
  console.log("ℹ️  未发现 ffmpeg · 跳过 MP4 转码");
}

if (stepError) process.exit(2);

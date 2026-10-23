/* 录制专用虚拟鼠标 + 字幕 runtime · runner.mjs 注入 · 暴露 window.__rec API */
(() => {
  if (window.__rec) return;

  function injectStyle() {
    if (document.querySelector("style[data-rec-style]")) return;
    const css = window.__REC_CSS__;
    if (!css) return;
    const target = document.head || document.documentElement;
    if (!target) return;
    const style = document.createElement("style");
    style.setAttribute("data-rec-style", "1");
    style.textContent = css;
    target.appendChild(style);
    // headless Chromium 不会自动把 @font-face 注册到 document.fonts
    // 用 FontFace API 手动注册，确保 document.fonts.load() 能找到并加载
    const m = css.match(/url\("(data:font\/[^"]+)"\)/);
    if (m && typeof FontFace !== "undefined") {
      const ff = new FontFace("旁门正道标题体", "url(" + m[1] + ")");
      document.fonts.add(ff);
      ff.load().catch(() => {});
    }
  }

  function mount() {
    injectStyle();
    const cursor = document.createElement("div");
    cursor.className = "__rec-cursor";
    cursor.setAttribute("data-rec-overlay", "cursor");
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L5.5 3.21Z"/>' +
      "</svg>";

    const ripple = document.createElement("div");
    ripple.className = "__rec-ripple";
    ripple.setAttribute("data-rec-overlay", "ripple");

    // 旧字幕(向后兼容 · 单行 bottom-center)
    const subtitle = document.createElement("div");
    subtitle.className = "__rec-subtitle is-hidden";
    subtitle.setAttribute("data-rec-overlay", "subtitle");

    // 新字幕 · 单行 + 5 位置(占位最少 · 不挡画面)
    const subtitleMulti = document.createElement("div");
    subtitleMulti.className = "__rec-subtitle-multi is-hidden pos-bc theme-default";
    subtitleMulti.setAttribute("data-rec-overlay", "subtitle-multi");

    function ensureMounted() {
      injectStyle();
      // 原生 dialog 位于 top layer；字幕和鼠标必须随弹窗进入该层，避免被 backdrop 模糊。
      const target = document.querySelector('dialog[open]') || document.documentElement || document.body;
      if (!target) return;
      if (cursor.parentElement !== target) target.appendChild(cursor);
      if (ripple.parentElement !== target) target.appendChild(ripple);
      if (subtitle.parentElement !== target) target.appendChild(subtitle);
      if (subtitleMulti.parentElement !== target) target.appendChild(subtitleMulti);
    }
    ensureMounted();

    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;
    let subtitleTimer = null;

    function setPos(x, y, pressed) {
      ensureMounted();
      lastX = x; lastY = y;
      cursor.style.left = x + "px";
      cursor.style.top = y + "px";
      cursor.classList.add("is-visible");
      cursor.classList.toggle("is-pressed", !!pressed);
    }

    function fireRipple(x, y) {
      ripple.style.left = x + "px";
      ripple.style.top = y + "px";
      ripple.classList.remove("is-firing");
      void ripple.offsetWidth;
      ripple.classList.add("is-firing");
    }

    function hideAllSubtitles() {
      subtitle.classList.remove("is-visible");
      subtitle.classList.add("is-hidden");
      subtitleMulti.classList.remove("is-visible");
      subtitleMulti.classList.add("is-hidden");
    }

    function buildLines(rawText) {
      if (Array.isArray(rawText)) {
        return rawText.map((item) => String(item).trim()).filter(Boolean);
      }
      return String(rawText || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function renderSubtitleLines(lines) {
      subtitleMulti.replaceChildren();
      for (const line of lines) {
        const span = document.createElement("span");
        span.className = "__rec-subtitle-line";
        span.textContent = line;
        subtitleMulti.appendChild(span);
      }
    }

    /**
     * showSubtitle 接受 string 或 {text, position?, theme?, _zoomOverride?}
     *   string                       → 旧版 bottom-center 单行(向后兼容)
     *   {text, position?, theme?}    → 新版单/多行 + 5 位置 + 主题
     *     position ∈ "tl" | "tr" | "bl" | "br" | "bc" | "bc-sm" (默认 "bc")
     *     theme    ∈ "default" | "cyan-glow" | "orange-sticker"
     *   _zoomOverride (由 runner 注入，用户不需手写):
     *     { fontSize, bottom, left, transform } — 覆盖 CSS 位置/字号，实现
     *     录制时缩小字幕 → zoompan 放大后恢复正常大小的效果
     */
    function showSubtitle(input, holdMs) {
      ensureMounted();
      if (subtitleTimer) {
        clearTimeout(subtitleTimer);
        subtitleTimer = null;
      }

      hideAllSubtitles();
      if (!input) return;

      // 统一走新路径（string 视为 {text, position:"bc", theme:"default"}）
      const inputObj = typeof input === "string"
        ? { text: input, position: "bc", theme: "default" }
        : input;

      if (typeof inputObj === "object") {
        // 新路径 · 接受 text 或 main(向后兼容旧的 main 字段)
        const lines = buildLines(inputObj.text || inputObj.main || "");
        if (!lines.length) return;
        const pos = String(inputObj.position || "bc");
        const theme = String(inputObj.theme || "default");
        const validPos = ["tl", "tr", "bl", "br", "bc", "bc-sm", "mc"];
        const validThemes = ["default", "cyan-glow", "orange-sticker"];

        subtitleMulti.classList.remove("pos-tl", "pos-tr", "pos-bl", "pos-br", "pos-bc", "pos-bc-sm", "pos-mc");
        subtitleMulti.classList.add("pos-" + (validPos.includes(pos) ? pos : "bc"));
        subtitleMulti.classList.remove("theme-default", "theme-cyan-glow", "theme-orange-sticker");
        subtitleMulti.classList.add("theme-" + (validThemes.includes(theme) ? theme : "cyan-glow"));

        renderSubtitleLines(lines);

        // 九宫格 zoom 覆盖：runner 在 zoom 窗口内注入 _zoomOverride
        // 将字幕定位到 zoom 区域底部中心，字号缩小 1/scale，
        // 使 zoompan 放大后字幕恢复正常视觉大小
        const ov = inputObj._zoomOverride;
        if (ov && typeof ov === "object") {
          subtitleMulti.style.fontSize   = ov.fontSize   || "";
          subtitleMulti.style.bottom     = ov.bottom     || "";
          subtitleMulti.style.left       = ov.left       || "";
          subtitleMulti.style.right      = ov.right      || "";
          subtitleMulti.style.top        = ov.top        || "";
          subtitleMulti.style.transform  = ov.transform  || "";
          subtitleMulti.style.textAlign  = ov.textAlign  || "";
        } else {
          // 清除上次可能残留的 inline 覆盖
          subtitleMulti.style.fontSize  = "";
          subtitleMulti.style.bottom    = "";
          subtitleMulti.style.left      = "";
          subtitleMulti.style.right     = "";
          subtitleMulti.style.top       = "";
          subtitleMulti.style.transform = "";
          subtitleMulti.style.textAlign = "";
          const dialog = document.querySelector('dialog[open]');
          if (dialog && pos === 'tr') {
            // 右侧抽屉的标题与关闭按钮留空，提示放在抽屉左侧。
            const edge = dialog.getBoundingClientRect().left;
            if (edge > window.innerWidth / 2) subtitleMulti.style.right = (window.innerWidth - edge + 24) + 'px';
          }
        }

        subtitleMulti.classList.remove("is-hidden");
        subtitleMulti.classList.add("is-visible");
      }

      if (holdMs && holdMs > 0) {
        subtitleTimer = setTimeout(hideAllSubtitles, holdMs);
      }
    }

    window.addEventListener("pointermove", (e) => setPos(e.clientX, e.clientY, false), true);
    window.addEventListener("pointerdown", (e) => {
      setPos(e.clientX, e.clientY, true);
      fireRipple(e.clientX, e.clientY);
    }, true);
    window.addEventListener("pointerup", (e) => setPos(e.clientX, e.clientY, false), true);

    window.__rec = {
      setPos,
      fireRipple,
      showSubtitle,
      ensureMounted,
      getPos: () => ({ x: lastX, y: lastY }),
      version: "0.5.0",  // 九宫格 zoom 覆盖 + bc-sm
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();

/**
 * 字幕风格 linter · 跑剧本前自动扫描所有 subtitle 文本
 *
 * 规则源自 SUBTITLE-STYLE.md (强制 5 禁令 + 长度区间)。
 * 违规返回 {ok:false, issues:[...]} · runner 拒跑。
 */

const FORBIDDEN = [
  { pat: /方向盘|行车记录|自驾代理|夜班|开启夜班|松开方向|代驾|副驾/, kind: "比喻", reason: "用功能描述替代品牌比喻" },
  { pat: /你的|你只|你睡|你审批|你管|帮你|替你|为你|让你/, kind: "第二人称", reason: "字幕是中立播报 · 不对观众喊话" },
  { pat: /一夜不停|永不停摆|永不掉线|不知疲倦|灵魂|起飞|绽放|绝美|惊艳|炸裂|颠覆|王炸/, kind: "诗意/拟人", reason: "文学化表达稀释信息密度" },
  { pat: /^→|^接下来|^现在(进入|开始|去|来)|演示完整|让我们|带大家|这一段/, kind: "过渡引导", reason: "字幕跳剪自然衔接 · 不要串场" },
  { pat: /教学演示|压缩成.*演完|为方便|为讲解|课程|课件|本节|本章/, kind: "教学注释", reason: "介绍产品不是介绍课件" },
];

const MIN_LEN = 4;        // 含汉字数下限
const MAX_LEN_MAIN = 22;  // 主标题 · 42px 字号下不换行的安全值
const MAX_LEN_SUB  = 60;  // 副标题 · 19px 小字 · 允许换行 · 容许更长场景化解释

function countChinese(s) {
  return (s.match(/[一-鿿]/g) || []).length;
}

/**
 * lintSubtitle(text, kind?)
 *   kind ∈ "main"(默认 · 严格 ≤ 22) | "sub"(放宽 ≤ 60)
 */
export function lintSubtitle(text, kind = "main") {
  const issues = [];
  if (!text || typeof text !== "string") return issues;

  const total = [...text].length;
  const cn = countChinese(text);
  const maxLen = kind === "sub" ? MAX_LEN_SUB : MAX_LEN_MAIN;
  if (total > maxLen) {
    issues.push({ rule: `长度·${kind}`, msg: `${total} 字符，超过 ${maxLen} 字符上限` });
  }
  if (kind === "main" && cn > 0 && cn < MIN_LEN) {
    issues.push({ rule: "长度", msg: `主标题仅 ${cn} 个汉字，信息量可能不足` });
  }

  for (const f of FORBIDDEN) {
    const m = text.match(f.pat);
    if (m) {
      issues.push({ rule: `禁词·${f.kind}`, msg: `命中「${m[0]}」 — ${f.reason}` });
    }
  }

  return issues;
}

export function lintScript(script) {
  const all = [];
  const steps = script.steps || [];

  // subtitle 统一展开 · 都按 main 严格规则 lint
  // - string                       → [{text, kind:"main"}]
  // - { text, position? }          → [{text, kind:"main"}]
  // - { main, position? }          → [{text:main, kind:"main"}](向后兼容旧字段)
  function expandSubtitle(s) {
    if (!s) return [];
    if (typeof s === "string") {
      return s
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ text, kind: "main" }));
    }
    if (typeof s === "object") {
      const text = s.text || s.main;
      if (Array.isArray(text)) {
        return text
          .map((item) => String(item).trim())
          .filter(Boolean)
          .map((item) => ({ text: item, kind: "main" }));
      }
      if (typeof text === "string" && text.length > 0) {
        return text
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => ({ text: item, kind: "main" }));
      }
    }
    return [];
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const idx = i + 1;
    const sceneSub = expandSubtitle(step.subtitle);
    const actionSub = step.action === "subtitle" ? expandSubtitle(step.text) : [];
    const subs = [...sceneSub, ...actionSub];
    for (const { text, kind } of subs) {
      const issues = lintSubtitle(text, kind);
      if (issues.length) {
        all.push({ idx, at: step.at, text, issues });
      }
    }

    // 反模式 · scrollBy/scrollTo 紧跟独立 subtitle
    if (step.action === "subtitle") {
      const prev = steps[i - 1];
      if (prev && (prev.action === "scrollBy" || prev.action === "scrollTo")) {
        all.push({
          idx,
          at: step.at,
          text: step.text,
          issues: [
            {
              rule: "锚点·字幕飘",
              msg: `紧跟 ${prev.action} 之后的独立 subtitle · 字幕落点不可控 · 改用 scene action 把 anchor + subtitle 绑死`,
            },
          ],
        });
      }
    }
  }
  return all;
}

/* CLI: node lint-subtitles.mjs <script.json> */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const path = process.argv[2];
  if (!path) {
    console.error("用法: node lint-subtitles.mjs <script.json>");
    process.exit(1);
  }
  const script = JSON.parse(readFileSync(path, "utf8"));
  const violations = lintScript(script);
  if (violations.length === 0) {
    console.log(`✅ ${path} · 全部 ${script.steps.length} 步字幕通过风格 lint`);
    process.exit(0);
  }
  console.error(`❌ ${path} · 发现 ${violations.length} 条违规字幕：\n`);
  for (const v of violations) {
    console.error(`  [${v.at || "#" + v.idx}] "${v.text}"`);
    for (const i of v.issues) {
      console.error(`     · ${i.rule}: ${i.msg}`);
    }
    console.error("");
  }
  console.error("→ 请按 scripts/record/SUBTITLE-STYLE.md 重写后再跑\n");
  process.exit(2);
}

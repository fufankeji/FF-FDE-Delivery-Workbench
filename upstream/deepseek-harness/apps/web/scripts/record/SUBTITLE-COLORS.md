# 字幕配色指南 · 从项目源码提取颜色

> 目标：让 `orange-sticker` 主题的描边色/发光色/字色贴合项目前端调性，而不是千篇一律的红描边+黄发光。

---

## 配色变量一览

| 变量 | 作用 | 默认值 | 是否常改 |
|---|---|---|---|
| `--rec-stroke` | 描边色（4 方向 2px 扩散） | `#d9482f` 红 | ✅ 每个项目都该改 |
| `--rec-glow` | 外发光色 | `rgba(255,209,26,0.50)` 黄 | ✅ 跟着 stroke 改 |
| `--rec-text` | 字体颜色 | `#ffffff` 白 | ❌ 一般不动 |

剧本顶层写法：

```jsonc
{
  "name": "my-project-demo",
  "subtitleColors": {
    "stroke": "#2563eb",
    "glow": "rgba(37, 99, 235, 0.45)"
  },
  "steps": [...]
}
```

不写 `subtitleColors` = 全用默认值，向后兼容。

---

## 第一步：找项目主色

按优先级依次查找，找到即停：

### 1a · globals.css / variables.css（最快）

```bash
grep -n "primary\|accent\|brand\|--color" src/app/globals.css
```

典型输出：
```css
:root {
  --primary: #2563eb;
  --accent: #7c3aed;
}
```

→ 取 `--primary` 或 `--accent` 作为描边色候选。

---

### 1b · Tailwind 配置

```bash
cat tailwind.config.ts | grep -A 30 "colors"
```

典型输出：
```js
colors: {
  brand: { DEFAULT: "#2563eb", dark: "#1d4ed8" },
  accent: "#7c3aed",
}
```

→ 取 `brand.DEFAULT` 或 `accent`。

---

### 1c · 直接扫组件高频色

```bash
grep -rh "#[0-9a-fA-F]\{6\}" src/components/ | sort | uniq -c | sort -rn | head -10
```

→ 出现频次最高且非黑/白/灰的颜色，通常就是品牌主色。

---

### 1d · 看 Button / Badge / Link 组件

主色通常在 CTA 按钮、激活态、高亮链接上。找 `bg-`、`text-`、`border-` 里出现的非中性色：

```bash
grep -rn "bg-blue\|bg-violet\|bg-indigo\|bg-emerald" src/components/ | head -5
```

---

## 第二步：从主色推导配色

找到主色 `#RRGGBB` 之后，按以下规则生成三个值：

| 变量 | 推导方式 |
|---|---|
| `--rec-stroke` | 直接用主色（或稍深 10%），饱和度高的颜色描边最清晰 |
| `--rec-glow` | 主色转 rgba，透明度 **0.40 ~ 0.55**（太高发光会糊，太低看不见） |
| `--rec-text` | 保持 `#ffffff`，除非主色极浅（如米白 / 浅黄系前端）才改 |

**快速换算示例：**

| 主色 | stroke | glow |
|---|---|---|
| `#2563eb`（蓝） | `#2563eb` | `rgba(37, 99, 235, 0.45)` |
| `#7c3aed`（紫） | `#7c3aed` | `rgba(124, 58, 237, 0.45)` |
| `#059669`（绿） | `#059669` | `rgba(5, 150, 105, 0.45)` |
| `#d97706`（琥珀） | `#d97706` | `rgba(217, 119, 6, 0.45)` |
| `#dc2626`（红） | `#dc2626` | `rgba(220, 38, 38, 0.45)` |

hex → rgba 换算：`#RRGGBB` → `rgba(RR_dec, GG_dec, BB_dec, 0.45)`

---

## 第三步：可读性验证

填完颜色后过这 3 项再录：

- [ ] 描边色在白色背景上看得清吗？（纯白/浅灰系描边 = 失效）
- [ ] 描边色在深色背景上看得清吗？（纯黑描边 = 视觉上消失）
- [ ] 把视频缩到 50% 大小，字幕仍能一眼读完吗？

**危险色（不要直接用作 stroke）：**
- `#ffffff` / `#f8f8f8` — 和字色相同，描边消失
- `#000000` / `#111111` — 深色背景下描边不可见
- `#cccccc` / `#999999` — 灰色无辨识度

---

## 常见项目类型参考

| 项目类型 | 典型主色风格 | 推荐 stroke 方向 |
|---|---|---|
| AI / 技术工具 | 蓝、靛蓝、紫 | `#2563eb` / `#6d28d9` |
| 数据分析 / BI | 蓝绿、青、橙 | `#0891b2` / `#ea580c` |
| 医疗 / 健康 | 绿、蓝绿、白 | `#059669` / `#0284c7` |
| 金融 / 企业 | 深蓝、金、藏青 | `#1e40af` / `#b45309` |
| 创意 / 设计工具 | 紫、粉、渐变 | `#7c3aed` / `#db2777` |

---

## 填入剧本

确认颜色后，在剧本 JSON 顶层加：

```jsonc
{
  "subtitleColors": {
    "stroke": "#2563eb",
    "glow": "rgba(37, 99, 235, 0.45)"
    // text 不写 = 白色
  }
}
```

不需要改任何字幕条目，runner 启动时自动注入到全局 CSS 变量，所有 `orange-sticker` 字幕生效。

import { Check, Image, Laptop, Moon, Sun } from "lucide-react";
import { CSSProperties, useState } from "react";

import { applyBackgroundTheme, backgroundThemes, getSavedBackgroundTheme, type BackgroundThemeId } from "../design/backgroundThemes";
import { type ColorMode, useColorMode } from "../design/colorMode";

const colorModes: { id: ColorMode; label: string; description: string; icon: typeof Sun }[] = [
  { id: "system", label: "跟随系统", description: "随设备外观自动切换", icon: Laptop },
  { id: "light", label: "浅色", description: "暖白纸张与铜色材质", icon: Sun },
  { id: "dark", label: "深色", description: "沉浸暗场与暖铜微光", icon: Moon },
];

export function AppearanceControls() {
  const { mode, resolved, setMode } = useColorMode();
  const [background, setBackground] = useState<BackgroundThemeId>(getSavedBackgroundTheme);

  function selectBackground(id: BackgroundThemeId) {
    applyBackgroundTheme(id);
    setBackground(id);
  }

  return <div className="appearance-controls">
    <section className="appearance-intro"><Sun size={20} /><div><b>界面明暗</b><span>三种模式使用同一套任务工作台与组件层级。</span></div></section>
    <section className="color-mode-grid" aria-label="界面明暗模式">
      {colorModes.map(({ id, label, description, icon: Icon }) => <button type="button" key={id} className={mode === id ? "selected" : ""} aria-pressed={mode === id} onClick={() => setMode(id)}><Icon size={19} /><span><b>{label}</b><small>{description}</small></span>{mode === id && <Check size={16} />}</button>)}
    </section>
    <section className="appearance-intro"><Image size={20} /><div><b>工作台背景</b><span>每个主题都配有深浅两套专属材质，并持续作用于首页与项目空间。</span></div></section>
    <section className="theme-grid" aria-label="工作台背景主题">
      {backgroundThemes.map((theme) => {
        const active = background === theme.id;
        const previewImage = resolved === "light" ? theme.lightImage : theme.image;
        const style = { "--theme-preview-image": `url("${previewImage}")` } as CSSProperties;
        return <button className={`theme-card ${active ? "selected" : ""}`} type="button" key={theme.id} onClick={() => selectBackground(theme.id)} aria-pressed={active}>
          <span className="theme-preview" style={style}><i>{active && <Check size={18} />}</i></span>
          <span className="theme-copy"><span><b>{theme.name}</b>{active && <em>当前使用</em>}</span><small>{theme.description}</small></span>
        </button>;
      })}
    </section>
  </div>;
}

export const BACKGROUND_THEME_STORAGE_KEY = "ds4-background-theme";

export const backgroundThemes = [
  {
    id: "orbital-data-engine",
    name: "轨道智核",
    description: "数据轨道与智能核心交汇，强调系统感与分析效率。",
    image: "/assets/orbital-data-engine.png",
    lightImage: "/assets/orbital-data-engine-light.png",
  },
  {
    id: "mountain-night",
    name: "铜光山境",
    description: "克制的远山与铜色微光，适合沉浸式长时间分析。",
    image: "/assets/mountain-night.png",
    lightImage: "/assets/mountain-night-light.png",
  },
  {
    id: "neural-organism",
    name: "神经生长",
    description: "有机网络在暗色空间中生长，呈现智能与数据联结。",
    image: "/assets/neural-organism.png",
    lightImage: "/assets/neural-organism-light.png",
  },
  {
    id: "liquid-data-storm",
    name: "流动洞察",
    description: "液态数据与粒子动势交织，表达探索中的能量与发现。",
    image: "/assets/liquid-data-storm.png",
    lightImage: "/assets/liquid-data-storm-light.png",
  },
] as const;

export type BackgroundThemeId = (typeof backgroundThemes)[number]["id"];

export const DEFAULT_BACKGROUND_THEME: BackgroundThemeId = "orbital-data-engine";

export function isBackgroundThemeId(value: string | null): value is BackgroundThemeId {
  return backgroundThemes.some((theme) => theme.id === value);
}

export function getSavedBackgroundTheme(): BackgroundThemeId {
  const saved = localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
  return isBackgroundThemeId(saved) ? saved : DEFAULT_BACKGROUND_THEME;
}

export function applyBackgroundTheme(id: BackgroundThemeId) {
  const theme = backgroundThemes.find((candidate) => candidate.id === id) ?? backgroundThemes[0];
  document.documentElement.style.setProperty("--ds4-background-image-dark", `url("${theme.image}")`);
  document.documentElement.style.setProperty("--ds4-background-image-light", `url("${theme.lightImage}")`);
  document.documentElement.dataset.ds4BackgroundTheme = theme.id;
  localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, theme.id);
}

export function initializeBackgroundTheme() {
  applyBackgroundTheme(getSavedBackgroundTheme());
}

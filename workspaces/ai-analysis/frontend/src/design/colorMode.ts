import { useSyncExternalStore } from "react";

export type ColorMode = "system" | "light" | "dark";
export type ResolvedColorMode = "light" | "dark";

export const COLOR_MODE_STORAGE_KEY = "ds4-color-mode";
const listeners = new Set<() => void>();

function isColorMode(value: string | null): value is ColorMode {
  return value === "system" || value === "light" || value === "dark";
}

export function getColorMode(): ColorMode {
  const saved = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
  return isColorMode(saved) ? saved : "dark";
}

export function resolveColorMode(mode = getColorMode()): ResolvedColorMode {
  if (mode !== "system") return mode;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyColorMode(mode: ColorMode) {
  const resolved = resolveColorMode(mode);
  document.documentElement.dataset.colorMode = resolved;
  document.documentElement.dataset.colorModePreference = mode;
  document.documentElement.style.colorScheme = resolved;
  localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  listeners.forEach((listener) => listener());
}

export function initializeColorMode() {
  applyColorMode(getColorMode());
  if (typeof window.matchMedia !== "function") return;
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (getColorMode() === "system") applyColorMode("system");
  });
}

export function useColorMode() {
  const mode = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getColorMode,
    () => "system" as ColorMode,
  );
  return { mode, resolved: resolveColorMode(mode), setMode: applyColorMode };
}

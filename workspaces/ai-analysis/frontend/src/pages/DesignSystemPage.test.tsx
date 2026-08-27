import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { BACKGROUND_THEME_STORAGE_KEY } from "../design/backgroundThemes";
import { COLOR_MODE_STORAGE_KEY, initializeColorMode } from "../design/colorMode";
import { DesignSystemPage } from "./DesignSystemPage";

describe("DS4 appearance themes", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--ds4-background-image-dark");
    document.documentElement.style.removeProperty("--ds4-background-image-light");
    delete document.documentElement.dataset.ds4BackgroundTheme;
    initializeColorMode();
  });

  it("offers four backgrounds and persists the selected visual", () => {
    render(<DesignSystemPage />);

    expect(document.documentElement.dataset.colorMode).toBe("dark");
    const themes = screen.getByRole("region", { name: "工作台背景主题" });
    expect(themes.querySelectorAll(".theme-card")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /轨道智核/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /流动洞察/ }));

    expect(localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY)).toBe("liquid-data-storm");
    expect(document.documentElement.dataset.ds4BackgroundTheme).toBe("liquid-data-storm");
    expect(document.documentElement.style.getPropertyValue("--ds4-background-image-dark")).toContain("liquid-data-storm.png");
    expect(document.documentElement.style.getPropertyValue("--ds4-background-image-light")).toContain("liquid-data-storm-light.png");

    fireEvent.click(screen.getByRole("button", { name: /浅色/ }));
    expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.dataset.colorMode).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});

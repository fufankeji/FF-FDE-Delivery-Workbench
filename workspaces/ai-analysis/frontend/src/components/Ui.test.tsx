import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState, StatusPill, formatNumber } from "./Ui";

describe("shared UI states", () => {
  it("renders an actionable empty state without pretending data exists", () => {
    render(<EmptyState title="等待数据" text="请先连接真实来源" action={<button>连接数据</button>} />);
    expect(screen.getByRole("heading", { name: "等待数据" })).toBeVisible();
    expect(screen.getByRole("button", { name: "连接数据" })).toBeEnabled();
  });

  it("formats numeric values and preserves non-numeric values", () => {
    expect(formatNumber(99441)).toBe("99,441");
    expect(formatNumber("ready")).toBe("ready");
  });

  it("exposes status text", () => {
    render(<StatusPill tone="good">ready</StatusPill>);
    expect(screen.getByText("ready")).toBeVisible();
  });
});

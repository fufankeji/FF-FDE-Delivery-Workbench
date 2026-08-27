import { describe, expect, it } from "vitest";

import type { Artifact } from "../types";
import { reportChartOption } from "./ReportCanvas";

describe("report chart semantics", () => {
  it("uses a second axis when revenue and a percentage have different scales", () => {
    const visual: Artifact = {
      id: "visual-1",
      project_id: "project-1",
      type: "visual",
      name: "收入与超时率",
      path: "visuals/visual-1.json",
      sha256: "abc123",
      status: "ready",
      metadata: { chart_type: "line", x: "month", y: ["revenue", "late_rate"] },
      lineage: ["extract-1"],
      created_at: "2026-08-04T00:00:00Z",
    };
    const option = reportChartOption(visual, [
      { month: "2026-01", revenue: 1_200_000, late_rate: 8.2 },
      { month: "2026-02", revenue: 980_000, late_rate: 12.4 },
    ]) as { yAxis: unknown[]; series: Array<{ yAxisIndex: number }> };

    expect(option.yAxis).toHaveLength(2);
    expect(option.series[0].yAxisIndex).toBe(0);
    expect(option.series[1].yAxisIndex).toBe(1);
  });
});

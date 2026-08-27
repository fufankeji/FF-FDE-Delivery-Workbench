import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "./ExplorePage";

describe("unified result table", () => {
  it("renders the same saved rows used by chart views", () => {
    render(
      <DataTable
        columns={["state", "revenue"]}
        rows={[{ state: "SP", revenue: 120.5 }, { state: "RJ", revenue: 83.2 }]}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "state" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "SP" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "120.5" })).toBeVisible();
  });
});

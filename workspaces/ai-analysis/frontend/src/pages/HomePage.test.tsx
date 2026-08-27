import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { HomePage } from "./HomePage";

describe("DS4 product homepage", () => {
  it("keeps the product name dominant and presents the four core capabilities", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["projects"], []);
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(container.querySelector(".hero-copy h1")?.textContent).toBe("DS4-AI数据分析系统");
    expect(screen.getByRole("heading", { name: "今天，想分析什么？" })).toBeInTheDocument();
    expect(screen.getByText("连接新数据，或继续最近的分析项目。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "赋范空间团队出品" })).toHaveAttribute("href", "https://beyondata.com");
    expect(screen.getByText("让数据，直接回答业务问题。")).toBeInTheDocument();
    for (const capability of ["交互式数据分析", "海量数据源", "可拓展 Skills 系统", "可追溯、可定制分析报告"]) {
      expect(screen.getByText(capability)).toBeInTheDocument();
    }
  });
});

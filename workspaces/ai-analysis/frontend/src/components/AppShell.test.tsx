import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";

describe("resizable application sidebar", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("supports keyboard resizing and a persistent collapsed state", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["projects"], []);
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<div>首页内容</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const frame = container.querySelector<HTMLElement>(".app-frame")!;
    expect(screen.getByRole("link", { name: "DS4-AI数据分析首页" })).toBeInTheDocument();
    expect(screen.getByText("DS4-AI数据分析")).toBeInTheDocument();
    expect(screen.getByText("智能数据分析工作台")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "DS4 智能工作区" })).toHaveTextContent("DS4 WORKSPACE");
    expect(screen.getByRole("region", { name: "DS4 智能工作区" })).toHaveTextContent("管理数据、Skills 与运行环境");
    expect(screen.getByRole("img", { name: "赋范空间团队 Logo" })).toHaveAttribute("src", "/assets/fan-space-logo.png");
    const separator = screen.getByRole("separator", { name: "拖拽调整左侧栏宽度" });
    expect(separator).toHaveAttribute("aria-valuenow", "246");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "258");
    expect(frame.style.getPropertyValue("--sidebar-width")).toBe("258px");

    fireEvent.click(screen.getByRole("button", { name: "收起左侧栏" }));
    expect(frame.style.getPropertyValue("--sidebar-width")).toBe("76px");
    expect(screen.getByRole("button", { name: "展开左侧栏" })).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("northlight-sidebar-collapsed")).toBe("true");
  });

  it("keeps global navigation stable inside a project", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["projects"], [{ id: "project-1", title: "销售分析", status: "ready", created_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T10:00:00Z" }]);
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/project-1/chat"]}><Routes><Route element={<AppShell />}><Route path="projects/:projectId/chat" element={<div>对话工作台</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>);
    expect(screen.getByRole("button", { name: "新建分析" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "项目" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "数据资产" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Skills技能中心" })).toBeVisible();
    expect(screen.getByRole("link", { name: "功能架构" })).toBeVisible();
    expect(screen.getByRole("link", { name: "系统设置" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重命名 销售分析" })).toBeVisible();
    expect(screen.getByRole("button", { name: "删除 销售分析" })).toBeVisible();
    expect(screen.getByRole("region", { name: "DS4 智能工作区" })).toHaveTextContent("DS4 ANALYSIS");
    expect(screen.getByRole("region", { name: "DS4 智能工作区" })).toHaveTextContent("全部留在当前项目");
    expect(screen.getByText("最近分析项目").parentElement).toHaveTextContent("最近分析项目");
    expect(screen.getByText("最近分析项目").parentElement).not.toHaveTextContent("1");
    expect(screen.queryByRole("link", { name: "数据源" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "探索" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "模型" })).not.toBeInTheDocument();
  });
});

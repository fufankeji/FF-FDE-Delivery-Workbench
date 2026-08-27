import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArchitecturePage } from "./ArchitecturePage";

describe("project architecture workspace", () => {
  afterEach(cleanup);

  it("filters real runtime flows and opens source-backed node details", () => {
    render(<ArchitecturePage />);

    expect(screen.getByText("从一句业务问题，到一条可追溯的数据证据链。")).toBeVisible();
    expect(screen.getByText("16")).toBeVisible();
    expect(screen.getByText("15")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "机器学习" }));
    expect(screen.getByText(/结构化特征进入隔离训练进程/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "查看 只读查询引擎 的架构与源码" }));
    expect(screen.getByRole("dialog", { name: "只读查询引擎" })).toBeVisible();
    expect(screen.getByText("backend/northlight/query_service.py:90-158")).toBeVisible();
    expect(screen.getByLabelText("只读查询引擎 关键源码")).toHaveTextContent("class QueryService");

    fireEvent.click(screen.getByRole("button", { name: "关闭源码" }));
    expect(screen.queryByRole("dialog", { name: "只读查询引擎" })).not.toBeInTheDocument();
  });

  it("marks external services without inventing source code", () => {
    render(<ArchitecturePage />);
    fireEvent.click(screen.getByRole("button", { name: "查看 本地与数据库数据 的架构与源码" }));
    expect(screen.getByRole("dialog", { name: "本地与数据库数据" })).toHaveTextContent("外部组件");
    expect(screen.queryByLabelText("本地与数据库数据 关键源码")).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import type { DataAsset, Skill, SystemOverview } from "../types";
import { DataPage } from "./DataPage";
import { SettingsPage } from "./SettingsPage";
import { SkillsPage } from "./SkillsPage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPage(node: React.ReactNode, seed: (client: QueryClient) => void, entry = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter></QueryClientProvider>);
}

describe("global management pages", () => {
  it("presents reusable data assets and project usage", () => {
    const asset: DataAsset = {
      id: "asset-1", type: "csv", name: "olist_orders.csv", description: "订单与履约数据", tags: ["电商", "履约"], status: "ready", fingerprint: "a".repeat(64),
      baseline: { rows: 100, fields: [{ name: "order_id", dtype: "string" }], bytes: 2048 }, created_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T10:00:00Z",
      usage: [{ project_id: "project-1", project_title: "Olist 经营分析", source_id: "source-1", bound_at: "2026-08-03T10:00:00Z" }],
    };
    renderPage(<DataPage />, (client) => { client.setQueryData(["data-assets"], [asset]); client.setQueryData(["projects"], []); client.setQueryData(["data-asset-preview", "asset-1", ""], { asset_id: "asset-1", unit: "csv", units: ["csv"], offset: 0, limit: 200, total: 100, columns: ["order_id"], fields: [{ name: "order_id", dtype: "string", nulls: 0, unique: 100, description: "订单唯一编号" }], rows: [{ order_id: "o-1" }] }); });
    expect(screen.getByRole("heading", { name: "数据资产" })).toBeVisible();
    expect(screen.getByText("olist_orders.csv")).toBeVisible();
    fireEvent.click(screen.getByText("olist_orders.csv"));
    expect(screen.getByText("Olist 经营分析")).toBeVisible();
    expect(screen.getByRole("button", { name: "删除 olist_orders.csv" })).toBeDisabled();
  });

  it("keeps Skills global and exposes permissions instead of project run history", () => {
    const skill: Skill = {
      id: "complete-analysis-report@abc", name: "complete-analysis-report", version: "1.0.0", content_hash: "b".repeat(64), has_scripts: false, default_for_new_projects: false,
      display_name: "完整数据分析报告", body_excerpt: "先读取当前项目的数据源、查询、图表与模型证据，再判断需要补齐的分析。", highlights: ["用业务主题组织结论、证据与行动", "只写当前项目产物能支持的数字"], applies_to: ["reporting"],
      origin: "builtin", project_count: 1, project_titles: ["Olist 经营分析"], manifest: { file_count: 2, front_matter: { description: "生成完整、可追溯的数据分析报告", permissions: { files: "project-read-write", database: "read-only", network: "none", code: "structured-tools-only" }, applies_to: ["reporting"] } },
    };
    renderPage(<SkillsPage />, (client) => { client.setQueryData(["skills"], [skill]); client.setQueryData(["skill-inspection", skill.id, "SKILL.md"], { skill_id: skill.id, files: [{ path: "SKILL.md", kind: "file", size: 1200 }], selected_path: "SKILL.md", content: "# 完整数据分析报告\n\n这是完整方法。", truncated: false }); });
    expect(screen.getByRole("heading", { name: "Skills技能中心" })).toBeVisible();
    expect(screen.queryByText("Skill 运行与输出")).not.toBeInTheDocument();
    expect(screen.getByText("用业务主题组织结论、证据与行动")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "阅读完整 SKILL.md" }));
    expect(screen.getByText("这是完整方法。")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "最大化阅读区域" }));
    expect(document.querySelector(".skill-inspector-modal")).toHaveClass("reader-expanded");
    fireEvent.click(screen.getByRole("button", { name: "退出最大化阅读" }));
    fireEvent.click(screen.getByText("Skill 权限与安装信息"));
    expect(screen.getByText("声明权限")).toBeVisible();
    expect(screen.getByText("Skill 结构")).toBeVisible();
    expect(screen.getByText("Olist 经营分析")).toBeVisible();
  });

  it("organizes system settings by responsibility", () => {
    const overview: SystemOverview = { status: "ok", model: "configured", mysql: "not_configured", sandbox: "docker", project_count: 2, data_asset_count: 1, installed_skill_count: 1, runtime_bytes: 1024, trash_items: 0, max_upload_bytes: 500_000_000, max_project_source_bytes: 2_000_000_000, query_row_limit: 5000, query_timeout_seconds: 60, training_timeout_seconds: 1800 };
    renderPage(<SettingsPage />, (client) => { client.setQueryData(["system-overview"], overview); client.setQueryData(["model-connection"], { configured: true, model_name: "deepseek-v4-flash", base_url: "https://api.deepseek.com", source: "protected-runtime", tested: false, detail: "" }); });
    expect(screen.getByRole("heading", { name: "系统设置" })).toBeVisible();
    expect(screen.getByText("deepseek-v4-flash")).toBeVisible();
    expect(screen.getByLabelText("API Key")).toHaveAttribute("type", "password");
    expect(screen.getByText("模型 API 与凭证")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "数据与安全" }));
    expect(screen.getByText("数据库只读")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "存储与导出" }));
    expect(screen.getByText("先留存项目文件")).toBeVisible();
  });

  it("submits a newly entered API Key without reading a saved secret back", async () => {
    const overview: SystemOverview = { status: "ok", model: "configured", mysql: "not_configured", sandbox: "docker", project_count: 2, data_asset_count: 1, installed_skill_count: 10, runtime_bytes: 1024, trash_items: 0, max_upload_bytes: 500_000_000, max_project_source_bytes: 2_000_000_000, query_row_limit: 5000, query_timeout_seconds: 60, training_timeout_seconds: 1800 };
    const status = { configured: true, model_name: "deepseek-v4-flash", base_url: "https://api.deepseek.com", source: "protected-runtime", tested: true, detail: "模型连接与最小响应测试通过" };
    const update = vi.spyOn(api, "updateModelConnection").mockResolvedValue(status);
    vi.spyOn(api, "modelConnection").mockResolvedValue(status);
    vi.spyOn(api, "systemOverview").mockResolvedValue(overview);
    renderPage(<SettingsPage />, (client) => { client.setQueryData(["system-overview"], overview); client.setQueryData(["model-connection"], status); });

    fireEvent.change(screen.getByLabelText("API Key", { selector: "input" }), { target: { value: "new-user-key" } });
    fireEvent.click(screen.getByRole("button", { name: "验证并保存" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ api_key: "new-user-key", model_name: "deepseek-v4-flash", base_url: "https://api.deepseek.com" }));
    await waitFor(() => expect(screen.getByLabelText("API Key", { selector: "input" })).toHaveValue(""));
    expect(screen.queryByDisplayValue("new-user-key")).not.toBeInTheDocument();
  });

  it("opens a settings subtab from the URL", () => {
    const overview: SystemOverview = { status: "ok", model: "configured", mysql: "not_configured", sandbox: "docker", project_count: 2, data_asset_count: 1, installed_skill_count: 1, runtime_bytes: 1024, trash_items: 0, max_upload_bytes: 500_000_000, max_project_source_bytes: 2_000_000_000, query_row_limit: 5000, query_timeout_seconds: 60, training_timeout_seconds: 1800 };
    renderPage(<SettingsPage />, (client) => { client.setQueryData(["system-overview"], overview); client.setQueryData(["model-connection"], { configured: true, model_name: "deepseek-v4-flash", base_url: "https://api.deepseek.com", source: "protected-runtime", tested: false, detail: "" }); }, "/settings?tab=appearance");
    expect(screen.getByRole("tab", { name: "界面外观" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("选择适合当前工作环境的明暗模式与背景主题。修改会立即应用到首页和分析工作台。")).toBeVisible();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisRun, Artifact, Message } from "../types";
import { MessageBubble, ProjectContextPanel } from "./ChatPage";

vi.mock("echarts-for-react", () => ({ default: () => <div data-testid="message-chart" /> }));
afterEach(cleanup);

describe("chat artifact results", () => {
  it("renders the real message artifact and switches from table to chart", () => {
    const artifact: Artifact = {
      id: "extract-1",
      project_id: "project-1",
      type: "extract",
      name: "Revenue by state",
      path: "datasets/extract.parquet",
      sha256: "1234567890abcdef",
      status: "ready",
      metadata: {
        rows: 2,
        columns: ["state", "revenue"],
        preview: [{ state: "SP", revenue: 120 }, { state: "RJ", revenue: 60 }],
      },
      lineage: ["source-1"],
      created_at: "2026-08-03T10:00:00Z",
    };
    const message: Message = {
      id: "message-1",
      project_id: "project-1",
      role: "assistant",
      intent: "data_qa",
      content: "## 结论\n\n- **SP** 收入最高。\n- 建议继续检查 `revenue` 口径。",
      tool_calls: ["run_read_only_query"],
      artifacts: [artifact.id],
      created_at: "2026-08-03T10:00:00Z",
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(
      ["artifact-data", "project-1", "extract-1", 0, "", "asc", "", ""],
      { artifact_id: "extract-1", offset: 0, limit: 25, columns: ["state", "revenue"], rows: artifact.metadata.preview, total: 2 },
    );
    render(<QueryClientProvider client={client}><MemoryRouter><MessageBubble message={message} artifacts={[artifact]} projectId="project-1" onOpenReport={() => undefined} /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: "结论" })).toBeVisible();
    expect(screen.getByText("SP", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("revenue", { selector: "code" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "SP" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "120" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "产物图表视图" }));
    expect(screen.getByTestId("message-chart")).toBeVisible();
    expect(screen.queryByLabelText("图表类型")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "调整图表" }));
    expect(screen.getByLabelText("图表类型")).toBeVisible();
  });

  it("uses one disclosed dataset for an agent visual chart and table", () => {
    const source: Artifact = { id: "query-1", project_id: "project-1", type: "extract", name: "Sales by state", path: "datasets/sales.parquet", sha256: "abc1234567890def", status: "ready", metadata: { rows: 2, columns: ["state", "sales"] }, lineage: ["source-1"], created_at: "2026-08-03T10:00:00Z" };
    const visual: Artifact = { id: "visual-1", project_id: "project-1", type: "visual", name: "地区销售额", path: "visuals/visual-1.json", sha256: "def1234567890abc", status: "ready", metadata: { chart_type: "bar", x: "state", y: ["sales"], data_scope: { rows_used: 2, total_rows: 2, truncated: false } }, lineage: [source.id], created_at: "2026-08-03T10:00:01Z" };
    const message: Message = { id: "message-2", project_id: "project-1", role: "assistant", intent: "visualization", content: "图表已经生成。", tool_calls: ["create_visual"], artifacts: [visual.id], created_at: "2026-08-03T10:00:02Z" };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["visual-data", "project-1", "visual-1"], { visual_id: visual.id, source_artifact_id: source.id, artifact_id: source.id, offset: 0, limit: 2, columns: ["state", "sales"], rows: [{ state: "华东", sales: 180 }, { state: "华南", sales: 120 }], total: 2, scope: { total_rows: 2, rows_used: 2, truncated: false, strategy: "complete_result", max_points: 500 } });
    render(<QueryClientProvider client={client}><MemoryRouter><MessageBubble message={message} artifacts={[visual, source]} projectId="project-1" onOpenReport={() => undefined} /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText("使用 2 / 2 行 · 完整结果")).toBeVisible();
    expect(screen.getByTestId("message-chart")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "产物表格视图" }));
    expect(screen.getByRole("cell", { name: "华东" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "180" })).toBeVisible();
  });

  it("keeps the internal agent receipt out of the conversation surface", () => {
    const receipt: Artifact = { id: "run-receipt-1", project_id: "project-1", type: "agent_run", name: "Agent run", path: "runs/run.json", sha256: "abc1234567890def", status: "ready", metadata: {}, lineage: [], created_at: "2026-08-03T10:00:01Z" };
    const message: Message = { id: "message-3", project_id: "project-1", role: "assistant", intent: "data_qa", content: "分析完成。", tool_calls: [], artifacts: [receipt.id], created_at: "2026-08-03T10:00:02Z" };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><MessageBubble message={message} artifacts={[receipt]} projectId="project-1" onOpenReport={() => undefined} /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText("分析完成。")).toBeVisible();
    expect(screen.queryByText(/已保存可追溯产物/)).not.toBeInTheDocument();
  });

  it("shows a durable run with visible steps and recovery actions", () => {
    const run: AnalysisRun = { id: "run-1", project_id: "project-1", trigger_message_id: "message-1", result_message_id: "message-2", retry_of_run_id: null, title: "按地区汇总销售额，并生成可交互柱状图", intent: "visualization", status: "failed", source_ids: ["source-1"], skill_ids: [], plan: [{ key: "inspect", label: "检查数据范围" }, { key: "analyze", label: "汇总并验证结果" }, { key: "present", label: "生成交互图表" }], artifact_ids: [], runtime: "deep-agents", cancel_requested: false, error: "查询字段不存在", started_at: "2026-08-03T10:00:00Z", completed_at: "2026-08-03T10:00:04Z", created_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T10:00:04Z", steps: [{ id: "step-1", run_id: "run-1", position: 1, key: "inspect", label: "检查数据范围", status: "succeeded", tool_names: ["list_data_sources"], call_ids: ["call-1"], input_fields: [], artifact_ids: [], error: null, started_at: "2026-08-03T10:00:00Z", completed_at: "2026-08-03T10:00:01Z" }, { id: "step-2", run_id: "run-1", position: 2, key: "analyze", label: "汇总并验证结果", status: "failed", tool_names: ["run_read_only_query"], call_ids: ["call-2"], input_fields: ["source_id", "sql"], artifact_ids: [], error: "查询字段不存在", started_at: "2026-08-03T10:00:01Z", completed_at: "2026-08-03T10:00:04Z" }] };
    const onRetry = vi.fn();
    render(<MemoryRouter><ProjectContextPanel tab="run" onTab={() => undefined} run={run} runs={[run]} onSelectRun={() => undefined} artifacts={[]} selectedArtifactId="" onSelectArtifact={() => undefined} report={null} projectId="project-1" onCloseReport={() => undefined} onCreateReport={() => undefined} createReportPending={false} onCancel={() => undefined} onRetry={onRetry} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "运行失败" })).toBeVisible();
    expect(screen.getByText("检查数据范围")).toBeVisible();
    expect(screen.getByText("汇总并验证结果")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "从中断步骤重试" }));
    expect(onRetry).toHaveBeenCalledWith(run);
  });
});

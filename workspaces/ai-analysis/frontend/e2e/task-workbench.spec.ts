import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:18000";

test("task workbench keeps global navigation stable and exposes durable runs", async ({ page, request }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  const projectResponse = await request.post(`${API_BASE}/api/projects`, { data: { title: "任务中心验收" } });
  const project = await projectResponse.json();
  const upload = await request.post(`${API_BASE}/api/projects/${project.id}/sources/file`, {
    multipart: {
      source_type: "csv",
      upload: { name: "orders.csv", mimeType: "text/csv", buffer: Buffer.from("region,sales\n华东,180\n华南,120\n华东,40\n") },
    },
  });
  const source = await upload.json();
  const queryResponse = await request.post(`${API_BASE}/api/projects/${project.id}/query`, { data: { source_id: source.id, sql: "SELECT region, SUM(sales) AS sales FROM data GROUP BY region ORDER BY sales DESC", name: "地区销售额" } });
  const queryArtifact = await queryResponse.json();
  const visualResponse = await request.post(`${API_BASE}/api/projects/${project.id}/charts`, { data: { artifact_id: queryArtifact.id, chart_type: "bar", x: "region", y: ["sales"], title: "地区销售额交互柱状图" } });
  const visual = await visualResponse.json();
  await request.post(`${API_BASE}/api/projects/${project.id}/messages/artifacts`, { data: { artifact_ids: [visual.id], content: "已按地区汇总销售额，并生成可交互柱状图。", intent: "visualization" } });
  const chatResponse = await request.post(`${API_BASE}/api/projects/${project.id}/chat`, { data: { message: "查询当前数据范围", source_ids: [source.id] } });
  expect(chatResponse.ok()).toBeTruthy();
  const runResponse = await request.get(`${API_BASE}/api/projects/${project.id}/runs`);
  expect(runResponse.ok()).toBeTruthy();
  expect((await runResponse.json()).length).toBe(1);

  await page.goto(`/projects/${project.id}/chat`);
  await expect(page.getByRole("navigation", { name: "主要导航" }).getByRole("link")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "数据资产" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skills技能中心" })).toBeVisible();
  await expect(page.getByRole("link", { name: "系统设置" })).toBeVisible();
  await expect(page.getByRole("link", { name: "功能架构" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "已完成" })).toBeVisible();
  await expect(page.getByText("查询当前数据范围", { exact: true }).last()).toBeVisible();

  await page.getByRole("button", { name: "项目数据" }).click();
  const dataWorkbench = page.getByRole("dialog", { name: "项目分析工作台" });
  await expect(dataWorkbench.getByText("orders.csv", { exact: true })).toBeVisible();
  await expect(dataWorkbench.getByText("自动选择全部可用数据", { exact: true })).toBeVisible();
  await dataWorkbench.getByRole("button", { name: "关闭" }).click();

  await page.getByRole("button", { name: "分析工具" }).click();
  const chartWorkbench = page.getByRole("dialog", { name: "项目分析工作台" });
  await expect(chartWorkbench.getByRole("heading", { name: "按字段组合创建交互图表" })).toBeVisible();
  await expect(chartWorkbench.getByLabel("维度字段")).toHaveValue("region");
  await expect(chartWorkbench.getByLabel("数值字段")).toHaveValue("sales");
  await expect(chartWorkbench.locator("canvas")).toBeVisible();
  await chartWorkbench.getByRole("button", { name: "关闭" }).click();

  const visualCard = page.locator(".interactive-result").filter({ hasText: "地区销售额交互柱状图" });
  await expect(visualCard).toContainText("使用 2 / 2 行 · 完整结果");
  await expect(visualCard.locator("canvas")).toBeVisible();
  await visualCard.getByRole("button", { name: "产物表格视图" }).click();
  await expect(visualCard.getByRole("cell", { name: "华东" })).toBeVisible();
  await expect(visualCard.getByRole("cell", { name: "220" })).toBeVisible();

  await page.getByRole("link", { name: "系统设置" }).click();
  await page.getByRole("tab", { name: "界面外观" }).click();
  await page.getByRole("button", { name: /浅色/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  await page.goto(`/projects/${project.id}/chat`);
  await expect(page.getByRole("button", { name: "运行" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
  expect(browserErrors).toEqual([]);
});

test("report shortcut stays within the selected run artifact scope", async ({ page, request }) => {
  const projectResponse = await request.post(`${API_BASE}/api/projects`, { data: { title: "多轮报告归属验收" } });
  const project = await projectResponse.json();
  for (const message of ["请生成第一份完整数据分析报告", "请生成第二份完整数据分析报告"]) {
    const response = await request.post(`${API_BASE}/api/projects/${project.id}/chat`, { data: { message } });
    expect(response.ok()).toBeTruthy();
  }
  const before = await (await request.get(`${API_BASE}/api/projects/${project.id}/runs`)).json();
  expect(before).toHaveLength(2);
  const selectedRun = before[0];
  const otherRun = before[1];
  expect(selectedRun.artifact_ids).toHaveLength(1);
  expect(otherRun.artifact_ids).toHaveLength(1);

  await page.goto(`/projects/${project.id}/chat`);
  await expect(page.getByRole("heading", { name: "已完成" })).toBeVisible();
  await page.getByRole("button", { name: "生成报告", exact: true }).click();
  await expect(page.locator(".report-canvas")).toBeVisible();

  await expect.poll(async () => {
    const reports = await (await request.get(`${API_BASE}/api/projects/${project.id}/reports`)).json();
    return reports.find((report: { run_id: string | null }) => report.run_id === selectedRun.id)?.artifact_ids ?? [];
  }).toEqual(selectedRun.artifact_ids);
  const after = await (await request.get(`${API_BASE}/api/projects/${project.id}/runs`)).json();
  const refreshed = after.find((run: { id: string }) => run.id === selectedRun.id);
  expect(refreshed.artifact_ids.length).toBe(2);
  expect(refreshed.artifact_ids).not.toContain(otherRun.artifact_ids[0]);
});

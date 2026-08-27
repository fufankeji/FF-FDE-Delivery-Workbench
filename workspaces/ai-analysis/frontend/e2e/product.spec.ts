import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:18000";

test("project isolation, exploration, chart and report canvas form one vertical path", async ({ page, request }) => {
  const projectResponse = await request.post(`${API_BASE}/api/projects`, {
    data: { title: "E2E 履约分析" },
  });
  expect(projectResponse.ok()).toBeTruthy();
  const project = await projectResponse.json();
  const fixture = fileURLToPath(new URL("./fixtures/orders.csv", import.meta.url));
  const uploadResponse = await request.post(
    `${API_BASE}/api/projects/${project.id}/sources/file`,
    {
      multipart: {
        source_type: "csv",
        upload: {
          name: "orders.csv",
          mimeType: "text/csv",
          buffer: await readFile(fixture),
        },
      },
    },
  );
  expect(uploadResponse.ok()).toBeTruthy();
  const source = await uploadResponse.json();

  await page.goto(`/projects/${project.id}/explore`);
  const sourceSelect = page.getByLabel("数据源");
  const selectStyle = await sourceSelect.evaluate((element) => {
    const style = getComputedStyle(element);
    return { appearance: style.appearance, backgroundImage: style.backgroundImage, borderRadius: style.borderRadius };
  });
  expect(selectStyle.appearance).toBe("none");
  expect(selectStyle.backgroundImage).toContain("svg");
  expect(Number.parseFloat(selectStyle.borderRadius)).toBeGreaterThanOrEqual(8);
  await sourceSelect.selectOption(source.id);
  await page.locator("textarea.sql-editor").fill(
    "SELECT state, SUM(revenue) AS revenue FROM data GROUP BY state ORDER BY revenue DESC",
  );
  await page.getByRole("button", { name: "运行并保存结果" }).click();
  await expect(page.getByText("内容哈希")).toBeVisible();
  await expect(page.getByRole("cell", { name: "SP" })).toBeVisible();
  await page.getByRole("button", { name: "柱状图视图" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  const savedChartResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/projects/${project.id}/charts`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存图表产物" }).click();
  expect((await savedChartResponse).ok()).toBeTruthy();
  const artifactsAfterChart = await (
    await request.get(`${API_BASE}/api/projects/${project.id}/artifacts`)
  ).json();
  const savedVisual = artifactsAfterChart.find((item: { type: string }) => item.type === "visual");
  expect(savedVisual).toBeTruthy();
  const shared = await request.post(
    `${API_BASE}/api/projects/${project.id}/messages/artifacts`,
    { data: { artifact_ids: [savedVisual.lineage[0]], content: "地区收入查询已加入会话。", intent: "data_qa" } },
  );
  expect(shared.ok()).toBeTruthy();

  const normal = await request.post(
    `${API_BASE}/api/projects/${project.id}/chat`,
    { data: { message: "你好，请解释平均数" } },
  );
  expect((await normal.json()).tool_calls).toEqual([]);
  const reportChat = await request.post(
    `${API_BASE}/api/projects/${project.id}/chat`,
    { data: { message: "请生成完整数据分析报告" } },
  );
  expect((await reportChat.json()).tool_calls).toContain("complete-analysis-report");

  await page.goto(`/projects/${project.id}/chat`);
  const resultCard = page.locator(".interactive-result").filter({ hasText: "探索结果" });
  await expect(resultCard).toBeVisible();
  await resultCard.getByLabel("筛选字段").selectOption("state");
  await resultCard.getByLabel("筛选值").fill("SP");
  await expect(resultCard.getByRole("cell", { name: "SP" })).toBeVisible();
  await resultCard.getByRole("button", { name: "产物图表视图" }).click();
  await resultCard.getByRole("button", { name: "调整图表" }).click();
  await resultCard.getByLabel("图表类型").selectOption("pie");
  await expect(resultCard.locator("canvas")).toBeVisible();
  await resultCard.getByRole("button", { name: "保存视图" }).click();
  const downloadPromise = page.waitForEvent("download");
  await resultCard.getByRole("button", { name: "图片" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("探索结果.png");
  const assistantRows = page.locator(".message-row.assistant");
  const assistantCount = await assistantRows.count();
  await page.locator(".composer textarea").fill("你好，请解释中位数");
  await page.locator(".composer textarea").press("Enter");
  await expect(assistantRows).toHaveCount(assistantCount + 1);
  await expect(page.getByText(/DeepSeek-V4-Flash 凭证尚未注入/).last()).toBeVisible();
  await page.locator(".message-row.assistant .report-result-card").click();
  await expect(page.locator(".report-canvas")).toBeVisible();
  const contextWidth = (await page.locator(".project-context").boundingBox())!.width;
  const conversationWidth = (await page.locator(".conversation-column").boundingBox())!.width;
  await page.getByRole("button", { name: "收起项目上下文" }).click();
  await expect(page.locator(".project-context")).toBeHidden();
  await expect.poll(async () => (await page.locator(".conversation-column").boundingBox())!.width).toBeGreaterThan(conversationWidth + contextWidth * 0.8);
  await page.getByRole("button", { name: "展开项目上下文" }).click();
  await expect.poll(async () => (await page.locator(".conversation-column").boundingBox())!.width).toBeCloseTo(conversationWidth, 0);
  for (const tabIndex of [0, 1, 2]) {
    await page.locator(".context-tabs > button").nth(tabIndex).click();
    await expect.poll(async () => (await page.locator(".project-context").boundingBox())!.width).toBeCloseTo(contextWidth, 0);
    await expect.poll(async () => (await page.locator(".conversation-column").boundingBox())!.width).toBeCloseTo(conversationWidth, 0);
  }
  const openOutlineWidth = (await page.locator(".canvas-outline").boundingBox())!.width;
  await page.getByRole("button", { name: "收起报告目录" }).click();
  await expect(page.getByRole("button", { name: "展开报告目录" })).toBeVisible();
  await expect.poll(async () => (await page.locator(".canvas-outline").boundingBox())!.width).toBeLessThan(openOutlineWidth / 2);
  await page.getByRole("button", { name: "展开报告目录" }).click();
  await expect.poll(async () => (await page.locator(".canvas-outline").boundingBox())!.width).toBeCloseTo(openOutlineWidth, 0);
  await page.getByRole("button", { name: "编辑 MD" }).click();
  const editor = page.locator("textarea.markdown-editor");
  await editor.fill(`${await editor.inputValue()}\n\n## E2E 修订\n\n该段来自浏览器端版本测试。\n\n| first_order_customers | full_window_customers | delivered_first_orders | missing_review_customers | neutral_review_customers | eligible_customers | repeat_customers | repeat_180d_rate |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 100 | 90 | 88 | 4 | 6 | 70 | 12 | 0.17 |`);
  await page.getByRole("button", { name: "保存新版本" }).click();
  await expect(page.getByText(/v2 \/ 2/)).toBeVisible();
  const tableFrame = page.locator(".report-table-frame").last();
  const tableScroller = tableFrame.locator(".report-table-scroll");
  await expect(tableFrame.getByText("横向滚动查看全部字段")).toBeVisible();
  expect(await tableScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBeTruthy();
  expect(await tableFrame.evaluate((element) => element.getBoundingClientRect().right <= element.closest(".canvas-paper")!.getBoundingClientRect().right + 1)).toBeTruthy();
  await page.getByRole("button", { name: "生成 HTML", exact: true }).click();
  await expect(page.getByText(/HTML 已从 v2 生成/)).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "在新窗口查看" }).click();
  const reportPage = await popupPromise;
  await expect(reportPage.getByRole("heading", { name: "交互图表", exact: true })).toBeVisible();
  await expect(reportPage.locator("#report-chart-1 svg")).toBeVisible();
  const htmlTableFrame = reportPage.locator(".report-table-frame").last();
  await expect(htmlTableFrame).toHaveClass(/is-overflowing/);
  expect(await htmlTableFrame.evaluate((element) => element.getBoundingClientRect().right <= element.closest(".page")!.getBoundingClientRect().right + 1)).toBeTruthy();
  await reportPage.close();

  const unsafe = await request.post(
    `${API_BASE}/api/projects/${project.id}/query`,
    { data: { source_id: source.id, sql: "DELETE FROM data", name: "unsafe" } },
  );
  expect(unsafe.status()).toBe(400);
  const hostRead = await request.post(
    `${API_BASE}/api/projects/${project.id}/query`,
    { data: { source_id: source.id, sql: "SELECT content FROM read_text('/etc/hosts')", name: "host read" } },
  );
  expect(hostRead.status()).toBe(400);
  const otherProject = await (
    await request.post(`${API_BASE}/api/projects`, { data: { title: "Other project" } })
  ).json();
  const crossProject = await request.post(
    `${API_BASE}/api/projects/${otherProject.id}/query`,
    { data: { source_id: source.id, sql: "SELECT * FROM data", name: "forbidden" } },
  );
  expect(crossProject.status()).toBe(404);
});

test("Skill quality inspection, defaults and project lifecycle are visible product flows", async ({ page, request }) => {
  const project = await (
    await request.post(`${API_BASE}/api/projects`, { data: { title: "Lifecycle project" } })
  ).json();
  await page.goto("/skills");
  const reportSkill = page.locator(".library-skill-card").filter({ hasText: "complete-analysis-report" }).last();
  await reportSkill.getByRole("button", { name: "阅读完整 SKILL.md" }).click();
  const inspector = page.locator(".skill-inspector-modal");
  await expect(inspector.getByRole("heading", { name: "完整数据分析报告" }).first()).toBeVisible();
  await expect(inspector.getByText("SKILL.md 元数据")).toBeVisible();
  await expect(inspector.getByText(/技术 ID 与哈希只进入末尾复现附录/).first()).toBeVisible();
  await page.getByRole("button", { name: "检查完成" }).click();
  const defaultToggle = reportSkill.getByRole("checkbox");
  if (!(await defaultToggle.isChecked())) await reportSkill.locator(".default-skill-toggle").click();
  await expect(defaultToggle).toBeChecked();

  const renamedTitle = `Lifecycle renamed ${project.id.slice(0, 8)}`;
  const renamed = await request.patch(`${API_BASE}/api/projects/${project.id}`, {
    data: { title: renamedTitle, status: "archived" },
  });
  expect(renamed.ok()).toBeTruthy();
  const exported = await request.get(`${API_BASE}/api/projects/${project.id}/export`);
  expect(exported.ok()).toBeTruthy();
  expect(exported.headers()["content-type"]).toContain("application/zip");
  await page.goto("/");
  await page.getByRole("button", { name: "查看归档" }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`${renamedTitle}.*只读查看归档`) }),
  ).toBeVisible();
});

test("report chart data cannot escape the inline JSON script in Chromium", async ({ page, request }) => {
  const project = await (
    await request.post(`${API_BASE}/api/projects`, { data: { title: "XSS report" } })
  ).json();
  const attack = "</script><script>globalThis.NORTHLIGHT_XSS=7731</script>";
  const upload = await request.post(
    `${API_BASE}/api/projects/${project.id}/sources/file`,
    {
      multipart: {
        source_type: "csv",
        upload: {
          name: "labels.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(`label,value\n"${attack}",1\n`, "utf8"),
        },
      },
    },
  );
  const source = await upload.json();
  const query = await request.post(`${API_BASE}/api/projects/${project.id}/query`, {
    data: { source_id: source.id, sql: "SELECT label, value FROM data", name: "Untrusted labels" },
  });
  expect(query.ok()).toBeTruthy();
  const extract = await query.json();
  const chart = await (
    await request.post(`${API_BASE}/api/projects/${project.id}/charts`, {
      data: { artifact_id: extract.id, chart_type: "bar", x: "label", y: ["value"], title: "Untrusted chart" },
    })
  ).json();
  const report = await (
    await request.post(`${API_BASE}/api/projects/${project.id}/reports`, {
      data: { title: "Safe report", artifact_ids: [extract.id, chart.id] },
    })
  ).json();
  const rendered = await request.post(
    `${API_BASE}/api/projects/${project.id}/reports/${report.report_key}/html/${report.version}`,
  );
  expect(rendered.ok()).toBeTruthy();
  await page.goto(
    `${API_BASE}/api/projects/${project.id}/reports/${report.report_key}/html/${report.version}`,
  );
  expect(
    await page.evaluate(
      () => (globalThis as typeof globalThis & { NORTHLIGHT_XSS?: number }).NORTHLIGHT_XSS,
    ),
  ).toBeUndefined();
  await expect(page.locator("#report-chart-1 svg")).toBeVisible();
});

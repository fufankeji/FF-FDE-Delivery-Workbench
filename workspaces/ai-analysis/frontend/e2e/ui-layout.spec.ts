import { expect, test } from "@playwright/test";

const API_BASE = process.env.E2E_API_URL ?? "http://127.0.0.1:18000";

test("sidebar supports pointer resize, collapse and retained expansion width", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem("northlight-sidebar-width");
    localStorage.removeItem("northlight-sidebar-collapsed");
  });
  await page.goto("/");

  const sidebar = page.locator(".sidebar");
  const resizeHandle = page.getByRole("separator", { name: "拖拽调整左侧栏宽度" });
  const initialBox = await sidebar.boundingBox();
  const handleBox = await resizeHandle.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 180);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2 + 54, handleBox!.y + 180, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeGreaterThan(initialBox!.width + 40);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("northlight-sidebar-width"))).not.toBeNull();
  const storedWidth = Number(await page.evaluate(() => localStorage.getItem("northlight-sidebar-width")));
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeCloseTo(storedWidth, 0);
  const resizedWidth = (await sidebar.boundingBox())!.width;
  expect(storedWidth).toBe(Math.round(resizedWidth));

  await page.getByRole("button", { name: "收起左侧栏" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBe(76);
  await expect(page.getByRole("button", { name: "展开左侧栏" })).toBeVisible();

  await page.getByRole("button", { name: "展开左侧栏" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeCloseTo(resizedWidth, 0);
});

test("direct desktop chat navigation keeps the project header and context in view", async ({ page, request }) => {
  const response = await request.post(`${API_BASE}/api/projects`, {
    data: { title: "Desktop layout project" },
  });
  expect(response.ok()).toBeTruthy();
  const project = await response.json();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`/projects/${project.id}/chat`);
  const header = page.locator(".conversation-header");
  await expect(header).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect((await header.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  await expect(page.getByRole("button", { name: "收起项目上下文" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "尚无分析运行" })).toBeVisible();
  await page.locator(".composer textarea").fill("你好，请解释平均数");
  await page.locator(".composer textarea").press("Enter");
  await expect(page.getByText(/DeepSeek-V4-Flash 凭证尚未注入/).last()).toBeVisible();
  await expect(header).toBeVisible();
});

test("global navigation and analysis projects keep one visual shell", async ({ page, request }) => {
  const response = await request.post(`${API_BASE}/api/projects`, {
    data: { title: "Unified shell project" },
  });
  expect(response.ok()).toBeTruthy();
  const project = await response.json();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/data");
  await expect(page.getByRole("region", { name: "DS4 智能工作区" })).toContainText("DS4 WORKSPACE");

  const globalShell = await page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar")!.getBoundingClientRect();
    const main = document.querySelector(".main-stage")!.getBoundingClientRect();
    return {
      sidebar: [sidebar.x, sidebar.y, sidebar.width, sidebar.height],
      main: [main.x, main.y, main.width, main.height],
      frameImage: getComputedStyle(document.querySelector(".app-frame")!).backgroundImage,
      framePseudo: getComputedStyle(document.querySelector(".app-frame")!, "::before").content,
      sidebarImage: getComputedStyle(document.querySelector(".sidebar")!).backgroundImage,
      cardImage: getComputedStyle(document.querySelector(".sidebar-editorial-card")!).backgroundImage,
    };
  });

  await page.locator(`a.history-item[href="/projects/${project.id}/chat"]`).click();
  await expect(page.getByRole("region", { name: "DS4 智能工作区" })).toContainText("DS4 ANALYSIS");
  const projectShell = await page.evaluate(() => {
    const sidebar = document.querySelector(".sidebar")!.getBoundingClientRect();
    const main = document.querySelector(".main-stage")!.getBoundingClientRect();
    return {
      sidebar: [sidebar.x, sidebar.y, sidebar.width, sidebar.height],
      main: [main.x, main.y, main.width, main.height],
      frameImage: getComputedStyle(document.querySelector(".app-frame")!).backgroundImage,
      framePseudo: getComputedStyle(document.querySelector(".app-frame")!, "::before").content,
      sidebarImage: getComputedStyle(document.querySelector(".sidebar")!).backgroundImage,
      cardImage: getComputedStyle(document.querySelector(".sidebar-editorial-card")!).backgroundImage,
      conversationImageLayer: getComputedStyle(document.querySelector(".conversation-column")!, "::after").content,
    };
  });

  expect(projectShell.sidebar).toEqual(globalShell.sidebar);
  expect(projectShell.main).toEqual(globalShell.main);
  expect(projectShell.frameImage).toEqual(globalShell.frameImage);
  expect(projectShell.framePseudo).toBe("none");
  expect(projectShell.sidebarImage).not.toContain("url(");
  expect(projectShell.cardImage).toContain("url(");
  expect(projectShell.conversationImageLayer).toBe("none");
});

import { expect, test } from "@playwright/test";

test("architecture canvas stays verifiable and interactive", async ({ page }) => {
  await page.goto("/architecture");
  await expect(page.getByRole("heading", { name: "从一句业务问题，到一条可追溯的数据证据链。" })).toBeVisible();

  const canvas = page.locator(".architecture-canvas");
  const viewport = page.getByTestId("architecture-viewport");
  const beforeZoom = await page.getByLabel("当前缩放比例").textContent();
  await page.getByRole("button", { name: "放大架构图" }).click();
  await expect(page.getByLabel("当前缩放比例")).not.toHaveText(beforeZoom ?? "");

  const beforePan = await canvas.getAttribute("style");
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 70, box!.y + 90);
  await page.mouse.down();
  await page.mouse.move(box!.x + 145, box!.y + 135, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => canvas.getAttribute("style")).not.toBe(beforePan);

  await page.getByRole("button", { name: "适应视口" }).click();
  const runtimeNode = page.getByRole("button", { name: "查看 任务意图与 Run 编排 的架构与源码" });
  await runtimeNode.hover();
  await expect(runtimeNode.getByRole("tooltip")).toBeVisible();
  await expect(runtimeNode.getByRole("tooltip")).toContainText("失败语义");

  await page.getByRole("button", { name: "机器学习", exact: true }).click();
  await expect(page.locator(".architecture-node.muted")).not.toHaveCount(0);

  await page.getByRole("button", { name: "查看 只读查询引擎 的架构与源码" }).click();
  const dialog = page.getByRole("dialog", { name: "只读查询引擎" });
  await expect(dialog).toContainText("backend/northlight/query_service.py:90-158");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByTestId("architecture-viewport")).toBeVisible();
  await expect(page.getByRole("link", { name: "功能架构" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /DS4-AI/ })).toBeVisible();
});

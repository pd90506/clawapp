import { test, expect } from "@playwright/test";

test("send a message, see streamed response with tool call", async ({ page }) => {
  await page.goto("/");
  // The shell opens with no session selected; click an agent row in the sidebar.
  await page.getByText("main", { exact: true }).click({ timeout: 10_000 });
  const composer = page.getByRole("textbox", { name: "Message input" });
  await expect(composer).toBeEnabled({ timeout: 15_000 });
  await composer.fill("hi");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/hello/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/world/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("search")).toBeVisible();
});

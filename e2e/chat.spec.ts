import { test, expect } from "@playwright/test";

test("send a message, see streamed response with tool call", async ({ page }) => {
  await page.goto("/");
  // The shell opens with no session selected; click the first session in the sidebar.
  await page.getByText("Test").click({ timeout: 10_000 });
  await expect(page.getByRole("textbox")).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("textbox").fill("hi");
  await page.getByRole("button", { name: /send/i }).click();
  await expect(page.getByText(/hello/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/world/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("search")).toBeVisible();
});

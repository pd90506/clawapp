import { test, expect } from "@playwright/test";
import { startFakeGateway } from "./fixtures/gateway";

const PORT = 39789;
const TOKEN = "test-token";

test("send a message, see streamed response with tool call", async ({ page }) => {
  const stop = await startFakeGateway(PORT, TOKEN);
  try {
    await page.goto("/");
    await expect(page.getByRole("textbox")).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("textbox").fill("hi");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(/hello/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/world/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("search")).toBeVisible();
  } finally {
    await stop();
  }
});

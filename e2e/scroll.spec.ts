import { test, expect } from "@playwright/test";

// Regression test for the tab-switch scroll bug: clicking a session tab must
// land at the bottom of the thread instantly, not animate a smooth crawl from
// the top. The crawl is visible as many intermediate scroll positions between
// top and bottom; an instant jump produces none.
test("switching session tabs lands at the bottom without animating from the top", async ({ page }) => {
  await page.goto("/");

  // Open the first agent and wait for its (long) history to load.
  await page.getByText("silver-wolf", { exact: true }).click({ timeout: 10_000 });
  await expect(page.getByText("Alpha message 40")).toBeVisible({ timeout: 15_000 });

  // Record every scroll position the thread passes through.
  await page.evaluate(() => {
    const el = document.querySelector(".thread") as HTMLElement;
    const rec = { samples: [] as number[] };
    (window as unknown as { __rec: typeof rec }).__rec = rec;
    el.addEventListener("scroll", () => rec.samples.push(el.scrollTop));
  });

  // Switch tabs; reset samples immediately before so we only capture the switch.
  await page.evaluate(() => {
    (window as unknown as { __rec: { samples: number[] } }).__rec.samples = [];
  });
  await page.getByText("main", { exact: true }).click();
  await expect(page.getByText("Beta message 40")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(700); // let any (unwanted) smooth animation play out

  const result = await page.evaluate(() => {
    const el = document.querySelector(".thread") as HTMLElement;
    const max = el.scrollHeight - el.clientHeight;
    const samples = (window as unknown as { __rec: { samples: number[] } }).__rec.samples;
    // The bug's signature: a smooth crawl that passes through the lower half of
    // the thread on its way down. An instant pin never dwells there.
    const lowerHalf = samples.filter((s) => s < max * 0.5).length;
    return { scrollTop: el.scrollTop, max, lowerHalf };
  });

  // Rests at the bottom...
  expect(result.scrollTop).toBeGreaterThan(result.max - 8);
  // ...and got there without crawling up through the top half (the bug).
  expect(result.lowerHalf).toBeLessThanOrEqual(1);
});

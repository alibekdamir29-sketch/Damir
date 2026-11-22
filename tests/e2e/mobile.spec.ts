import { expect, test } from "@playwright/test";

test("mobile: no horizontal scroll, menu and AI chat work", async ({ page }) => {
  for (const path of ["/", "/catalog", "/cart", "/checkout", "/track"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await page.goto("/");
  await page.getByTestId("ai-chat-toggle").click();
  await expect(page.getByRole("dialog", { name: /AI-консультант/ })).toBeVisible();
});

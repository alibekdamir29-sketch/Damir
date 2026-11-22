import { expect, test, type Page } from "@playwright/test";

test.skip(({ isMobile }) => isMobile, "desktop flow");

async function addFirstInStockProduct(page: Page) {
  await page.goto("/catalog?inStock=1");
  await page.getByTestId("product-card").first().click();
  await expect(page.getByTestId("product-title")).toBeVisible();
  const size = page.locator('[data-testid^="size-"]:not([disabled])').first();
  await size.click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toHaveText(/\d+/);
}

test("home page renders key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "DAMIR" }).first()).toBeVisible();
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await expect(page.getByTestId("ai-chat-toggle")).toBeVisible();
});

test("catalog filters and sorting", async ({ page }) => {
  await page.goto("/catalog");
  const total = Number((await page.getByTestId("catalog-total").innerText()).replace(/\D/g, ""));
  await page.goto("/catalog?category=hoodies");
  const hoodies = Number((await page.getByTestId("catalog-total").innerText()).replace(/\D/g, ""));
  expect(hoodies).toBeGreaterThan(0);
  expect(hoodies).toBeLessThan(total);
  await page.goto("/catalog?sort=price_asc");
  const prices = await page.locator('[data-testid="product-card"] [data-price]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-price"))));
  if (prices.length > 1) expect(prices).toEqual([...prices].sort((a, b) => a - b));
});

test("out-of-stock sizes cannot be selected", async ({ page }) => {
  await page.goto("/catalog");
  await page.getByTestId("product-card").first().click();
  const disabled = page.locator('[data-testid^="size-"][disabled]');
  if (await disabled.count()) await expect(disabled.first()).toBeDisabled();
});

test("cart persists, checkout with cash on delivery, then track the order", async ({ page }) => {
  await addFirstInStockProduct(page);
  await page.reload();
  await expect(page.getByTestId("cart-count")).toHaveText(/\d+/);

  await page.goto("/checkout");
  await page.locator("#firstName").fill("Тест");
  await page.locator("#lastName").fill("Покупатель");
  await page.locator("#phone").fill("+7 701 555 44 33");
  await page.getByTestId("checkout-next").click();
  await page.locator("#street").fill("пр. Абая");
  await page.locator("#house").fill("10");
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("pay-CASH_ON_DELIVERY").click();
  await page.getByTestId("checkout-next").click();
  await expect(page.getByTestId("confirm-items")).toBeVisible();
  await page.getByTestId("confirm-order").click();

  await expect(page.getByTestId("order-success")).toBeVisible({ timeout: 20_000 });
  const number = (await page.getByTestId("order-number").innerText()).replace("№", "").trim();
  expect(number).toMatch(/^DM-\d{4}-\d{4,}$/);
  await expect(page.getByTestId("order-status")).not.toContainText("Оплачен");
  await expect(page.getByTestId("cart-count")).toHaveCount(0);

  await page.goto("/track");
  await page.locator("#number").fill(number);
  await page.locator("#phone").fill("87015554433");
  await page.getByRole("button", { name: /найти|отследить/i }).click();
  await expect(page.getByText(`№${number}`).first()).toBeVisible();
  await expect(page.getByTestId("status-history")).toBeVisible();
});

test("admin area is protected", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  const res = await request.get("/api/admin/products");
  expect([401, 403]).toContain(res.status());
});

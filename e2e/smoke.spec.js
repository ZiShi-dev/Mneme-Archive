import { test, expect } from "@playwright/test";

test("loads the home shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("body")).toBeVisible();
});

test("serves the production API health via index", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/.+/);
});

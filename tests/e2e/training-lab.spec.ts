import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

test("public Training Lab is usable without login, while plans stay private", async ({ page }) => {
  await page.goto("/training");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mieux s'entraîner");
  await expect(page.getByRole("img", { name: "Comparer sur le radar" })).toBeVisible();
  await page.getByRole("button", { name: /Outils/ }).click();
  await expect(page.getByRole("heading", { name: "Fingerboard / hangboard" })).toBeVisible();
  await page.goto("/training-plans");
  await expect(page).toHaveURL(/\/login\?next=/);
});

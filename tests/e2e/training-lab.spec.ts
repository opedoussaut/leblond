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

test("public self-assessment and illustrative method scenarios need no login", async ({ page }) => {
  await page.goto("/training/evaluate");
  await expect(page.getByRole("heading", { name: "Ta progression en escalade" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Profil initial, scénario et évolution observée" })).toBeVisible();
  const slide = page.getByRole("slider", { name: "Technique" });
  await slide.fill("1");
  await expect(page.getByText("1.0 / 5", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /Simuler un bilan ultérieur/ }).check();
  await expect(page.getByText(/Rien n'est enregistré ici/)).toBeVisible();
  await page.goto("/training-assessment");
  await expect(page).toHaveURL(/\/login\?next=/);
});

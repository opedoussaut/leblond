import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

test("Training Lab and assessments require a signed-in profile", async ({ page }) => {
  await page.goto("/training");
  await expect(page).toHaveURL(/\/login\?next=%2Ftraining/);
  await page.goto("/training/evaluate");
  await expect(page).toHaveURL(/\/login\?next=%2Ftraining%2Fevaluate/);
  await page.goto("/training-plans");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("signed-in climbers can compare methods and assess their own skills", async ({ page }) => {
  // Isolate this test from the legacy serial flow's Alex/Sam accounts.
  await page.goto("/login");
  await page.getByRole("tab", { name: "Créer un compte" }).click();
  await page.getByLabel("Prénom ou pseudo").fill("Training Test");
  await page.getByLabel("Adresse e-mail").fill("training@leblond.local");
  await page.getByLabel("Mot de passe", { exact: true }).fill("ReasonablyStrongTrainingPassword123!");
  await page.getByLabel("Confirmer le mot de passe").fill("ReasonablyStrongTrainingPassword123!");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "Commencer avec mon profil" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/training");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Mieux s'entraîner");
  await expect(page.getByRole("img", { name: "Comparer sur le radar" })).toBeVisible();
  await page.getByRole("button", { name: /Outils/ }).click();
  await expect(page.getByRole("heading", { name: "Fingerboard / hangboard" })).toBeVisible();
  await page.goto("/training/evaluate");
  await expect(page.getByRole("heading", { name: "Ta progression en escalade" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Profil initial, scénario et évolution observée" })).toBeVisible();
  const slide = page.getByRole("slider", { name: "Technique" });
  await slide.focus();
  await slide.press("Home");
  await expect(slide).toHaveValue("1");
  await page.getByRole("checkbox", { name: /Simuler un bilan ultérieur/ }).check();
  await expect(page.getByText(/Rien n'est enregistré ici/)).toBeVisible();
});

import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

test("clean login shows exactly one approved brand illustration", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("img")).toHaveCount(1);
  await expect(page.getByRole("img", { name: /LeBlond.*one hand/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Créer un compte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
});

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
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Commencer avec mon profil" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/calendar");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link", { name: "Calendrier", exact: true })).toHaveAttribute("aria-current", "page");
  // Progressive disclosure: only the selected area's pages are listed.
  await expect(nav.getByRole("link", { name: "Séance", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "S’entraîner", exact: true })).toHaveAttribute("data-active-area", "true");
  await nav.getByRole("link", { name: "Suivi", exact: true }).click();
  await expect(page).toHaveURL(/\/follow-up/);
  await expect(page.locator("#app-main h1")).toBeFocused();
  await expect(nav.getByRole("link", { name: "Suivi", exact: true })).toHaveAttribute("data-active-area", "true");
  await expect(nav.getByRole("link", { name: "Calendrier", exact: true })).toHaveCount(0);
  await nav.getByRole("link", { name: "S’entraîner", exact: true }).click();
  await expect(page).toHaveURL(/\/train/);
  await expect(page.getByRole("link", { name: /Training Atlas/ })).toBeVisible();
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

  // Dedicated atlas: twelve descriptive axes, complete method sheet and
  // a way to schedule the selected method without buying or saving a plan.
  await page.goto("/atlas");
  await expect(page.getByRole("img", { name: "Comparer sur le radar" })).toBeVisible();
  await expect(page.getByText("Mobilité", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Max hangs/ }).first().click();
  await expect(page).toHaveURL(/\/atlas\/max-hangs/);
  await expect(page.getByRole("heading", { name: "Max hangs", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comment pratiquer" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Schéma de prise et de suspension/ })).toBeVisible();
  await page.getByRole("link", { name: /Planifier dans mon calendrier/ }).click();
  await expect(page).toHaveURL(/\/calendar\?method=max-hangs/);
  await expect(page.getByLabel("Méthode de l’Atlas (facultatif)")).toHaveValue("max-hangs");
  await page.getByLabel("Date", { exact: true }).fill("2026-11-15");
  await page.getByLabel("Titre", { exact: true }).fill("Poutre avec mes amis");
  await page.getByRole("button", { name: "Enregistrer la date" }).click();
  await expect(page).toHaveURL(/\/calendar\?month=2026-11/);
  await expect(page.getByText("Poutre avec mes amis")).toBeVisible();
  await page.getByRole("button", { name: "Marquer effectué" }).click();
  await expect(page.getByText("Effectué")).toBeVisible();
  await page.getByRole("button", { name: "2026-11-16" }).click();
  await expect(page.getByRole("region", { name: "2026-11-16" })).toBeFocused();
  await page.getByRole("button", { name: /Ajouter une date/ }).click();
  await expect(page.getByLabel("Titre", { exact: true })).toBeFocused();
});

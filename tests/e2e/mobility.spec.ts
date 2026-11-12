import { expect, test, type Page } from "@playwright/test";

/**
 * Hip-mobility programme on a real local stack: any climber can join it from
 * Training without a full assessment, run the guided session (sides, versions,
 * control, discomfort, warning signs), take the beginner assessment and see the
 * follow-up. Synthetic *@leblond.local identity only (reset by global-setup).
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

const PASSWORD = "ReasonablyStrongMobilityPassword123!";

async function register(page: Page, name: string, email: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Créer un compte" }).click();
  await page.getByLabel("Prénom ou pseudo").fill(name);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Commencer avec mon profil" }).click();
  await expect(page).toHaveURL(/\/home/);
}

test("I — hip mobility: join from Training, run a session, assess, follow up", async ({ page }) => {
  await register(page, "Mobility Starter", "mobility@leblond.local");

  // Offered directly in Training, with no full assessment.
  await page.goto("/train");
  const card = page.getByRole("region", { name: "Mobilité des hanches — niveau débutant" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /Découvrir le programme/ }).click();
  await expect(page).toHaveURL(/\/train\/mobility$/);
  await expect(page.getByText("Pas encore de bilan.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Commencer le programme" }).click();

  // Level 0 session: five exercises at their starting dose, no increase offered yet.
  const next = page.getByRole("region", { name: "Ta prochaine séance" });
  await expect(next.getByRole("listitem")).toHaveCount(5);
  await expect(next.getByText("Prêt pour plus", { exact: false })).toHaveCount(0);
  await expect(next.getByText("8 répétitions")).toBeVisible();
  await next.getByRole("button", { name: /Démarrer la séance/ }).click();
  await expect(page).toHaveURL(/\/train\/sessions\/[0-9a-f-]{36}$/);

  // Exercise 1: both sides together.
  await expect(page.getByRole("heading", { name: "Balancier des genoux sur le dos" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Balancier des genoux sur le dos" })).toBeVisible();
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  await page.getByRole("button", { name: /Valider la série/ }).click();
  await expect(page.getByText("Série 1", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: /Exercice suivant/ }).click();

  // Exercise 2: one side at a time, and a warning sign stops the exercise.
  await expect(page.getByRole("heading", { name: "Rotations de hanches assises, avec appui" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Valider la série · Gauche/ })).toBeVisible();
  await page.getByRole("button", { name: "Version plus facile" }).click();
  await page.getByRole("button", { name: "Accrochage" }).click();
  await page.getByRole("button", { name: /Valider la série · Gauche/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Arrête cet exercice" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Valider la série · Droite/ })).toBeVisible();

  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await page.getByRole("button", { name: "Enregistrer et terminer" }).click();
  await expect(page.getByRole("heading", { name: "Bilan de la séance" })).toBeVisible();

  // The warning sign is remembered: clinician advice, and no increase on offer.
  await page.goto("/train/mobility");
  await expect(page.getByRole("alert").filter({ hasText: "Consulte un professionnel avant de progresser" })).toBeVisible();
  await expect(page.getByText("une sensation d’accrochage")).toBeVisible();
  await expect(page.getByText("Allégé : un signe d’alerte a été noté.")).toBeVisible();

  // Beginner assessment: tests A–C on each side, the optional wall test skipped.
  await page.getByRole("link", { name: /Faire le bilan débutant/ }).click();
  await expect(page).toHaveURL(/\/train\/mobility\/assess$/);
  await page.getByRole("button", { name: /Suivant/ }).click();
  for (const level of [1, 2, 2]) {
    for (const side of ["Gauche", "Droite"]) {
      await page.getByRole("group", { name: side }).getByRole("radio").nth(level).check();
    }
    await page.getByRole("button", { name: /Suivant/ }).click();
  }
  await expect(page.getByRole("button", { name: "Passer le test au mur" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Suivant/ }).click();
  await page.getByRole("button", { name: "Enregistrer le bilan" }).click();
  await expect(page.getByText("Bilan enregistré")).toBeVisible();
  await expect(page.getByText("Ton niveau : Niveau 0 · Très limité, beaucoup d’appui")).toBeVisible();
  await expect(page.getByText("pas un bilan médical", { exact: false }).first()).toBeVisible();

  // Follow-up: the session, the left/right record and the warning sign, kept apart from measurements.
  await page.goto("/follow-up/mobility");
  await expect(page.getByRole("heading", { name: "Suivi de la mobilité des hanches" })).toBeVisible();
  await expect(page.getByText("1 sur les 28 derniers jours", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Gêne et signes d’alerte" }).getByText("Accrochage")).toBeVisible();
  await expect(page.getByRole("region", { name: "Bilans" }).getByText("Niveau 0 · Très limité, beaucoup d’appui")).toBeVisible();
  // Phone layout (the CI project): the area's pages are in the sub-navigation.
  const sub = page.getByRole("navigation", { name: "Pages de cette section" });
  await expect(sub.getByRole("link", { name: "Mobilité des hanches", exact: true })).toHaveAttribute("aria-current", "page");
});

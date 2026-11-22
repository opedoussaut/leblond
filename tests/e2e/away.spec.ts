import { expect, test, type Page } from "@playwright/test";

/**
 * Away Training (En déplacement) on a real local stack: the permanent page in
 * Programmes, 60 / 90 and goal filters, the whole séance before starting, a
 * séance put on the calendar, one trained in the usual player, then found
 * again in the page's history, the journal and the séance picker.
 * Synthetic *@leblond.local identity only (reset by global-setup).
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

const PASSWORD = "ReasonablyStrongAwayPassword123!";

function parisDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

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

test("K — away training: choose En déplacement, a 60 or 90 séance, train it with bands, find it in history", async ({ page }) => {
  await register(page, "Away Climber", "away@leblond.local");

  // A permanent page of Programmes, next to Mes programmes.
  await page.goto("/programmes");
  await page.getByRole("navigation", { name: "Pages de cette section" }).getByRole("link", { name: "En déplacement" }).click();
  await expect(page).toHaveURL(/\/train\/away$/);
  await expect(page.locator("#app-main h1")).toHaveText("En déplacement");
  // Never assessed: demanding hip movements come in their adapted version.
  await expect(page.getByText("Tu n’as pas encore fait le test des hanches", { exact: false })).toBeVisible();
  await expect(page.getByText("Les élastiques ne remplacent pas le travail des doigts", { exact: false }).last()).toBeVisible();

  // 60 or 90, then a goal.
  const catalogue = page.getByRole("region", { name: "En déplacement" });
  await expect(catalogue.getByRole("article")).toHaveCount(8);
  const duration = catalogue.getByRole("group", { name: "Durée" });
  await duration.getByText("1 h 30", { exact: true }).click();
  await expect(catalogue.getByRole("article")).toHaveCount(4);
  await catalogue.getByRole("button", { name: "Force", exact: true }).click();
  await expect(catalogue.getByRole("article")).toHaveCount(1);
  await expect(catalogue.getByRole("heading", { name: "Force et gainage grimpeur" })).toBeVisible();
  await catalogue.getByRole("button", { name: "Tous", exact: true }).click();
  await duration.getByText("1 h", { exact: true }).click();
  await expect(catalogue.getByRole("article")).toHaveCount(4);

  // The whole séance before starting: equipment, blocks, doses, adapted versions, alternatives.
  const hips = catalogue.getByTestId("away-hanches-60");
  await expect(hips.getByText("Sol · Un mur", { exact: true })).toBeVisible();
  await hips.getByRole("button", { name: "Voir toute la séance" }).click();
  await expect(hips.getByRole("region", { name: "Échauffement progressif" })).toBeVisible();
  await expect(hips.getByText("3 × 4 rép. par côté").first()).toBeVisible();
  await expect(hips.getByText("Version adaptée à ton test des hanches", { exact: false }).first()).toBeVisible();
  await expect(hips.getByText("Sans ce matériel :", { exact: false }).first()).toBeVisible();

  // Put the upper-body séance on the calendar.
  const upper = catalogue.getByTestId("away-haut-du-corps-60");
  await upper.getByRole("button", { name: "Programmer" }).click();
  await upper.getByLabel("Date").fill(parisDate());
  await upper.getByLabel("Heure (facultatif)").fill("20:30");
  await upper.getByRole("button", { name: "Ajouter au calendrier" }).click();
  await expect(upper.getByRole("status")).toContainText("Elle apparaît dans ton calendrier");

  // Train the hips séance in the usual player, timers and rests included.
  await hips.getByRole("button", { name: "Démarrer maintenant" }).click();
  await expect(page).toHaveURL(/\/train\/sessions\/[0-9a-f-]{36}$/);
  await expect(page.locator("#app-main h1")).toHaveText("Mobilité des hanches · En déplacement");
  await expect(page.getByRole("heading", { name: "Tour des articulations" })).toBeVisible();
  await page.getByRole("button", { name: /Valider la série/ }).click();
  await expect(page.getByText("Série 1", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await page.getByRole("button", { name: "Enregistrer et terminer" }).click();
  await expect(page.getByRole("heading", { name: "Résumé de la séance" })).toBeVisible();

  // Back on En déplacement: done once, in its history, ready to do again.
  await page.goto("/train/away");
  const history = page.getByRole("region", { name: "Tes séances en déplacement" });
  await expect(history.getByRole("link", { name: "Mobilité des hanches" })).toBeVisible();
  await expect(history.getByRole("link", { name: "Force haut du corps" })).toBeVisible();
  await expect(history.getByRole("button", { name: "Refaire" })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "En déplacement" }).getByTestId("away-hanches-60").getByText("Faite 1 fois", { exact: false })).toBeVisible();

  // In the normal training history and the calendar.
  await page.goto("/session?type=training");
  await expect(page.getByText("Mobilité des hanches · En déplacement").first()).toBeVisible();
  await page.goto("/calendar");
  await expect(page.getByText("Force haut du corps · En déplacement").first()).toBeVisible();

  // Also offered in Nouvelle séance › Entraînement, under its own category.
  await page.goto("/session/new?kind=train");
  await page.getByRole("group", { name: "Filtrer par type" }).getByRole("button", { name: "En déplacement" }).click();
  await page.getByRole("button", { name: /Force et gainage grimpeur/ }).click();
  await expect(page.getByText("Ta séance en déplacement : 1 h 30", { exact: false })).toBeVisible();

  // Phone width: nothing runs off the side, not even a card clipped by the layout.
  await page.goto("/train/away");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const widest = await page.locator("#app-main article").evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().right)));
  expect(widest).toBeLessThanOrEqual(page.viewportSize()!.width);
});

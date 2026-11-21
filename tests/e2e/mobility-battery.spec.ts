import { expect, test, type Page } from "@playwright/test";

/**
 * Mobility performance assessment (battery v2) on a real local stack: the safety screen
 * blocks the start on a red flag and saves nothing, access levels close cards, clinician
 * cards are not self-test tutorials, a stop sign keeps a trial as "stopped" without its
 * value, "not done" is never shown as a zero, worse neurological symptoms stop the bilan,
 * and another climber cannot open any of it. Synthetic *@leblond.local identities only.
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

const PASSWORD = "ReasonablyStrongBatteryPassword123!";

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

async function answerSafety(page: Page, answers: [boolean, boolean, boolean, boolean]) {
  const groups = page.getByRole("region", { name: "Avant de commencer" }).getByRole("radiogroup");
  for (let i = 0; i < 4; i++) await groups.nth(i).getByRole("radio", { name: answers[i] ? "Oui" : "Non" }).click();
}

const card = (page: Page, id: string) => page.getByRole("link", { name: new RegExp(`^${id} · `) });

test("M — mobility battery: safety blocks, access levels, stop signs, not done ≠ 0, privacy", async ({ page, browser }) => {
  await register(page, "Battery Climber", "battery@leblond.local");

  // Reached from Entraînement › Mobilité, beside the beginner hip assessment.
  await page.goto("/train/mobility");
  await page.getByRole("region", { name: "Bilan mobilité 2.0" }).getByRole("link", { name: /Ouvrir le bilan/ }).click();
  await expect(page).toHaveURL(/\/train\/mobility\/battery$/);
  await expect(page.getByRole("region", { name: "Conditions d’arrêt obligatoires" })).toBeVisible();

  // Red flags: the medical advice shows at once, the start button disappears, nothing is saved.
  await answerSafety(page, [false, true, false, false]);
  await expect(page.getByRole("alert").filter({ hasText: "Évaluation médicale urgente" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Commencer le bilan/ })).toHaveCount(0);
  await answerSafety(page, [false, false, false, true]);
  await expect(page.getByRole("alert").filter({ hasText: "Bilan médical avant toute évaluation" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Commencer le bilan/ })).toHaveCount(0);
  await page.goto("/follow-up/mobility/battery");
  await expect(page.getByText("Pas encore de bilan terminé.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Bilans" }).getByRole("listitem")).toHaveCount(0);

  // A clear screen, knee pain today, no clinical review.
  await page.goto("/train/mobility/battery");
  await answerSafety(page, [false, false, false, false]);
  await page.getByLabel("J’ai mal au genou aujourd’hui").check();
  await page.getByLabel("Hauteur de la chaise (cm)").fill("45");
  await page.getByRole("button", { name: /Commencer le bilan/ }).click();
  await expect(page).toHaveURL(/\/train\/mobility\/battery\/[0-9a-f-]{36}$/);
  const sessionUrl = page.url();

  // Access levels before the symptoms card.
  await expect(card(page, "M01")).toContainText("À faire");
  await expect(card(page, "M07")).toContainText("Fermée");
  await expect(card(page, "M05")).toContainText("Fermée");
  await expect(card(page, "M17")).toContainText("Fermée");
  await expect(card(page, "M19")).toContainText("Professionnel");

  // Clinician card: no how-to, only a transcription.
  await card(page, "M19").click();
  await expect(page.getByRole("heading", { name: "Fait par un professionnel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Réalisation" })).toHaveCount(0);
  await expect(page.getByText("l’application ne donne pas de mode d’emploi", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Retour au bilan/ }).click();

  // M01: symptoms at rest.
  await card(page, "M01").click();
  await page.getByLabel("Douleur du dos au repos (0–10)").fill("2");
  await page.getByLabel("Douleur de jambe au repos (0–10)").fill("1");
  await page.getByRole("radio", { name: "Pareil" }).click();
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(page.getByText("Fiche enregistrée.")).toBeVisible();
  await page.getByRole("link", { name: /Retour au bilan/ }).click();
  await expect(card(page, "M01")).toContainText("Faite");
  await expect(card(page, "M07")).toContainText("À faire");
  await expect(card(page, "M05")).toContainText("Fermée");

  // M07: left measured, right not done because of pain.
  await card(page, "M07").click();
  const left = page.getByRole("group", { name: "Gauche" });
  await left.getByLabel(/Essai noté 1/).fill("14");
  const right = page.getByRole("group", { name: "Droite" });
  await right.getByLabel(/Non réalisé — Droite/).check();
  await right.getByRole("button", { name: "Douleur", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(page.getByText("Fiche enregistrée.")).toBeVisible();
  await page.getByRole("link", { name: /Retour au bilan/ }).click();

  // M08: a stop sign keeps the trial as stopped, without its value.
  await card(page, "M08").click();
  const l8 = page.getByRole("group", { name: "Gauche" });
  await l8.getByLabel(/Essai noté 1/).fill("12");
  await l8.getByRole("button", { name: "Pincement" }).click();
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  await expect(page.getByText("Mouvement arrêté", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Retour au bilan/ }).click();
  await expect(card(page, "M08")).toContainText("Arrêtée");

  // M05 stays closed on a knee-pain day.
  await card(page, "M05").click();
  await expect(page.getByText("Fiche fermée aujourd’hui")).toBeVisible();
  await expect(page.getByText("douleur du genou aujourd’hui", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /Retour au bilan/ }).click();

  // Finish: the result shows raw values and "not done", never a zero.
  await page.getByRole("button", { name: "Terminer le bilan" }).click();
  await expect(page).toHaveURL(/\/follow-up\/mobility\/battery\/[0-9a-f-]{36}$/);
  const resultUrl = page.url();
  const m07 = page.getByRole("article", { name: /^M07 · / });
  await expect(m07.getByText("14 cm", { exact: false })).toBeVisible();
  await expect(m07.getByText("Non réalisé (douleur)", { exact: false })).toBeVisible();
  await expect(m07).not.toContainText("0 cm");
  await expect(page.getByRole("article", { name: /^M08 · / }).getByText("Arrêté (signe d’arrêt)", { exact: false })).toBeVisible();
  await expect(page.getByText("À remplir demain.")).toBeVisible();

  // History: one test at a time, S0, no global score.
  await page.goto("/follow-up/mobility/battery");
  const trend = page.getByRole("article", { name: /^M07 · / });
  await expect(trend.getByRole("columnheader", { name: "S0" })).toHaveCount(2); // left and right, each on its own
  await expect(trend.getByText("14 cm").first()).toBeVisible();
  await expect(trend.getByText("Non réalisé (douleur)")).toBeVisible();
  await expect(page.getByText("Aucun score global", { exact: false })).toBeVisible();

  // A second bilan: worse neurological symptoms stop it.
  await page.goto("/train/mobility/battery");
  await answerSafety(page, [false, false, false, false]);
  await page.getByRole("button", { name: /Commencer le bilan/ }).click();
  await expect(page).toHaveURL(/\/train\/mobility\/battery\/[0-9a-f-]{36}$/);
  await card(page, "M01").click();
  await page.getByLabel("Douleur du dos au repos (0–10)").fill("3");
  await page.getByLabel("Douleur de jambe au repos (0–10)").fill("4");
  await page.getByRole("radio", { name: "Moins bien" }).click();
  await page.getByRole("button", { name: "Enregistrer la fiche" }).click();
  // The bilan is closed at once: the climber lands on its result, with the medical advice.
  await expect(page).toHaveURL(/\/follow-up\/mobility\/battery\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("alert").filter({ hasText: "Demande un avis médical rapidement" })).toBeVisible();
  await expect(page.getByText("symptômes neurologiques en hausse")).toBeVisible();
  await page.goto("/follow-up/mobility/battery");
  await expect(page.getByRole("region", { name: "Bilans" }).getByText("Arrêté")).toBeVisible();

  // Privacy: another climber gets nothing, even with the exact links.
  const other = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const snoop = await other.newPage();
  await register(snoop, "Snoop", "snoop@leblond.local");
  for (const url of [resultUrl, sessionUrl, sessionUrl + "/M01"]) {
    const res = await snoop.goto(url);
    expect(res?.status()).toBe(404);
  }
  await snoop.goto("/follow-up/mobility/battery");
  await expect(snoop.getByText("Pas encore de bilan terminé.")).toBeVisible();
  await other.close();
});

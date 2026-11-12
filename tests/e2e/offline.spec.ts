import { expect, test, type Page } from "@playwright/test";

/**
 * Logging a boulder session without signal: taps are kept on the phone, the
 * page reopens from its kept copy, and everything is sent once — in order,
 * without duplicates — when the signal comes back. Synthetic identity only.
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");
test.describe.configure({ mode: "serial" });

const PASSWORD = "ReasonablyStrongOfflinePassword123!";

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

async function chooseGym(page: Page, name: string) {
  const picker = page.getByRole("combobox", { name: "Choisir une salle dans l’annuaire" });
  const id = await picker.locator("option").filter({ hasText: name }).first().getAttribute("value");
  if (!id) throw new Error("Gym not in the directory: " + name);
  await picker.selectOption(id);
}

async function logGrade(page: Page, grade: string, results: Array<"Essai" | "Top" | "Flash">) {
  const addButton = page.getByRole("button", { name: /AJOUTER UN BLOC/ });
  if (await addButton.isVisible()) await addButton.click();
  await page.getByRole("button", { name: new RegExp(`^${grade}`, "i") }).first().click();
  const current = page.getByRole("region", { name: "Bloc en cours" });
  await expect(current).toBeVisible();
  for (const name of results) {
    await current.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText(/noté\./)).toBeVisible();
  }
}

const inSession = (page: Page) => page.getByText(/^Dans cette séance · \d+$/);

test("a boulder session goes on without signal and is sent, once, when it comes back", async ({ page, context }) => {
  await register(page, "Offline", "offline@leblond.local");
  await page.goto("/session/new");
  await chooseGym(page, "Demo Arkose");
  await expect(page.getByRole("heading", { name: "Demo Arkose" })).toBeVisible();
  const path = new URL(page.url()).pathname;

  // With signal: logged and sent at once.
  await logGrade(page, "Rouge", ["Top"]);
  // The page is kept on the phone, and the service worker serves it.
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)), { timeout: 20_000 }).toBe(true);
  await expect.poll(
    () => page.evaluate(async (p) => Boolean(await (await caches.open("leblond-pages-v1")).match(p)), path),
    { timeout: 20_000 },
  ).toBe(true);

  // No signal: the logger keeps going, and says what waits on the phone.
  await context.setOffline(true);
  await logGrade(page, "Bleu", ["Essai", "Essai", "Top"]);
  await expect(page.getByText("Hors ligne · 4 changements gardés sur ce téléphone, envoyés dès que le réseau revient.")).toBeVisible();
  await expect(inSession(page)).toHaveText("Dans cette séance · 2");
  // Photos need signal.
  await expect(page.getByText("Photos et vidéos : il faut du réseau.")).toBeVisible();

  // The app reopened without signal: the kept copy, with everything logged.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Demo Arkose" })).toBeVisible();
  await expect(inSession(page)).toHaveText("Dans cette séance · 2");
  await expect(page.getByText(/Hors ligne · 4 changements/)).toBeVisible();

  // Another page without signal: the offline page links back to the session.
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Hors connexion" })).toBeVisible();
  await page.getByRole("link", { name: "Reprendre la séance en cours · Demo Arkose" }).click();
  await expect(page.getByRole("heading", { name: "Demo Arkose" })).toBeVisible();
  await logGrade(page, "Noir", ["Flash"]);
  await expect(page.getByText(/Hors ligne · 6 changements/)).toBeVisible();

  // Signal back: everything is sent, and nothing twice.
  await context.setOffline(false);
  await expect(page.getByText(/changements? (gardés?|pas encore envoyés?)|Envoi de/)).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  await expect(inSession(page)).toHaveText("Dans cette séance · 3");
  const stats = page.locator("header dl");
  await expect(stats).toContainText("3");

  // Ended without signal, stored when it comes back.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText(/^Séance terminée à \d\d:\d\d\. Elle sera enregistrée dès que le réseau revient\.$/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("SÉANCE TERMINÉE", { exact: true })).toBeVisible({ timeout: 30_000 });
  // 3 boulders, 3 tops, 1 flash, 5 tries — each logged once.
  for (const [value, label] of [["3", "blocs"], ["3", "tops"], ["1", "flashs"], ["5", "essais"]]) {
    await expect(page.locator("div", { hasText: new RegExp(`^${value}${label}$`, "i") }).first()).toBeVisible();
  }
  // Nothing left on the phone for this session.
  expect(await page.evaluate((p) => localStorage.getItem("lb-offline-session-" + p.split("/").pop()), path)).toBeNull();
});

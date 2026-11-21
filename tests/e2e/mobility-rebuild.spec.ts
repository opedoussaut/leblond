import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Mobility Rebuild | 12 Weeks on a real local stack: the coach key assigns 36 dated séances
 * to its owner (twice → still 36), the programme shows "Prêt à démarrer / validation clinique
 * à documenter", the symptom gate blocks on emergency and stop signs and only then starts the
 * guided séance, a stop sign interrupts it, it resumes after a new check, the next-day
 * follow-up and Suivi › Mobilité record it, and another climber sees nothing. The programme
 * content is synthetic: no one's personal data. Synthetic *@leblond.local identities only.
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");

const PASSWORD = "ReasonablyStrongRebuildPassword123!";
const MINUTES: Record<number, number> = { 1: 60, 2: 65, 3: 70, 4: 75, 5: 80, 6: 90 };

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

/** A made-up programme: check-in, two main exercises with alternatives, cool-down, adding up to each phase. */
function syntheticProgramme(days = [2, 4, 7]) {
  const templates = (["A", "B", "C"] as const).flatMap((letter) => [1, 2, 3, 4, 5, 6].map((phase) => ({
    letter, phase, title: `Séance test ${letter}${phase}`, minutes: MINUTES[phase],
    exercises: [
      { block: "WARMUP", name: "Point symptômes", modality: "FREE", minutes: 5 },
      { block: "MAIN", name: `Mouvement test ${letter}`, modality: "REPS", sets: 2, reps: 6, restSeconds: 60, minutes: 30,
        summary: "Mouvement lent, amplitude confortable.", steps: ["Assis, dos soutenu.", "Revenir lentement."], alternative: "Version assise plus petite" },
      { block: "MAIN", name: "Marche douce", modality: "TIME", seconds: 300, minutes: MINUTES[phase] - 40, alternative: "Marche sur place avec appui" },
      { block: "COOLDOWN", name: "Retour au calme", modality: "FREE", minutes: 5 },
    ],
  })));
  return { programme: "REBUILD_12W", days, usual: null, templates };
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.E2E_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

test("R — mobility rebuild: key assignment, idempotence, symptom gates, guided séance, follow-up, privacy", async ({ page, browser, request }) => {
  await register(page, "Rebuild Climber", "rebuild@leblond.local");
  await page.goto("/train/mobility/rebuild");
  await expect(page.getByText("Ce programme n’est pas encore affecté à ton compte.")).toBeVisible();

  // A coach key, then the coach outside the app: no session cookie, only the key.
  await page.goto("/settings");
  const access = page.getByRole("region", { name: "Accès du coach" });
  await access.getByRole("button", { name: "Créer une clé" }).click();
  const key = (await access.getByTestId("coach-key").textContent())?.trim() ?? "";
  expect(key).toMatch(/^lbk_[0-9a-f]{48}$/);
  await access.getByRole("button", { name: "J’ai enregistré la clé" }).click();
  const auth = { authorization: "Bearer " + key };

  expect((await request.get("/api/coach-programmes")).status()).toBe(401);
  expect((await (await request.get("/api/coach-programmes", { headers: auth })).json()).programme).toBeNull();
  const consecutive = await request.post("/api/coach-programmes", { headers: auth, data: syntheticProgramme([1, 2, 5]) });
  expect(consecutive.status()).toBe(400);
  const wrongLength = syntheticProgramme();
  wrongLength.templates[0]!.minutes = 65;
  expect((await request.post("/api/coach-programmes", { headers: auth, data: wrongLength })).status()).toBe(400);

  const first = await request.post("/api/coach-programmes", { headers: auth, data: syntheticProgramme() });
  expect(first.status()).toBe(200);
  const assigned = await first.json();
  expect(assigned).toMatchObject({ created: 36, existing: 0, sessions: 36 });
  const again = await (await request.post("/api/coach-programmes", { headers: auth, data: syntheticProgramme() })).json();
  expect(again).toMatchObject({ created: 0, sessions: 36, enrollment_id: assigned.enrollment_id });
  const status = (await (await request.get("/api/coach-programmes", { headers: auth })).json()).programme;
  expect(status).toMatchObject({ enrollment_id: assigned.enrollment_id, sessions: 36, slots: 36, templates: 18, exercises: 36 * 4 });
  expect(status.by_status).toEqual({ PLANNED: 36 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  expect(status.first_date > today).toBe(true);

  // Entraînement: assigned with no selection, clinical review still to document.
  await page.goto("/train/mobility");
  const entry = page.getByRole("region", { name: "Reconquête mobilité | 12 semaines" });
  await expect(entry.getByTestId("rebuild-clinical")).toHaveText("Prêt à démarrer / validation clinique à documenter");
  await entry.getByRole("link", { name: /Voir le programme/ }).click();
  await expect(page).toHaveURL(/\/train\/mobility\/rebuild$/);
  await expect(page.getByTestId("rebuild-calendar").locator("[data-slot]")).toHaveCount(36);
  await expect(page.getByTestId("rebuild-calendar").locator("[data-status='TODO']")).toHaveCount(36);
  await expect(page.getByRole("heading", { name: /Le cycle A \/ B \/ C de la phase en cours · Phase 1 · 60 min/ })).toBeVisible();
  await expect(page.getByText("S4 : à partir du", { exact: false })).toBeVisible();

  // The first séance: exercise list with minutes and alternatives, no plain start button.
  await page.locator("[data-slot='1']").getByRole("link", { name: "Ouvrir" }).click();
  await expect(page).toHaveURL(/\/train\/sessions\//);
  const sessionUrl = page.url();
  await expect(page.getByText("Phase prévue 1")).toBeVisible();
  await expect(page.getByText("Version assise plus petite")).toBeVisible();
  await expect(page.getByRole("button", { name: "Commencer", exact: true })).toHaveCount(0);
  const check = page.getByRole("form", { name: "Avant de commencer : point symptômes" });

  // Emergency: the séance does not start.
  await check.getByLabel("Perte de sensation au niveau du périnée").check();
  await check.getByRole("button", { name: /Vérifier et commencer/ }).click();
  await expect(check.getByRole("alert").filter({ hasText: "avis médical urgent" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("form", { name: "Avant de commencer : point symptômes" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Arrêter la séance si…" })).toHaveCount(0);

  // Stop: spreading radiation, no séance today.
  await check.getByLabel("L’irradiation descend plus loin que d’habitude").check();
  await check.getByRole("button", { name: /Vérifier et commencer/ }).click();
  await expect(check.locator("[data-verdict='STOP']")).toBeVisible();
  await expect(page.getByRole("region", { name: "Arrêter la séance si…" })).toHaveCount(0);

  // Clear check: the guided séance starts, with the stop signs beside the player.
  await check.getByLabel("L’irradiation descend plus loin que d’habitude").uncheck();
  await check.getByRole("button", { name: /Vérifier et commencer/ }).click();
  const stop = page.getByRole("region", { name: "Arrêter la séance si…" });
  await expect(stop).toBeVisible();
  await expect(page.getByText("Phase utilisée 1", { exact: false })).toBeVisible();

  // A stop sign interrupts at once; resuming needs a new check.
  await stop.getByRole("button", { name: "Une butée douloureuse" }).click();
  await expect(page.getByText("Interrompue", { exact: false }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Une butée douloureuse", { exact: false })).toBeVisible();
  await page.getByRole("form", { name: "Avant de commencer : point symptômes" }).getByRole("button", { name: /Vérifier et reprendre/ }).click();
  await expect(page.getByRole("region", { name: "Arrêter la séance si…" })).toBeVisible();

  // Finish with the pain after.
  await page.getByRole("button", { name: "Terminer la séance" }).first().click();
  await page.getByRole("button", { name: "Enregistrer et terminer" }).click();
  await expect(page.getByRole("region", { name: "Arrêter la séance si…" })).toHaveCount(0);

  // The next day (moved back one day in the local database only): the follow-up opens.
  const db = admin();
  if (db) {
    const id = new URL(sessionUrl).pathname.split("/").pop()!;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await db.from("training_sessions").update({ completed_at: yesterday, started_at: new Date(Date.now() - 90_000_000).toISOString() }).eq("id", id);
    await page.reload();
    const d1 = page.getByRole("form", { name: "Suivi du lendemain" });
    await d1.getByRole("button", { name: "Pareil" }).click();
    await d1.getByRole("button", { name: "Enregistrer le suivi" }).click();
    await expect(page.getByText("Lendemain : Pareil", { exact: false })).toBeVisible();
  }

  // Suivi › Mobilité: the séance, pains and adherence, no overall score.
  await page.goto("/follow-up/mobility");
  const track = page.getByTestId("rebuild-track");
  await expect(track.getByText("Reconquête mobilité : suivi")).toBeVisible();
  await expect(track.getByRole("row")).toHaveCount(2);
  if (db) await expect(track.getByRole("cell", { name: "Pareil" })).toBeVisible();
  await expect(track.getByText("Pas de score global", { exact: false })).toBeVisible();

  // Recording a clinical review changes the status (self-reported).
  await page.goto("/train/mobility/rebuild");
  await page.getByLabel("Date de l’avis").fill(today);
  await page.getByLabel("Restrictions données").fill("Pas de mur pour l’instant");
  await page.getByRole("button", { name: "Enregistrer l’avis" }).click();
  await expect(page.getByTestId("rebuild-clinical")).toContainText("Avis clinique noté le");

  // Another climber: nothing assigned, the séance is not reachable.
  const other = await (await browser.newContext()).newPage();
  await register(other, "Rebuild Outsider", "outsider@leblond.local");
  await other.goto("/train/mobility/rebuild");
  await expect(other.getByText("Ce programme n’est pas encore affecté à ton compte.")).toBeVisible();
  const res = await other.goto(sessionUrl);
  expect(res?.status()).toBe(404);
});

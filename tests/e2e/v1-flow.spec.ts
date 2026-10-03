import { Encoder, Profile, type FileIdMesg, type RecordMesg, type SessionMesg } from "@garmin/fitsdk";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * V1 "FIRST CLIMB + CONNECT" acceptance flow on a real local Supabase stack.
 * Uses only synthetic demo identities (alex@leblond.local admin, sam@leblond.local tester).
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");
test.describe.configure({ mode: "serial" });

const ALEX = "alex@leblond.local";
const SAM = "sam@leblond.local";
let arkoseSessionUrl = "";

async function logGrade(page: Page, grade: string, results: Array<"ESSAI" | "TOP" | "FLASH">) {
  const addButton = page.getByRole("button", { name: /AJOUTER UN BLOC/ });
  if (await addButton.isVisible()) await addButton.click();
  await page.getByRole("button", { name: new RegExp(`^${grade}`, "i") }).first().click();
  const current = page.getByRole("region", { name: "Bloc en cours" });
  await expect(current).toBeVisible();
  for (const r of results) {
    const name = r === "ESSAI" ? "Essai" : r === "TOP" ? "Top" : "Flash";
    await current.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText(/noté\./)).toBeVisible();
  }
}

test("uninvited email is refused by the whitelist", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill("stranger@leblond.local");
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByText("Cette adresse ne fait pas partie de la bêta fermée.")).toBeVisible();
});

test("beta login + onboarding", async ({ page }) => {
  await signIn(page, ALEX);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Prénom ou pseudo").fill("Alex");
  await page.getByRole("button", { name: "Continuer" }).click(); // → language
  await page.getByRole("button", { name: "Continuer" }).click(); // → level
  await page.getByLabel("Niveau").selectOption("6B+");
  await page.getByRole("button", { name: "Continuer" }).click(); // → target
  await expect(page.getByLabel("Niveau")).toHaveValue("7A");
  await page.getByRole("button", { name: "Continuer" }).click(); // → gyms
  await page.getByRole("button", { name: /Demo Arkose/ }).click();
  await page.getByRole("button", { name: /Demo Climbing District/ }).click();
  await page.getByRole("button", { name: "Continuer" }).click(); // → wearable
  await page.getByRole("button", { name: "Continuer" }).click(); // → Patrick intro
  await expect(page.getByText(/Salut Alex, moi c’est Patrick/)).toBeVisible();
  await page.getByRole("button", { name: "Démarrer ma première séance" }).click();
  await expect(page).toHaveURL(/\/session\/new/);
});

test("Arkose session: native colours, try/top/flash, summary", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session/new");
  await page.getByRole("button", { name: /Demo Arkose/ }).click();
  await expect(page.getByRole("heading", { name: "Demo Arkose" })).toBeVisible();
  arkoseSessionUrl = page.url();

  // Arkose grid offers exactly the six Arkose colours (no Climbing District pink).
  await expect(page.getByRole("button", { name: /^Rose/ })).toHaveCount(0);
  await logGrade(page, "Rouge", ["ESSAI", "ESSAI", "TOP"]);
  await logGrade(page, "Bleu", ["FLASH"]);
  await logGrade(page, "Noir", ["ESSAI", "ESSAI"]);
  // Flash is only possible on a first attempt.
  await expect(page.getByRole("region", { name: "Bloc en cours" }).getByRole("button", { name: "Flash", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();
  const stats = page.locator("section").filter({ hasText: "SÉANCE TERMINÉE" }).first();
  await expect(page.getByText(/Plus haut top/)).toBeVisible();
  await expect(stats).toBeTruthy();
  // 3 problems, 2 tops, 1 flash, 6 attempts
  for (const [value, label] of [["3", "blocs"], ["2", "tops"], ["1", "flashs"], ["6", "essais"]]) {
    await expect(page.locator("div", { hasText: new RegExp(`^${value}${label}$`, "i") }).first()).toBeVisible();
  }
});

test("Climbing District session: mystery pink handled natively", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session/new");
  await page.getByRole("button", { name: /Demo Climbing District/ }).click();
  await expect(page.getByRole("button", { name: /^Rose/ })).toBeVisible();
  await expect(page.getByText("Mystère").first()).toBeVisible();
  await logGrade(page, "Rose", ["ESSAI", "TOP"]);
  await logGrade(page, "Bleu", ["TOP"]);
  await expect(page.getByText("Premier essai réussi — c’était un flash ?")).toBeVisible();
  await page.getByRole("button", { name: "Oui, flash" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();
});

test("problem enrichment: Font estimate kept separate + photo upload", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto(arkoseSessionUrl);
  await page.getByRole("link", { name: /Rouge/ }).first().click();
  await expect(page.getByText("Réussi en 3 essai(s)")).toBeVisible();
  await page.getByLabel("Font").selectOption("6C");
  await page.getByLabel("Confiance").selectOption("confident");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("✓").first()).toBeVisible();
  // Native grade unchanged.
  await expect(page.getByText("Cotation native de la salle · Couleurs Arkose")).toBeVisible();

  // 1×1 PNG photo straight to the private bucket.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "problem.png", mimeType: "image/png", buffer: png });
  await expect(page.locator('img[alt="Photo du bloc"]')).toBeVisible({ timeout: 15_000 });
});

test("progress: native Arkose / Climbing District comparison", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/progress?period=30");
  await expect(page.getByText("Vue native")).toBeVisible();
  const cross = page.locator("section").filter({ hasText: "Comparaison entre salles" });
  await expect(cross.getByText("Arkose", { exact: true })).toBeVisible();
  await expect(cross.getByText("Climbing District", { exact: true })).toBeVisible();
  await expect(cross.getByText(/Pas encore assez d’estimations fiables/)).toBeVisible();
});

function fitOverlapping(start: Date): Buffer {
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: "activity", manufacturer: "development", product: 1, serialNumber: 4242, timeCreated: start } as FileIdMesg);
  [118, 125, 131].forEach((bpm, i) =>
    enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(start.getTime() + i * 60_000), heartRate: bpm } as RecordMesg),
  );
  enc.onMesg(Profile.MesgNum.SESSION, {
    timestamp: new Date(start.getTime() + 600_000),
    startTime: start,
    totalElapsedTime: 600,
    totalCalories: 90,
    avgHeartRate: 124,
    maxHeartRate: 151,
  } as SessionMesg);
  return Buffer.from(enc.close());
}

test("connections: truthful statuses, FIT import, link to session", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/settings/connections");
  const wear = page.locator("section").filter({ hasText: "Montres" });
  for (const p of ["COROS", "Suunto", "Garmin"]) await expect(wear.getByText(p, { exact: true })).toBeVisible();
  await expect(wear.getByText("Nécessite l’accord du fournisseur")).toHaveCount(3);
  await expect(wear.getByText("Connecté", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Pas encore disponible")).toBeVisible(); // Strava

  await page.locator('input[type="file"][accept^=".fit"]').setInputFiles({
    name: "climb.fit",
    mimeType: "application/octet-stream",
    buffer: fitOverlapping(new Date(Date.now() - 5 * 60_000)),
  });
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByText("Activité importée.")).toBeVisible();
  await page.getByRole("button", { name: "Associer à une séance" }).first().click();
  await expect(page.getByText(/Activité de montre associée/)).toBeVisible();

  // Re-importing the same file is detected as a duplicate.
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByText("Cette activité semble déjà importée.")).toBeVisible();
});

test("Patrick analyses the persisted session (with wearable context), streamed", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session");
  await page.getByRole("link", { name: /Demo Climbing District/ }).first().click();
  await expect(page.getByText("FC moy.")).toBeVisible();
  await page.getByRole("link", { name: "DEMANDER À PATRICK POUR CETTE SÉANCE" }).click();
  await expect(page.getByText(/MOCK PATRICK — Alex: session at Demo Climbing District — problems=2, tops=2, flashes=1, attempts=3, avgHR=124/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Networks: ARKOSE\+CLIMBING_DISTRICT/)).toBeVisible();
});

test("history is preserved and private: another tester sees nothing", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session");
  await expect(page.getByRole("link", { name: /Demo Arkose/ })).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, SAM);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Prénom ou pseudo").fill("Sam");
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Aller à l’accueil" }).click();
  await expect(page.getByText("Prêt pour ta première séance ?")).toBeVisible();
  await page.goto("/session");
  await expect(page.getByText("Aucune séance pour l’instant.")).toBeVisible();
  const res = await page.goto(new URL(arkoseSessionUrl).pathname);
  expect(res?.status()).toBe(404);
});

test("PWA manifest is installable", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});

// Runs last: the new-session page then opens on the Fontainebleau tab for Alex.
// Catalogue = tests/fixtures/boolder-sample.json (real Boolder rows, © Boolder, CC BY 4.0), loaded by CI.
test("Fontainebleau session: Boolder topo, closures, lettered Font grades", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session/new");
  await page.getByRole("tab", { name: "Fontainebleau" }).click();
  await expect(page.getByText("Topo : © Boolder").first()).toBeVisible();

  // A closed area asks for confirmation and shows Boolder's warning.
  await page.getByRole("button", { name: /Cul de Chien/ }).click();
  await expect(page.getByText(/fermé suite aux incendies/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer quand même" })).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();

  await page.getByRole("button", { name: /Rocher Canon/ }).click();
  await expect(page.getByRole("heading", { name: "Rocher Canon" })).toBeVisible();
  const picker = page.getByRole("region", { name: "Quel bloc ?" });
  await expect(picker).toBeVisible();

  // Red circuit n°3 = "Le Talon d'Achille", 5c.
  await picker.getByRole("button", { name: "rouge", exact: true }).click();
  await picker.getByLabel("Nom ou numéro de circuit").fill("3");
  await picker.getByRole("button", { name: /Le Talon d'Achille/ }).first().click();
  const current = page.getByRole("region", { name: "Bloc en cours" });
  await expect(current.getByText("Le Talon d'Achille")).toBeVisible();
  await expect(current.getByText("5c", { exact: true })).toBeVisible();
  for (const name of ["Essai", "Top"]) {
    await current.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText(/noté\./)).toBeVisible();
  }

  // Off-circuit problem found by name, flashed.
  await page.getByRole("button", { name: /AJOUTER UN BLOC/ }).click();
  await picker.getByLabel("Nom ou numéro de circuit").fill("free hug");
  await picker.getByRole("button", { name: /Free Hug/ }).click();
  await current.getByRole("button", { name: "Flash", exact: true }).click();
  await expect(page.getByText(/Flash noté\./)).toBeVisible();

  // Picking the same boulder again reuses it: its two attempts are still there.
  await page.getByRole("button", { name: /AJOUTER UN BLOC/ }).click();
  await picker.getByLabel("Nom ou numéro de circuit").fill("talon");
  await picker.getByRole("button", { name: /Le Talon d'Achille/ }).click();
  await expect(current.getByRole("img", { name: "Essai, Top" })).toBeVisible();
  await expect(current.getByRole("button", { name: "Flash", exact: true })).toBeDisabled();

  // Boulder missing from the topo: lettered Font grade grid.
  await page.getByRole("button", { name: /AJOUTER UN BLOC/ }).click();
  await page.getByRole("button", { name: "Bloc absent du topo ? Choisir une cotation" }).click();
  await page.getByRole("button", { name: "4b", exact: true }).click();
  await current.getByRole("button", { name: "Essai", exact: true }).click();
  await expect(page.getByText(/Essai noté\./)).toBeVisible();

  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();
  for (const [value, label] of [["3", "blocs"], ["2", "tops"], ["1", "flashs"], ["4", "essais"]]) {
    await expect(page.locator("div", { hasText: new RegExp(`^${value}${label}$`, "i") }).first()).toBeVisible();
  }

  // Problem page: topo details, links and attribution.
  await page.getByRole("link", { name: /Le Talon d'Achille/ }).click();
  await expect(page.getByRole("heading", { name: "Le Talon d'Achille" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Voir sur Boolder/ })).toHaveAttribute("href", /boolder\.com\/fr\/p\/115$/);
  await expect(page.getByText("Topo : © Boolder")).toBeVisible();

  await page.goto("/settings/connections");
  await expect(page.getByText("Topo chargé")).toBeVisible();
});

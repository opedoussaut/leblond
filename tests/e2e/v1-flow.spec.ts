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
const GONE = "gone@leblond.local";
const PASSWORD = "ReasonablyStrongTestingPassword123!";
const NOT_INVITED = "Cette adresse ne fait pas partie de la bêta fermée.";
let arkoseSessionUrl = "";

async function registerWithPassword(page: Page, name: string, email: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Créer un compte" }).click();
  await page.getByLabel("Prénom ou pseudo").fill(name);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

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

async function chooseGym(page: Page, name: string) {
  const picker = page.getByRole("combobox", { name: "Choisir une salle dans l’annuaire" });
  const option = picker.locator("option").filter({ hasText: name }).first();
  const id = await option.getAttribute("value");
  if (!id) throw new Error("Gym not in the directory: " + name);
  await picker.selectOption(id);
}

test("sign-up is by invitation: a stranger is refused on every route", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/Bêta fermée, sur invitation/)).toBeVisible();
  await registerWithPassword(page, "Stranger", "stranger@leblond.local");
  await expect(page.getByRole("alert").filter({ hasText: NOT_INVITED })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Recevoir un code par e-mail à la place" }).click();
  await page.getByLabel("Adresse e-mail").fill("stranger@leblond.local");
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: NOT_INVITED })).toBeVisible();
  await expect(page.getByLabel("Code reçu par e-mail")).toHaveCount(0);

  // A refused Google account comes back to the callback with an error description.
  await page.goto("/auth/callback?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user");
  await expect(page).toHaveURL(/\/login\?error=invite/);
  await expect(page.getByRole("alert").filter({ hasText: NOT_INVITED })).toBeVisible();
});

test("an invited climber registers a private account with a basic profile", async ({ page }) => {
  await registerWithPassword(page, "New Climber", "newcomer@leblond.local");
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "Choisis ta langue" })).toBeVisible();
  await expect(page.getByText("L’expérience LeBlond en français")).toBeVisible();
  await expect(page.getByText("Explore LeBlond in English")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Français" })).toBeChecked();
  await page.getByText("English", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  await expect(page.getByText("You can change it anytime.")).toBeVisible();
  await page.getByText("Français", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Français" })).toBeChecked();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByLabel("Prénom ou pseudo")).toHaveValue("New Climber");
  await page.getByRole("button", { name: "Commencer avec mon profil" }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.goto("/training");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("beta login + onboarding", async ({ page }) => {
  await signIn(page, ALEX);
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole("heading", { name: "Choisis ta langue" })).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click(); // → profile
  await page.getByLabel("Prénom ou pseudo").fill("Alex");
  await page.getByRole("button", { name: "Continuer" }).click(); // → levels
  await expect(page.getByText("Bloc", { exact: true })).toBeVisible();
  await expect(page.getByText("Voie", { exact: true })).toBeVisible();
  await page.getByLabel("Niveau").selectOption("6B+");
  await page.getByLabel("Cotation française (voie)").selectOption("6b+");
  await page.getByRole("button", { name: "Continuer" }).click(); // → target
  await expect(page.getByRole("radio", { name: "Bloc" })).toBeChecked();
  await expect(page.getByLabel("Niveau")).toHaveValue("7A");
  // Route-only target must have its own French grade. Both keeps both goals.
  await page.getByText("Voie", { exact: true }).last().click();
  await expect(page.getByRole("radio", { name: "Voie" })).toBeChecked();
  await expect(page.getByLabel("Niveau")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await page.getByLabel("Objectif en voie").selectOption("7a+");
  await page.getByText("Les deux", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Les deux" })).toBeChecked();
  await expect(page.getByLabel("Niveau")).toHaveValue("7A");
  await expect(page.getByLabel("Objectif en voie")).toHaveValue("7a+");
  await page.getByRole("button", { name: "Continuer" }).click(); // → gyms
  const directory = page.getByRole("combobox", { name: "Choisir une salle dans l’annuaire" });
  await expect(directory.locator("option").filter({ hasText: "Climb Up Aubervilliers" })).toHaveCount(1);
  await expect(directory.locator("option").filter({ hasText: "Vertical'Art Rungis" })).toHaveCount(1);
  await page.getByLabel("Disciplines proposées").selectOption("routes");
  await expect(directory.locator("option").filter({ hasText: "Climbing District Sèvres-Lecourbe" })).toHaveCount(1);
  await expect(directory.locator("option").filter({ hasText: "Block'Out Paris" })).toHaveCount(0);
  await page.getByLabel("Disciplines proposées").selectOption("all");
  const search = page.getByRole("searchbox", { name: /Rechercher une salle/ });
  await search.fill("Climb Up Aubervilliers");
  await expect(page.getByRole("button", { name: /Ajouter cette salle/ })).toHaveCount(0);
  await search.fill("Salle inconnue quartier inconnu");
  await expect(page.getByRole("button", { name: /Ajouter cette salle/ })).toBeVisible();
  await search.fill("");
  await chooseGym(page, "Demo Arkose");
  await chooseGym(page, "Demo Climbing District");
  await page.getByRole("button", { name: "Continuer" }).click(); // → wearable
  await page.getByRole("button", { name: "Continuer" }).click(); // → Patrick intro
  await expect(page.getByText(/Salut Alex, moi c’est Patrick/)).toBeVisible();
  await page.getByRole("button", { name: "Démarrer ma première séance" }).click();
  await expect(page).toHaveURL(/\/session\/new/);
});

test("Arkose session: native colours, try/top/flash, summary", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session/new");
  await chooseGym(page, "Demo Arkose");
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
  await chooseGym(page, "Demo Climbing District");
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
  const linkedNote = page.getByText("Associée : la séance a pris les horaires de la montre.");
  await expect(linkedNote).toBeVisible();

  // Re-importing the same file is detected as a duplicate.
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByText("Cette activité semble déjà importée.")).toBeVisible();

  // On the session: imported file marked as such; the watch's times replaced the typed ones,
  // with nothing to compare or confirm.
  await page.goto("/session");
  await page.getByRole("link", { name: /Demo Climbing District/ }).first().click();
  await expect(page.getByText("Fichier FIT importé")).toBeVisible();
  await expect(page.getByText("Horaires repris de la montre")).toBeVisible();
  await expect(page.getByText("Horaires corrigés à la main")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revenir aux horaires de la montre" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Continuer" }).click(); // language → profile
  await page.getByLabel("Prénom ou pseudo").fill("Sam");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Aller à l’accueil" }).click();
  await expect(page.getByRole("heading", { name: "Que veux-tu faire aujourd’hui ?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Commencer une séance de grimpe/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Commencer mon parcours d’entraînement/ })).toBeVisible();
  await page.goto("/session");
  await expect(page.getByText("Aucune séance pour l’instant.")).toBeVisible();
  const res = await page.goto(new URL(arkoseSessionUrl).pathname);
  expect(res?.status()).toBe(404);
});

test("a tester deactivated in Beta administration lands on Accès désactivé", async ({ page }) => {
  await registerWithPassword(page, "Gone", GONE);
  await expect(page).toHaveURL(/\/onboarding/);

  await page.context().clearCookies();
  await signIn(page, ALEX);
  await page.goto("/settings/admin");
  const row = page.getByRole("listitem").filter({ hasText: GONE });
  await row.getByRole("button", { name: "Désactiver" }).click();
  await expect(row.getByRole("button", { name: "Réactiver" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(GONE);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/revoked/);
  await expect(page.getByRole("heading", { name: "Accès désactivé" })).toBeVisible();
  await page.goto("/session");
  await expect(page).toHaveURL(/\/revoked/);
});

test("an invitation link lets a friend in, once", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/settings/admin");
  await page.getByLabel("Pour qui ? (facultatif)").fill("Invitee");
  await page.getByRole("button", { name: "Créer un lien d’invitation" }).click();
  const invite = page.getByRole("list", { name: "Invitations" }).getByRole("listitem").filter({ hasText: "Invitee" }).first();
  await expect(invite.getByText(/En attente · expire le/)).toBeVisible();
  const link = await invite.getByRole("textbox", { name: "Lien d’invitation" }).inputValue();
  expect(link).toMatch(/\/login\?invite=[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  await expect(invite.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await expect(invite.getByRole("link", { name: "Telegram" })).toHaveAttribute("href", /^https:\/\/t\.me\/share\/url\?url=/);
  const { pathname, search } = new URL(link);

  // The friend opens the link: account creation, code filled in, no Google button.
  await page.context().clearCookies();
  await page.goto(pathname + search);
  await expect(page.getByText(/Tu as reçu une invitation/)).toBeVisible();
  await expect(page.getByLabel("Code d’invitation (si tu en as reçu un)")).toHaveValue(new URLSearchParams(search).get("invite") ?? "");
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toHaveCount(0);
  await page.getByLabel("Prénom ou pseudo").fill("Invitee");
  await page.getByLabel("Adresse e-mail").fill("invitee@leblond.local");
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // The link has served: someone else is refused, and the admin sees it used.
  await page.context().clearCookies();
  await page.goto(pathname + search);
  await page.getByLabel("Prénom ou pseudo").fill("Second");
  await page.getByLabel("Adresse e-mail").fill("second-invitee@leblond.local");
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ce code d’invitation ne marche pas" })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, ALEX);
  await page.goto("/settings/admin");
  await expect(page.getByRole("list", { name: "Invitations" }).getByRole("listitem").filter({ hasText: "Invitee" }).first()
    .getByText(/Utilisée le/)).toBeVisible();

  // A mistyped code on the link is flagged before anything is sent.
  await page.context().clearCookies();
  await page.goto("/login?invite=nope");
  await expect(page.getByRole("alert").filter({ hasText: "Ce code d’invitation ne marche pas" })).toBeVisible();
});

test("PWA manifest is installable", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});

// Runs last: the new-session page then opens on the outdoor tab for Alex.
// Catalogue = tests/fixtures/boolder-sample.json (real Boolder rows, © Boolder, CC BY 4.0), loaded by CI.
test("Fontainebleau session: Boolder topo, closures, lettered Font grades", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session/new");
  await page.getByRole("tab", { name: "Extérieur" }).click();
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
  // A topo boulder opens the one-step form; "Noter essai par essai" keeps the try-by-try logger.
  const quickAdd = page.getByRole("region", { name: "Ajouter ce bloc" });
  await expect(quickAdd.getByRole("button", { name: "Cotation du topo (5c)" })).toHaveAttribute("aria-pressed", "true");
  await quickAdd.getByRole("button", { name: "Noter essai par essai" }).click();
  const current = page.getByRole("region", { name: "Bloc en cours" });
  await expect(current.getByText("Le Talon d'Achille")).toBeVisible();
  await expect(current.getByText("5c", { exact: true })).toBeVisible();
  for (const name of ["Essai", "Top"]) {
    await current.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText(/noté\./)).toBeVisible();
  }

  // Off-circuit problem found by name, flashed in one step.
  await page.getByRole("button", { name: /AJOUTER UN BLOC/ }).click();
  await picker.getByLabel("Nom ou numéro de circuit").fill("free hug");
  await picker.getByRole("button", { name: /Free Hug/ }).click();
  await quickAdd.getByRole("button", { name: "Flash", exact: true }).click();
  await quickAdd.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Ajouté : Free Hug · Flash.").first()).toBeVisible();

  // The topo stays open. Picking the same boulder again reuses it: its two attempts are still there.
  await picker.getByLabel("Nom ou numéro de circuit").fill("talon");
  await picker.getByRole("button", { name: /Le Talon d'Achille/ }).click();
  await expect(quickAdd.getByText("Déjà 2 essais notés sur ce bloc.")).toBeVisible();
  await expect(quickAdd.getByRole("button", { name: "Flash", exact: true })).toBeDisabled();
  await quickAdd.getByRole("button", { name: "Noter essai par essai" }).click();
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

// Follows the Fontainebleau test: Alex last climbed outdoors, so the page opens on that tab.
test("Outdoor site with no topo: Dampierre Maincourt, logged by Font grade", async ({ page }) => {
  await signIn(page, ALEX);
  await page.goto("/session/new");
  await expect(page.getByRole("tab", { name: "Extérieur" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("link", { name: /Fiche de Dampierre Maincourt/ })).toHaveAttribute("href", "https://bleau.info/maincourt");
  await page.getByRole("button", { name: /Dampierre Maincourt/ }).click();
  await expect(page.getByRole("heading", { name: "Dampierre Maincourt" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Quel bloc ?" })).toHaveCount(0);

  await page.getByRole("button", { name: "6A", exact: true }).click();
  const current = page.getByRole("region", { name: "Bloc en cours" });
  await current.getByRole("button", { name: "Top", exact: true }).click();
  await expect(page.getByText(/noté./)).toBeVisible();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();

  // The site stays out of the gym list.
  await page.goto("/session/new?where=gym");
  await expect(page.getByRole("tab", { name: "Salle" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Dampierre Maincourt/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /Dampierre Maincourt/ })).toHaveCount(0);

  // A crag no topo covers, added by the climber (the link is optional), then a named boulder in a sector.
  await page.goto("/session/new");
  await page.getByRole("tab", { name: "Extérieur" }).click();
  await page.getByRole("button", { name: "+ Ajouter un site extérieur" }).click();
  const siteForm = page.getByRole("form", { name: "Nouveau site extérieur" });
  await siteForm.getByLabel("Nom du site").fill("Saffres E2E");
  await siteForm.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { name: "Saffres E2E" })).toBeVisible();
  await page.getByLabel("Nom (facultatif)").fill("La Fissure");
  await page.getByLabel("Secteur").fill("Secteur Nord");
  await page.getByRole("button", { name: "6B", exact: true }).click();
  await page.getByRole("region", { name: "Bloc en cours" }).getByRole("button", { name: "Top", exact: true }).click();
  await expect(page.getByText(/noté./)).toBeVisible();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();
  await page.getByRole("link", { name: /La Fissure/ }).click();
  await expect(page.getByRole("heading", { name: "La Fissure" })).toBeVisible();
  await expect(page.getByText("Secteur Nord").first()).toBeVisible();
});

// Follows the Dampierre test, which created the climber crag "Saffres E2E". Made-up boulders.
const TEAM_TOPO_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Topo E2E</name>
  <Folder><name>Orange</name>
    <Placemark><name>Premier E2E 3</name><description>O1</description><Point><coordinates>4.70,47.30,0</coordinates></Point></Placemark>
    <Placemark><name>Dalle E2E 4+</name><description>O2</description><Point><coordinates>4.71,47.31,0</coordinates></Point></Placemark>
  </Folder>
  <Folder><name>Hors circuit</name>
    <Placemark><name>Toit E2E 6b</name><description></description><Point><coordinates>4.72,47.32,0</coordinates></Point></Placemark>
  </Folder>
  <Folder><name>Autres</name>
    <Placemark><name>Parking</name><description></description><Point><coordinates>4.73,47.33,0</coordinates></Point></Placemark>
  </Folder>
</Document></kml>`;

test("a team topo from Google My Maps: imported in Beta administration, picked in a session", async ({ page }) => {
  test.setTimeout(120_000); // import, live session, list re-import, past session
  // The map's OpenStreetMap tiles are never fetched from CI.
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await signIn(page, ALEX);
  await page.goto("/settings/admin");
  const form = page.getByRole("form", { name: "Topos de l’équipe" });
  await form.getByLabel("Site", { exact: true }).selectOption({ label: "Saffres E2E" });
  await form.getByLabel("Fichier KMZ ou KML").setInputFiles({
    name: "topo-e2e.kml",
    mimeType: "application/vnd.google-earth.kml+xml",
    buffer: Buffer.from(TEAM_TOPO_KML),
  });
  await form.getByLabel(/Crédit affiché/).fill("Topo E2E");
  await form.getByRole("button", { name: "Importer le topo" }).click();
  await expect(form.getByText(/Topo importé : 3 blocs, 1 circuits \(3 ajoutés/)).toBeVisible();
  await form.getByText("1 repères ignorés").click();
  await expect(form.getByText(/Parking \(Autres\) — pas de cotation/)).toBeVisible();

  // The crag now offers its topo, credited to its author instead of Boolder.
  await page.goto("/session/new");
  await page.getByRole("tab", { name: "Extérieur" }).click();
  const site = page.getByRole("button", { name: /Saffres E2E/ });
  await expect(site).toContainText("topo intégré (3 blocs)");
  await site.click();
  const picker = page.getByRole("region", { name: "Quel bloc ?" });
  await expect(picker).toBeVisible();
  await expect(picker.getByText("Topo : Topo E2E")).toBeVisible();
  await expect(picker.getByText("Topo : © Boolder")).toHaveCount(0);
  await picker.getByRole("button", { name: "orange", exact: true }).click();
  await picker.getByLabel("Nom ou numéro de circuit").fill("2");
  // Map view: tap the boulder's pin, then choose it.
  await picker.getByRole("button", { name: "Carte", exact: true }).click();
  const map = picker.getByRole("region", { name: "Carte des blocs (OpenStreetMap)" });
  await expect(picker.getByText(/^\d+ blocs sur la carte$/)).toBeVisible();
  await map.getByRole("button", { name: /Dalle E2E · 4c/ }).click();
  await picker.getByRole("button", { name: "Choisir ce bloc" }).click();
  // One step: my own grade, the result and the number of tries.
  const quickAdd = page.getByRole("region", { name: "Ajouter ce bloc" });
  await expect(quickAdd.getByText("Dalle E2E")).toBeVisible();
  await expect(quickAdd.getByRole("button", { name: "Cotation du topo (4c)" })).toHaveAttribute("aria-pressed", "true");
  await quickAdd.getByRole("button", { name: "Ma cotation" }).click();
  await quickAdd.getByRole("combobox", { name: "Ma cotation" }).selectOption("5a");
  await quickAdd.getByRole("button", { name: "Top", exact: true }).click();
  await quickAdd.getByRole("button", { name: "Essais +" }).click();
  await quickAdd.getByRole("button", { name: "Essais +" }).click();
  await quickAdd.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Ajouté : Dalle E2E · Top en 3 essais.").first()).toBeVisible();
  const dalleRow = page.getByRole("listitem").filter({ hasText: "Dalle E2E" });
  await expect(dalleRow).toContainText("5a");
  await expect(dalleRow.getByRole("img", { name: "Essai, Essai, Top" })).toBeVisible();

  // Logged by mistake, then taken out of the session: with no other tries, the boulder goes.
  await map.getByRole("button", { name: /Premier E2E/ }).click();
  await picker.getByRole("button", { name: "Choisir ce bloc" }).click();
  await quickAdd.getByRole("button", { name: "Pas réussi", exact: true }).click();
  await quickAdd.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Ajouté : Premier E2E · 1 essai, pas réussi.").first()).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Premier E2E" }).getByRole("button").click();
  const current = page.getByRole("region", { name: "Bloc en cours" });
  await current.getByRole("button", { name: "Retirer de la séance" }).click();
  await expect(current.getByText(/le bloc sera supprimé/)).toBeVisible();
  await current.getByRole("button", { name: "Retirer", exact: true }).click();
  await expect(page.getByText("Bloc retiré et supprimé.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Premier E2E" })).toHaveCount(0);
  await expect(dalleRow).toBeVisible();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();

  await page.getByRole("link", { name: /Dalle E2E/ }).click();
  await expect(page.getByRole("heading", { name: "Dalle E2E" })).toBeVisible();
  await expect(page.getByText("Topo : Topo E2E")).toBeVisible();
  await expect(page.getByRole("link", { name: /Voir sur Boolder/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ouvrir dans OpenStreetMap/ })).toHaveAttribute("href", /openstreetmap\.org\/\?mlat=/);
  await page.getByRole("button", { name: "Voir sur la carte" }).click();
  await expect(page.getByRole("region", { name: "Carte des blocs (OpenStreetMap)" }).getByRole("button", { name: /Dalle E2E/ })).toBeVisible();

  // The written topo list, pasted without a file: it fixes the circuits and adds the boulders the map lacks.
  await page.goto("/settings/admin");
  await form.getByLabel("Site", { exact: true }).selectOption({ label: "Saffres E2E (topo actuel : 3 blocs)" });
  await form.getByLabel(/Liste écrite du topo/).fill([
    "Orange AD Saffres E2E", "3", "4+",
    "1Premier E2E 3  mur", "2Dalle E2E 4+  dalle", "2 bisVariante E2E 5  mur",
    "Toit E2E 6b  surplomb", "Nouveau Toit E2E 7a  dévers, départ assis", "Dalle E2E 4+  dalle",
  ].join("\n"));

  await form.getByRole("button", { name: "Importer le topo" }).click();
  await expect(form.getByText(/Topo importé : 5 blocs, 1 circuits \(2 ajoutés, 3 mis à jour, 0 retirés\)/)).toBeVisible();
  await expect(form.getByText("Liste : 3 blocs placés sur la carte.")).toBeVisible();
  await form.getByText(/2 blocs de la liste sans repère/).click();
  await expect(form.getByText("orange 2b · Variante E2E")).toBeVisible();
  await page.goto("/session/new");
  await page.getByRole("tab", { name: "Extérieur" }).click();
  await expect(page.getByRole("button", { name: /Saffres E2E/ })).toContainText("topo intégré (5 blocs)");

  // Filling in a past session: a listed boulder without a pin, added in one step.
  await page.goto("/session/new?where=past");
  await page.getByRole("button", { name: "Dehors", exact: true }).click();
  await page.getByRole("button", { name: /Saffres E2E/ }).click();
  const pastForm = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
  await pastForm.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}\/edit$/);
  const editUrl = page.url();
  await picker.getByLabel("Nom ou numéro de circuit").fill("variante");
  await expect(picker.getByRole("button", { name: /Variante E2E/ })).toBeVisible();
  await picker.getByLabel("Nom ou numéro de circuit").fill("nouveau toit");
  await picker.getByRole("button", { name: /Nouveau Toit E2E/ }).click();
  await expect(quickAdd.getByRole("button", { name: "Cotation du topo (7A)" })).toHaveAttribute("aria-pressed", "true");
  await quickAdd.getByRole("button", { name: "Top", exact: true }).click();
  await quickAdd.getByRole("button", { name: "Essais +" }).click();
  await quickAdd.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Ajouté : Nouveau Toit E2E · Top en 2 essais.").first()).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Nouveau Toit E2E" }).getByRole("img", { name: "Essai, Top" })).toBeVisible();

  // A project opened here is visibly linked to this session, and back (the topo stays open).
  await picker.getByLabel("Nom ou numéro de circuit").fill("variante");
  await picker.getByRole("button", { name: /Variante E2E/ }).click();
  await quickAdd.getByRole("button", { name: "Projet", exact: true }).click();
  await quickAdd.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(/Ajouté : Variante E2E · projet, 1 essai\. Projet lié à cette séance\./).first()).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Variante E2E" }).filter({ hasText: "Projet de cette séance" })).toBeVisible();
  // What the session already holds: marked in the topo, with each boulder's circuit or "Hors circuit".
  await picker.getByLabel("Nom ou numéro de circuit").fill("nouveau toit");
  await expect(picker.getByRole("button", { name: /Nouveau Toit E2E/ })).toContainText("Dans la séance · 2 essais");
  const held = page.getByRole("region", { name: /Dans cette séance · 2/ });
  await expect(held.getByRole("listitem").filter({ hasText: "Nouveau Toit E2E" })).toContainText("Hors circuit");
  await expect(held.getByRole("listitem").filter({ hasText: "Variante E2E" }).getByTitle("orange")).toHaveText(/2b/);
  await page.getByRole("link", { name: /Terminer les modifications/ }).first().click();
  const sessionProjects = page.getByRole("region", { name: /Projets de cette séance/ });
  await expect(sessionProjects.getByRole("link", { name: /Variante E2E.*ouvert ici/ })).toBeVisible();
  await sessionProjects.getByRole("link", { name: /Variante E2E/ }).click();
  await expect(page.getByRole("link", { name: /Ouvert pendant la séance du/ })).toBeVisible();

  // Several boulders out of the session at once; the project opened here goes with its boulder.
  await page.goto(editUrl);
  const list = page.getByRole("region", { name: /Dans cette séance · 2/ });
  await list.getByRole("button", { name: "Sélectionner" }).click();
  await list.getByRole("checkbox", { name: /Nouveau Toit E2E/ }).check();
  await list.getByRole("checkbox", { name: /Variante E2E/ }).check();
  await list.getByRole("button", { name: "Retirer de la séance (2)" }).click();
  const confirmMany = page.getByRole("alertdialog", { name: "Retirer 2 blocs de cette séance ?" });
  await confirmMany.getByRole("button", { name: "Retirer", exact: true }).click();
  await expect(page.getByText("2 blocs retirés de la séance.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Variante E2E" }).filter({ hasText: "Projet" })).toHaveCount(0);
  await page.goto("/projects");
  await expect(page.getByText("Variante E2E")).toHaveCount(0);
});

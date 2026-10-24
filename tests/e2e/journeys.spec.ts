import { expect, test, type Page } from "@playwright/test";

/**
 * Acceptance journeys for the two LEBLOND experiences on a real local stack:
 *  A — free climbing tracking (no plan, no assessment)
 *  B — guided training: assessment → Atlas → plan → calendar → player → follow-up → reassessment
 *  C — navigation, focus and history (desktop + mobile)
 *  D — authentication guard and cross-account isolation
 *  E — approved light visual identity, responsive layout, screenshots
 * Synthetic *@leblond.local identities only (reset by global-setup).
 */
test.skip(!process.env.E2E_BASE_URL, "E2E_BASE_URL not set — needs the local Supabase stack");
test.describe.configure({ mode: "serial" });

const PASSWORD = "ReasonablyStrongJourneyPassword123!";
const DESKTOP = { width: 1440, height: 900 };
let guidedSessionUrl = "";

function parisDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function mondayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
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

async function signInWithPassword(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
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
  for (const r of results) {
    await current.getByRole("button", { name: r, exact: true }).click();
    await expect(page.getByText(/noté\./)).toBeVisible();
  }
}

/** Runs the 9-step structured protocol with two measured tests. */
async function runProtocol(page: Page, hangSeconds: number, pullUps: number) {
  const next = () => page.getByRole("button", { name: /^Suivant/ }).click();
  await expect(page.getByRole("heading", { name: "Préparation et sécurité" })).toBeVisible();
  await page.getByLabel("Depuis combien de mois grimpes-tu régulièrement ?").fill("36");
  await page.getByRole("group", { name: /échauffement complet/ }).getByText("Oui").click();
  await next();
  await expect(page.getByRole("heading", { name: "Objectif et temps disponible" })).toBeFocused();
  await page.getByLabel(/Objectif \(ex\./).fill("Réussir un 7A en bloc");
  await next();
  await page.getByLabel("Lieu").fill("Salle de test");
  await next();
  const hang = page.locator("article").filter({ hasText: "Suspension 20 mm" });
  await hang.getByLabel(/Résultat/).fill(String(hangSeconds));
  await hang.getByLabel("Conditions du test").fill("Poutre 20 mm, 18 h");
  const pull = page.locator("article").filter({ hasText: "Tractions strictes" });
  await pull.getByLabel(/Résultat/).fill(String(pullUps));
  await pull.getByLabel("Conditions du test").fill("Barre fixe");
  await next();
  await expect(page.getByRole("slider", { name: "Technique" })).toBeVisible();
  await next();
  const results = page.getByRole("table", { name: "Résultats et qualité des données" });
  await expect(results.getByText("Mesuré").first()).toBeVisible();
  await expect(results.getByText("Déclaratif").first()).toBeVisible();
  await expect(results.getByText(`${hangSeconds} s`)).toBeVisible();
  await next();
  await next();
  await next();
  await page.getByRole("checkbox", { name: /J’ai suivi le protocole/ }).check();
  await page.getByRole("button", { name: "Enregistrer mon bilan" }).click();
  await expect(page.getByRole("heading", { name: "Profil par niveau de preuve" })).toBeVisible();
}

test("A — free climber logs a session and sees it in Follow-up without any plan", async ({ page }) => {
  await register(page, "Free Climber", "free@leblond.local");
  await page.getByRole("link", { name: /Commencer une séance de grimpe/ }).click();
  await expect(page).toHaveURL(/\/session\/new/);
  await chooseGym(page, "Demo Arkose");
  await expect(page.getByRole("heading", { name: "Demo Arkose" })).toBeVisible();
  await logGrade(page, "Rouge", ["Essai", "Top"]);
  await logGrade(page, "Bleu", ["Flash"]);
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page.getByRole("button", { name: "Terminer la séance" }).last().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();
  const sessionUrl = page.url();

  await page.reload();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();

  await page.goto("/follow-up");
  const climbing = page.getByRole("region", { name: "Bloc · 30 derniers jours" });
  await expect(climbing.getByText("Séances", { exact: true }).locator("..")).toContainText("1");
  await expect(climbing.getByText("Essais", { exact: true }).locator("..")).toContainText("3");
  await expect(climbing.getByText("Blocs réussis", { exact: true }).locator("..")).toContainText("2");
  await expect(page.getByText("Observé · carnet de grimpe")).toBeVisible();
  // No plan or assessment was ever needed; training simply shows an empty, optional state.
  await expect(page.getByText(/Pas encore de séance d’entraînement/)).toBeVisible();
  await page.goto("/session");
  await expect(page.locator(`a[href="${new URL(sessionUrl).pathname}"]`).first()).toBeVisible();
});

test("A2 — route climber logs lead / top-rope routes, kept separate from bouldering", async ({ page }) => {
  await register(page, "Route Climber", "routes@leblond.local");
  await page.goto("/session/new");
  await chooseGym(page, "Climb Up Aubervilliers");
  const choice = page.getByRole("region", { name: /Climb Up Aubervilliers · Que grimpes-tu/ });
  await choice.getByRole("button", { name: /^Voie/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Climb Up Aubervilliers" })).toBeVisible();
  await expect(page.getByText("Séance de voie")).toBeVisible();

  const log = page.getByRole("region", { name: /Choisis la cotation/ });
  await log.getByRole("button", { name: "6b", exact: true }).click();
  await log.getByLabel(/Nom ou repère/).fill("Le dièdre");
  await log.getByRole("button", { name: /^À vue/ }).click();
  await expect(log.getByRole("status")).toHaveText("6b · À vue noté.");
  await log.getByLabel(/Nom ou repère/).fill("");
  await log.getByRole("button", { name: "6a", exact: true }).click();
  await log.getByRole("button", { name: /^Enchaînée/ }).click();
  await expect(log.getByRole("status")).toHaveText("6a · Enchaînée noté.");
  await log.getByRole("button", { name: "6c", exact: true }).click();
  await log.getByRole("button", { name: "Moulinette" }).click();
  await log.getByRole("button", { name: "Ajouter une chute" }).click();
  await log.getByRole("button", { name: "Ajouter une chute" }).click();
  await log.getByRole("button", { name: /^Sortie avec repos/ }).click();
  await expect(log.getByRole("status")).toHaveText("6c · Sortie avec repos noté.");

  await page.reload();
  const list = page.getByRole("region", { name: /Voies de la séance/ });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await page.screenshot({ path: "test-results/visual/390_route_logger.png", fullPage: true });
  await expect(list.getByRole("listitem").filter({ hasText: "6c" })).toContainText("Moulinette · 2");

  // Onsight is impossible on a route already climbed here (accents/case ignored).
  await log.getByRole("button", { name: "6b", exact: true }).click();
  await log.getByLabel(/Nom ou repère/).fill("le diedre");
  await log.getByRole("button", { name: /^À vue/ }).click();
  await expect(log.getByRole("alert")).toContainText("déjà été grimpée");
  await expect(list.getByRole("listitem")).toHaveCount(3);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await expect(page.getByText("SÉANCE DE VOIE TERMINÉE")).toBeVisible();
  await expect(page.locator("dl div").filter({ hasText: "Plus haute enchaînée en tête" })).toContainText("6b");
  await expect(page.locator("dl div").filter({ hasText: "Plus haute à vue" })).toContainText("6b");

  await page.goto("/session");
  await expect(page.getByRole("link", { name: /Climb Up Aubervilliers/ })).toContainText("3 voies · 2 enchaînées");
  await page.goto("/follow-up");
  await expect(page.getByRole("region", { name: "Voie · 30 derniers jours" })).toContainText("6b");
  // Bouldering statistics are untouched by the route session.
  await expect(page.getByRole("region", { name: "Bloc · 30 derniers jours" })).toContainText("Aucune séance de grimpe");
});

test("A3 — route project: create, log goes, auto-sent, and Patrick reads routes", async ({ page }) => {
  await signInWithPassword(page, "routes@leblond.local");
  await page.goto("/projects");
  await page.getByText("+ Nouveau projet de voie").click();
  const form = page.getByRole("form", { name: "Nouveau projet de voie" });
  const gymSelect = form.getByLabel("Salle");
  await gymSelect.selectOption(await gymSelect.locator("option").filter({ hasText: "Climb Up Aubervilliers" }).first().getAttribute("value") ?? "");
  await form.getByLabel("Nom ou repère de la voie").fill("Toit bleu");
  await form.getByLabel("Cotation").selectOption("7a");
  await form.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page).toHaveURL(/\/projects\/routes\/[0-9a-f-]{36}$/);
  const projectUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Toit bleu" })).toBeVisible();

  await page.goto("/session/new");
  await chooseGym(page, "Climb Up Aubervilliers");
  await page.getByRole("region", { name: /Que grimpes-tu/ }).getByRole("button", { name: /^Voie/ }).click();
  const log = page.getByRole("region", { name: /Choisis la cotation/ });
  await log.getByRole("button", { name: /Toit bleu · 7a/ }).click();
  await expect(log.getByRole("button", { name: "7a", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(log.getByLabel(/Nom ou repère/)).toHaveValue("Toit bleu");
  await log.getByRole("button", { name: "Ajouter une chute" }).click();
  await log.getByRole("button", { name: "Ajouter une chute" }).click();
  await log.getByRole("button", { name: /^Sortie avec repos/ }).click();
  await expect(log.getByRole("status")).toHaveText("7a · Sortie avec repos noté.");
  await log.getByRole("button", { name: /^Enchaînée/ }).click();
  await expect(log.getByRole("status")).toHaveText("Projet enchaîné : Toit bleu !");
  await expect(log.getByRole("button", { name: /Toit bleu · 7a/ })).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await expect(page.getByText("SÉANCE DE VOIE TERMINÉE")).toBeVisible();

  await page.goto(projectUrl);
  await expect(page.getByText(/Projets de voie · Enchaîné/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Historique" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("link", { name: "DEMANDER À PATRICK POUR CE PROJET" }).click();
  await expect(page.getByText(/MOCK PATRICK — Route Climber: route project Toit bleu \(7a, SENT\) at Climb Up Aubervilliers — goes=2, falls=2\/0, sessions=1/))
    .toBeVisible({ timeout: 20_000 });

  await page.goto("/patrick?q=lastSession");
  await expect(page.getByText(/MOCK PATRICK — Route Climber: route session at Climb Up Aubervilliers — routes=2, clean=1, hardestLead=7a/))
    .toBeVisible({ timeout: 20_000 });
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: /Toit bleu/ })).toContainText("Enchaîné");
});

test("A4 — past sessions: add after the fact, edit, Font ranges, route styles, delete", async ({ page }) => {
  test.setTimeout(180_000);
  await register(page, "Past Climber", "past@leblond.local");
  const yesterday = parisDate(new Date(Date.now() - 86_400_000));

  // Bouldering session added afterwards, at Arkose: native colour shown with its Font range.
  await page.goto("/session/new?where=past");
  await expect(page.getByRole("tab", { name: "Séance passée" })).toHaveAttribute("aria-selected", "true");
  await chooseGym(page, "Demo Arkose");
  const pastForm = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
  await pastForm.getByLabel("Date").fill(yesterday);
  await pastForm.getByLabel("Heure de début").fill("18:00");
  await pastForm.getByLabel("Durée (minutes)").fill("90");
  await pastForm.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}\/edit$/);
  const editUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Modifier la séance" })).toBeVisible();
  await expect(page.getByText("≈ 6A+–6C+").first()).toBeVisible();
  await logGrade(page, "Rouge", ["Essai", "Top"]);
  await logGrade(page, "Bleu", ["Flash"]);
  await page.getByRole("link", { name: /Terminer les modifications/ }).first().click();
  await expect(page.getByText("SÉANCE TERMINÉE")).toBeVisible();
  await expect(page.locator("dl").getByText("≈ 6A+–6C+")).toBeVisible();

  // Edit date/time from the summary; the session keeps its attempts.
  await page.getByRole("link", { name: /Modifier/ }).click();
  await expect(page).toHaveURL(editUrl);
  const when = page.getByRole("form", { name: "Date, heure et durée" });
  await when.getByLabel("Heure de début").fill("10:15");
  await when.getByRole("button", { name: "Enregistrer" }).click();
  await expect(when.getByRole("status")).toHaveText("Enregistré.");
  await page.reload();
  await expect(when.getByLabel("Heure de début")).toHaveValue("10:15");
  await page.goto("/follow-up");
  const climbing = page.getByRole("region", { name: "Bloc · 30 derniers jours" });
  await expect(climbing.getByText("Séances", { exact: true }).locator("..")).toContainText("1");
  await expect(climbing.getByText("Essais", { exact: true }).locator("..")).toContainText("3");

  // Route session afterwards at a colour-graded route gym: colour + French equivalent + style.
  await page.goto("/session/new?where=past");
  await chooseGym(page, "Climbing District Sèvres-Lecourbe");
  const routeForm = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
  await routeForm.getByLabel("Date").fill(yesterday);
  await routeForm.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  // Climbing District grades its routes in French grades (not colours): no colour picker.
  const log = page.getByRole("region", { name: /Choisis la cotation/ });
  await expect(log.getByText("Couleur de la salle")).toHaveCount(0);
  await log.getByRole("button", { name: "6a", exact: true }).click();
  await log.getByRole("button", { name: "Enrouleur" }).click();
  await log.getByRole("button", { name: /^Enchaînée/ }).click();
  await expect(log.getByRole("status")).toHaveText("6a · Enchaînée noté.");
  await log.getByRole("button", { name: "6c", exact: true }).click();
  await log.getByRole("button", { name: "Moulinette" }).click();
  await log.getByRole("button", { name: /^Non sortie/ }).click();
  await expect(log.getByRole("status")).toHaveText("6c · Non sortie noté.");
  const list = page.getByRole("region", { name: /Voies de la séance/ });
  await expect(list.getByRole("listitem").filter({ hasText: "Enrouleur" })).toContainText("6a");
  await expect(list.getByRole("listitem").filter({ hasText: "Moulinette" })).toContainText("6c");

  // Delete the bouldering session.
  await page.goto(editUrl);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer la séance" }).click();
  await expect(page).toHaveURL(/\/session$/);
  await expect(page.getByRole("link", { name: /Demo Arkose/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Sèvres-Lecourbe/ })).toBeVisible();
});

test("A5 — real gym scales and an alphabetical gym directory", async ({ page }) => {
  await signInWithPassword(page, "past@leblond.local");
  await page.goto("/session/new?where=past");
  const picker = page.getByRole("combobox", { name: "Choisir une salle dans l’annuaire" });
  const names = (await picker.locator("option").allTextContents()).slice(1).map((n) => n.replace(/^[★✓ ]+/, "").split(" · ")[0]);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base", ignorePunctuation: true }));
  expect(names).toEqual(sorted);

  const yesterday = parisDate(new Date(Date.now() - 86_400_000));
  for (const [gym, grade, range] of [["Block'Out Paris", "B5", "≈ 6A–6A+"], ["Vertical'Art Rungis", "Bleu", "≈ 6A–6B"]] as const) {
    await page.goto("/session/new?where=past");
    await chooseGym(page, gym);
    const form = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
    await form.getByLabel("Date").fill(yesterday);
    await form.getByRole("button", { name: /Créer la séance/ }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByRole("button", { name: new RegExp("^" + grade) })).toContainText(range);
  }
  // Climb Up: its own seven colours, white above red, and no invented Font range.
  await page.goto("/session/new?where=past");
  await chooseGym(page, "Climb Up Aubervilliers");
  const form = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
  await form.getByLabel("Date").fill(yesterday);
  await form.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByRole("button", { name: /^Violet/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Blanc/ })).not.toContainText("≈");
});

test("A6 — faster logging: session name, several problems/routes, tries, comments, projects, colours", async ({ page }) => {
  test.setTimeout(180_000);
  await signInWithPassword(page, "past@leblond.local");
  const yesterday = parisDate(new Date(Date.now() - 86_400_000));

  // Named past bouldering session.
  await page.goto("/session/new?where=past");
  await chooseGym(page, "Demo Arkose");
  const form = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
  await form.getByLabel("Date").fill(yesterday);
  await form.getByLabel("Nom de la séance (facultatif)").fill("Sortie avec Thomas");
  await form.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/edit$/);

  // 3 red problems in 2 tries each, with a comment, in one tap.
  await page.getByRole("button", { name: /Saisie rapide/ }).click();
  const quick = page.getByRole("region", { name: /Saisie rapide/ });
  await quick.getByRole("button", { name: /^Rouge/ }).click();
  await quick.getByRole("button", { name: "Nombre de blocs +" }).click();
  await quick.getByRole("button", { name: "Nombre de blocs +" }).click();
  await quick.getByRole("button", { name: "Essais +" }).click();
  await quick.getByLabel("Commentaire (facultatif)").fill("arête gauche");
  await expect(quick.getByRole("button", { name: /^Flash/ })).toBeDisabled();
  await quick.getByRole("button", { name: /^Top/ }).click();
  await expect(quick.getByRole("status")).toHaveText("3 bloc(s) Rouge noté(s).");
  // A black project after 4 tries; the flash button is orange.
  await quick.getByRole("button", { name: /^Noir/ }).click();
  await expect(quick.getByRole("button", { name: /^Flash/ })).toHaveCSS("background-color", "rgb(249, 115, 22)");
  await expect(quick.getByRole("button", { name: /^Top/ })).toHaveCSS("background-color", "rgb(37, 99, 235)");
  for (let i = 0; i < 3; i++) await quick.getByRole("button", { name: "Essais +" }).click();
  await quick.getByRole("button", { name: /^Projet/ }).click();
  await expect(quick.getByRole("status")).toHaveText("1 bloc(s) Noir noté(s).");

  await page.getByRole("link", { name: /Terminer les modifications/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Sortie avec Thomas" })).toBeVisible();
  await expect(page.getByText("“arête gauche”")).toHaveCount(3);
  await expect(page.getByText("4 essai(s)", { exact: true })).toBeVisible();
  await expect(page.getByText("2 essai(s)", { exact: true })).toHaveCount(3);
  await page.goto("/projects");
  await expect(page.getByRole("link").filter({ hasText: "Noir" }).first()).toBeVisible();
  await page.goto("/session");
  await expect(page.getByRole("link", { name: /Sortie avec Thomas · Demo Arkose/ })).toBeVisible();

  // Routes: two 6b redpoints in 3 tries with a comment, then a project.
  await page.goto("/session/new?where=past");
  await chooseGym(page, "Climb Up Aubervilliers");
  const rform = page.getByRole("form", { name: "Ajouter une séance déjà faite" });
  await rform.getByLabel("Date").fill(yesterday);
  await rform.getByRole("button", { name: "Voie" }).click();
  await rform.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const log = page.getByRole("region", { name: /Choisis la cotation/ });
  await log.getByRole("button", { name: "6b", exact: true }).click();
  await log.getByRole("button", { name: "Nombre de voies +" }).click();
  await log.getByRole("button", { name: "Essais +" }).click();
  await log.getByRole("button", { name: "Essais +" }).click();
  await log.getByLabel("Commentaire (facultatif)").fill("dalle du haut");
  await expect(log.getByRole("button", { name: /^À vue/ })).toBeDisabled();
  await log.getByRole("button", { name: /^Enchaînée/ }).click();
  await expect(log.getByRole("status")).toHaveText("2 voie(s) 6b notée(s).");
  const list = page.getByRole("region", { name: /Voies de la séance/ });
  await expect(list.getByRole("listitem").filter({ hasText: "dalle du haut" })).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText("3 essais");
  await log.getByRole("button", { name: "7a", exact: true }).click();
  await log.getByLabel(/Nom ou repère/).fill("Le toit");
  await log.getByRole("button", { name: /^Projet/ }).click();
  await expect(log.getByRole("status")).toHaveText("Projet créé : Le toit.");
  await expect(log.getByRole("button", { name: /Le toit · 7a/ })).toBeVisible();
});

test("B — guided climber: assess, plan, schedule, execute, review, reassess", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize(DESKTOP);
  await register(page, "Guided Climber", "guided@leblond.local");

  await page.getByRole("link", { name: /Commencer mon parcours d’entraînement/ }).click();
  await expect(page).toHaveURL(/\/train$/);
  await page.getByRole("link", { name: /Faire mon bilan de départ/ }).click();
  await expect(page).toHaveURL(/\/train\/assess/);
  await runProtocol(page, 25, 8);
  await expect(page.getByText("25 s")).toBeVisible();

  // Recommended Atlas method → add to a plan → schedule this week.
  await page.goto("/atlas/max-hangs");
  await expect(page.getByRole("heading", { name: "Séance type et charge de départ" })).toBeVisible();
  await page.getByRole("link", { name: /Ajouter à un programme/ }).click();
  await expect(page).toHaveURL(/\/training-plans\?add=max-hangs/);
  await expect(page.getByText(/Méthode ajoutée au programme/)).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Enregistré en privé")).toBeVisible();
  const monday = mondayOf(parisDate());
  await page.getByLabel("Semaine du").fill(monday);
  await page.getByRole("button", { name: "Planifier cette semaine" }).click();
  await expect(page.getByText(/séance\(s\) ajoutée\(s\) au calendrier/)).toBeVisible();

  // Open the scheduled session from the calendar.
  await page.goto("/calendar?month=" + monday.slice(0, 7));
  await page.getByRole("button", { name: monday, exact: true }).click();
  await page.getByRole("region", { name: monday }).getByRole("link", { name: /Max hangs/ }).click();
  await expect(page).toHaveURL(/\/train\/sessions\/[0-9a-f-]{36}$/);
  guidedSessionUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Max hangs");
  await expect(page.getByRole("heading", { name: "Suspensions lourdes" })).toBeVisible();

  // Start → record sets across exercises → pause/resume → refresh → finish.
  await page.getByRole("button", { name: /Démarrer la séance/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: /Valider la série/ }).click(); // warm-up, 10 min
  await expect(page.getByText("Enregistré")).toBeVisible();
  await page.getByRole("button", { name: /Exercice suivant/ }).click();
  await expect(page.getByRole("heading", { name: "Échauffement des doigts" })).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /Valider la série/ }).click();
    await expect(page.getByRole("listitem").filter({ hasText: `Série ${i + 1}` })).toBeVisible();
  }
  await page.getByRole("button", { name: /Exercice suivant/ }).click();
  await expect(page.getByRole("heading", { name: "Suspensions lourdes" })).toBeVisible();
  await page.getByLabel(/Charge/).fill("5");
  await page.getByRole("button", { name: /Valider la série/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Série 1" })).toContainText("+5 kg");
  await page.getByRole("button", { name: /Valider la série/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Série 2" })).toBeVisible();
  await page.getByRole("button", { name: /Pause/ }).click();
  await expect(page.getByText("En pause")).toBeVisible();
  await page.getByRole("button", { name: /Reprendre/ }).click();
  await expect(page.getByText("Temps actif")).toBeVisible();
  await page.waitForTimeout(500);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Suspensions lourdes" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Série 2" })).toContainText("+5 kg");

  await page.getByRole("button", { name: "Terminer la séance", exact: true }).last().click();
  const finish = page.getByRole("form", { name: "Terminer la séance" });
  await finish.getByRole("button", { name: "7", exact: true }).click();
  await finish.getByLabel(/Notes et difficultés/).fill("Bonne séance, doigts frais.");
  await finish.getByRole("button", { name: "Enregistrer et terminer" }).click();
  await expect(page.getByRole("heading", { name: "Bilan de la séance" })).toBeVisible();

  await page.reload();
  const table = page.getByRole("table", { name: "Prévu / réalisé" });
  await expect(table.getByRole("row").filter({ hasText: "Suspensions lourdes" })).toContainText("+5 kg");
  await expect(table.getByRole("row").filter({ hasText: "Suspensions lourdes" })).toContainText("Adapté");
  await expect(table.getByRole("row").filter({ hasText: "Retour au calme" })).toContainText("Passé");
  await expect(page.getByText("7 / 10")).toBeVisible();

  // Follow-up shows the executed training.
  await page.goto("/follow-up/training");
  await expect(page.getByRole("link", { name: /Max hangs/ }).filter({ hasText: "Terminée" })).toBeVisible();
  await page.goto("/follow-up");
  await expect(page.getByRole("region", { name: "Entraînement · 8 dernières semaines" })).toContainText("min");

  // Controlled reassessment: improved hang → compared with the baseline.
  await page.goto("/training-assessment");
  await page.getByRole("button", { name: /Nouveau bilan \(réévaluation\)/ }).click();
  await runProtocol(page, 31, 9);
  await expect(page.getByText(/\+6 vs initial/)).toBeVisible();
  await expect(page.getByText(/\+1 vs initial/)).toBeVisible();
});

test("C — navigation moves section, selection and focus together (desktop)", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await signInWithPassword(page, "guided@leblond.local");
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  const area = (name: string) => nav.getByRole("link", { name, exact: true });

  const steps: Array<{ click: () => Promise<void>; url: RegExp; h1: RegExp; active: string; visible: string[]; hidden: string[] }> = [
    { click: () => area("Grimper").click(), url: /\/climbing$/, h1: /Grimper/, active: "Grimper", visible: ["Projets"], hidden: ["Atlas", "Progrès"] },
    { click: () => area("S’entraîner").click(), url: /\/train$/, h1: /S’entraîner/, active: "S’entraîner", visible: ["Atlas", "Séances d’entraînement"], hidden: ["Projets"] },
    { click: () => nav.getByRole("link", { name: "Atlas", exact: true }).click(), url: /\/atlas$/, h1: /Training Atlas/, active: "S’entraîner", visible: ["Atlas"], hidden: ["Projets"] },
    { click: () => nav.getByRole("link", { name: "Séances d’entraînement", exact: true }).click(), url: /\/train\/sessions$/, h1: /Séances d’entraînement/, active: "S’entraîner", visible: ["Calendrier"], hidden: ["Progrès"] },
    { click: () => area("Suivi").click(), url: /\/follow-up$/, h1: /^Suivi$/, active: "Suivi", visible: ["Historique d’entraînement", "Progrès"], hidden: ["Atlas", "Séances d’entraînement"] },
    { click: () => area("Profil").click(), url: /\/profile$/, h1: /.+/, active: "Profil", visible: ["Connexions"], hidden: ["Atlas", "Progrès"] },
  ];
  for (const s of steps) {
    await s.click();
    await expect(page).toHaveURL(s.url);
    const h1 = page.locator("#app-main h1");
    await expect(h1).toHaveText(s.h1);
    await expect(h1).toBeFocused();
    await expect(area(s.active)).toHaveAttribute("data-active-area", "true");
    await expect(nav.locator("[data-active-area=true]")).toHaveCount(1);
    for (const v of s.visible) await expect(nav.getByRole("link", { name: v, exact: true })).toBeVisible();
    for (const h of s.hidden) await expect(nav.getByRole("link", { name: h, exact: true })).toHaveCount(0);
    await expect(nav.locator("[aria-current=page]")).toHaveCount(1);
  }

  // Browser history and deep links keep the state consistent.
  await page.goBack();
  await expect(page).toHaveURL(/\/follow-up$/);
  await expect(area("Suivi")).toHaveAttribute("data-active-area", "true");
  await page.goto("/atlas/repeaters");
  await expect(nav.getByRole("link", { name: "Atlas", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(area("S’entraîner")).toHaveAttribute("data-active-area", "true");

  // Keyboard: activate an area with Enter; focus lands on the new heading.
  await area("Grimper").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/climbing$/);
  await expect(page.locator("#app-main h1")).toBeFocused();
});

test("C — mobile: bottom bar + one sub-navigation per area", async ({ page }) => {
  await signInWithPassword(page, "guided@leblond.local");
  await page.goto("/home");
  const bottom = page.getByRole("navigation", { name: "Navigation principale" });
  const sub = page.getByRole("navigation", { name: "Pages de cette section" });
  await expect(sub).toHaveCount(0);
  await bottom.getByRole("link", { name: "S’entraîner" }).click();
  await expect(page).toHaveURL(/\/train$/);
  await expect(page.locator("#app-main h1")).toBeFocused();
  await expect(sub.getByRole("link", { name: "Atlas" })).toBeVisible();
  await expect(sub.getByRole("link", { name: "Projets" })).toHaveCount(0);
  await sub.getByRole("link", { name: "Calendrier" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.locator("#app-main h1")).toBeFocused();
  await expect(sub.getByRole("link", { name: "Calendrier" })).toHaveAttribute("aria-current", "page");
  await bottom.getByRole("link", { name: "Suivi" }).click();
  await expect(page).toHaveURL(/\/follow-up$/);
  await expect(sub.getByRole("link", { name: "Calendrier" })).toHaveCount(0);
  await expect(sub.getByRole("link", { name: "Historique d’entraînement" })).toBeVisible();
  await expect(bottom.locator("[data-active-area=true]")).toHaveText(/Suivi/);
});

test("D — private data: signed-out visitors are redirected, other climbers get 404", async ({ page, request }) => {
  expect(guidedSessionUrl).not.toBe("");
  const path = new URL(guidedSessionUrl).pathname;
  await page.context().clearCookies();
  for (const p of ["/train/sessions", path, "/follow-up/training", "/home"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login/);
  }
  const anon = await request.get(path, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(anon.status());

  await signInWithPassword(page, "free@leblond.local");
  const res = await page.goto(path);
  expect(res?.status()).toBe(404);
  await page.goto("/follow-up/training");
  await expect(page.getByRole("link", { name: /Max hangs/ })).toHaveCount(0);

  // Session survives a reload for the signed-in user.
  await page.reload();
  await expect(page).toHaveURL(/\/follow-up\/training/);
});

test("E — approved light identity, intact artwork and no overflow (desktop + mobile)", async ({ page }) => {
  await signInWithPassword(page, "guided@leblond.local");
  for (const size of [DESKTOP, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    for (const p of ["/home", "/train", "/train/sessions", "/follow-up", "/atlas/max-hangs", "/training-assessment", guidedSessionUrl]) {
      await page.goto(p);
      await expect(page.locator("#app-main h1")).toBeVisible();
      const look = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        clipped: [...document.querySelectorAll("#app-main h1, #app-main h2")].filter((el) => el.scrollWidth > el.clientWidth + 1).length,
      }));
      expect(look.bg, p).toBe("rgb(244, 247, 251)");
      expect(look.overflow, p + " horizontal overflow").toBeLessThanOrEqual(0);
      expect(look.clipped, p + " clipped headings").toBe(0);
      await page.screenshot({ path: `test-results/visual/${size.width}${p.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: true });
    }
    await page.goto("/home");
    const art = page.getByRole("img", { name: /LeBlond climber|LeBlond, grimpeur/ });
    await expect(art).toBeVisible();
    const ratio = await art.evaluate((img: HTMLImageElement) => ({ natural: img.naturalWidth / img.naturalHeight, shown: img.clientWidth / img.clientHeight, src: img.getAttribute("src") }));
    expect(ratio.src).toBe("/brand/leblond-approved-hero.svg");
    expect(Math.abs(ratio.natural - ratio.shown)).toBeLessThan(0.02);
  }
  // Mobile training controls are large enough for chalky fingers.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/train/sessions");
  await page.getByRole("button", { name: /Commencer maintenant/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  for (const name of [/Valider la série/, /Exercice suivant/, /Pause/]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: "test-results/visual/390_player.png", fullPage: true });
  // Data integrity: logging the same set twice quickly yields two distinct sets, never a lost one.
  await page.getByRole("button", { name: /Valider la série/ }).click();
  await page.getByRole("button", { name: /Valider la série/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /^Série 2/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: /Série \d/ })).toHaveCount(2);
});

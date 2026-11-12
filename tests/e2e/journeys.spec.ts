import { expect, test, type Locator, type Page } from "@playwright/test";

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

/** Types a duration in the duration field, the way people write it ("1h30"). */
async function pickDuration(scope: Page | Locator, label: string, total: number) {
  const field = scope.getByLabel(label, { exact: true });
  await field.fill(`${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`);
  await expect(field).toHaveJSProperty("validationMessage", "");
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

/**
 * Runs the 7-step full assessment (évaluation complète) with two measured tests:
 * goal → availability → health → tests (readiness right before them) → self-ratings → priorities → programme.
 */
async function runProtocol(page: Page, hangSeconds: number, pullUps: number) {
  const next = () => page.getByRole("button", { name: /^Suivant/ }).click();
  await expect(page.getByRole("heading", { name: "Objectif", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Ce que tu veux travailler" }).getByText("Bloc", { exact: true }).click();
  await page.getByLabel(/Objectif \(ex\./).fill("Réussir un 7A en bloc");
  await page.getByLabel("Depuis combien de mois grimpes-tu régulièrement ?").fill("36");
  await next();
  await expect(page.getByRole("heading", { name: "Disponibilités" })).toBeFocused();
  await page.getByLabel("Séances de grimpe par semaine (salle ou dehors)").selectOption("2");
  await page.getByLabel(/Séances hors mur par semaine/).selectOption("0");
  await next();
  await expect(page.getByRole("heading", { name: "Santé" })).toBeVisible();
  await expect(page.getByText(/LEBLOND n’est pas un médecin/)).toBeVisible();
  await next();
  await expect(page.getByRole("heading", { name: "Tests (facultatifs)" })).toBeVisible();
  await page.getByRole("group", { name: "Fais-tu les tests aujourd’hui ?" }).getByText("Oui, je fais les tests").click();
  const readiness = page.getByRole("region", { name: "Juste avant les tests" });
  await readiness.getByRole("group", { name: /échauffement complet/ }).getByText("Oui", { exact: true }).click();
  await readiness.getByLabel("Lieu des tests").fill("Salle de test");
  const hang = page.locator("article").filter({ hasText: "Suspension 20 mm" });
  await hang.getByLabel(/Résultat/).fill(String(hangSeconds));
  await hang.getByLabel("Conditions du test").fill("Poutre 20 mm, 18 h");
  const pull = page.locator("article").filter({ hasText: "Tractions strictes" });
  await pull.getByLabel(/Résultat/).fill(String(pullUps));
  await pull.getByLabel("Conditions du test").fill("Barre fixe");
  await next();
  await expect(page.getByRole("slider", { name: "Technique" })).toBeVisible();
  await next();
  const results = page.getByRole("table", { name: "Détail des données et niveaux de preuve" });
  await expect(results.getByText("Mesuré").first()).toBeVisible();
  await expect(results.getByText("Déclaratif").first()).toBeVisible();
  await expect(results.getByText(`${hangSeconds} s`)).toBeVisible();
  await next();
  await expect(page.getByRole("heading", { name: "Programme proposé" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ta semaine type" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("checkbox", { name: /Je comprends que ce programme/ }).check();
  await page.getByRole("button", { name: "Enregistrer mon évaluation et mon programme" }).click();
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
  await expect(page.getByText("SÉANCE TERMINÉE", { exact: true })).toBeVisible();
  const sessionUrl = page.url();

  await page.reload();
  await expect(page.getByText("SÉANCE TERMINÉE", { exact: true })).toBeVisible();

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
  await pickDuration(pastForm, "Durée", 90);
  await pastForm.getByRole("button", { name: /Créer la séance/ }).click();
  await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}\/edit$/);
  const editUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: "Modifier la séance" })).toBeVisible();
  await expect(page.getByText("≈ 6A+–6C+").first()).toBeVisible();
  await logGrade(page, "Rouge", ["Essai", "Top"]);
  await logGrade(page, "Bleu", ["Flash"]);
  await page.getByRole("link", { name: /Terminer les modifications/ }).first().click();
  await expect(page.getByText("SÉANCE TERMINÉE", { exact: true })).toBeVisible();
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

  // Every detail of a route can be completed afterwards, on its own page.
  await list.getByRole("listitem").filter({ hasText: "Moulinette" }).getByRole("link", { name: /Détails/ }).click();
  await expect(page).toHaveURL(/\/route\/[0-9a-f-]{36}$/);
  const ascent = page.getByRole("form", { name: "Modifier la voie" });
  await ascent.getByLabel("Nom de la voie").fill("Le dièdre gris");
  await ascent.getByLabel("Secteur").fill("Mur du fond");
  await ascent.getByLabel("Commentaire").fill("Sortie à revoir");
  await ascent.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ascent.getByText("Enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("form", { name: "Modifier la voie" }).getByLabel("Nom de la voie")).toHaveValue("Le dièdre gris");
  await expect(page.getByRole("form", { name: "Modifier la voie" }).getByLabel("Secteur")).toHaveValue("Mur du fond");

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
  await rform.getByRole("button", { name: "Voie", exact: true }).click();
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

test("A7 — training: record a strength session after the fact, edit it, delete it", async ({ page }) => {
  await signInWithPassword(page, "past@leblond.local");
  const yesterday = parisDate(new Date(Date.now() - 86_400_000));
  await page.goto("/train/sessions");
  await page.getByText("+ Enregistrer une séance déjà faite").click();
  const form = page.getByRole("form", { name: "Enregistrer une séance déjà faite" });
  await expect(form.getByLabel("Type de séance")).toHaveValue("strength-conditioning");
  await form.getByLabel("Titre (facultatif)").fill("Renforcement");
  await form.getByLabel("Date").fill(yesterday);
  await pickDuration(form, "Temps total", 75);
  await form.getByLabel(/Effort perçu/).fill("7");
  await form.getByLabel(/Description/).fill("3×8 tractions lestées +5 kg, gainage 3×30 s");
  await form.getByRole("button", { name: "Enregistrer la séance" }).click();
  await expect(page).toHaveURL(/\/train\/sessions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Renforcement" })).toBeVisible();
  await expect(page.getByText("1h15")).toBeVisible();
  await expect(page.getByText("3×8 tractions lestées +5 kg, gainage 3×30 s")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  // Edit: longer, with pain reported.
  await page.getByRole("button", { name: "✎ Modifier" }).click();
  const edit = page.getByRole("form", { name: "Modifier la séance" });
  await pickDuration(edit, "Temps total", 90);
  await edit.getByLabel(/Douleur/).fill("5");
  await edit.getByLabel(/Description/).fill("Tractions + gainage. Point de tension épaule gauche.");
  await edit.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await expect(page.getByText("1h30")).toBeVisible();
  await expect(page.getByText(/Douleur signalée : 5\/10/)).toBeVisible();
  await page.goto("/follow-up/training");
  await expect(page.getByRole("link", { name: /Renforcement/ })).toContainText("90 min");

  // Export: a CSV with the session, and the PNG / PDF buttons.
  await page.getByRole("link", { name: /Renforcement/ }).click();
  const exportBox = page.getByRole("region", { name: "Exporter la séance" });
  await expect(exportBox.getByRole("button", { name: "Image (PNG)" })).toBeVisible();
  await expect(exportBox.getByRole("button", { name: "PDF" })).toBeVisible();
  const [csv] = await Promise.all([page.waitForEvent("download"), exportBox.getByRole("button", { name: "Tableur (CSV)" }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^leblond-\d{4}-\d{2}-\d{2}-.+\.csv$/);
  const [png] = await Promise.all([page.waitForEvent("download"), exportBox.getByRole("button", { name: "Image (PNG)" }).click()]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);

  // Delete.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page).toHaveURL(/\/train\/sessions$/);
  await expect(page.getByRole("link", { name: /Renforcement/ })).toHaveCount(0);
});

test("B — guided climber: assess, plan, schedule, execute, review, reassess", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize(DESKTOP);
  await register(page, "Guided Climber", "guided@leblond.local");

  await page.getByRole("link", { name: /Commencer mon parcours d’entraînement/ }).click();
  await expect(page).toHaveURL(/\/train$/);
  await page.getByRole("link", { name: /Faire mon évaluation complète/ }).first().click();
  await expect(page).toHaveURL(/\/train\/assess/);
  await runProtocol(page, 25, 8);
  await expect(page.getByRole("region", { name: "Profil par niveau de preuve" }).getByText("25 s")).toBeVisible();

  // The full assessment created the programme: S'entraîner shows it, and step 03 is done.
  await page.goto("/train");
  const programme = page.getByRole("region", { name: "Programme en cours" });
  await expect(programme.getByText("Semaine 1 sur 8")).toBeVisible();
  await expect(programme.getByText("Prochaine évaluation complète")).toBeVisible();
  await expect(page.getByRole("link", { name: /Choisir mon programme \(fait\)/ })).toBeVisible();

  // Daily readiness (forme du jour): adapts today's session only.
  await page.getByRole("link", { name: /Noter ma forme du jour/ }).click();
  await expect(page).toHaveURL(/\/train\/today$/);
  await page.getByRole("group", { name: "Ta nuit" }).getByText("Mauvaise").click();
  await page.getByRole("group", { name: "Ta fatigue" }).getByText("Très fatigué").click();
  await page.getByRole("button", { name: "Voir ma séance du jour" }).click();
  const day = page.getByRole("region", { name: "Ta séance idéale aujourd’hui" });
  await expect(day.getByText("De la mobilité douce à la place")).toBeVisible();
  await expect(day.getByText(/Très fatigué : récupérer/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Forme du jour déjà notée/)).toBeVisible();
  await page.goto("/train");
  await expect(page.getByText("Fait aujourd’hui : de la mobilité douce à la place.")).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Résumé de la séance" })).toBeVisible();

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
  await page.getByRole("button", { name: /Nouvelle évaluation complète \(réévaluation\)/ }).click();
  await runProtocol(page, 31, 9);
  await expect(page.getByText(/\+6 vs initial/)).toBeVisible();
  await expect(page.getByText(/\+1 vs initial/)).toBeVisible();

  // Repeated assessments read as a trend, one chart per test, never one score.
  await expect(page.getByRole("heading", { name: "Mon niveau actuel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "L’évolution de ma forme" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Suspension 20 mm au poids du corps" })).toBeVisible();
  await expect(page.getByText("+6 s depuis le premier résultat · en progrès")).toBeVisible();

  // Reset asks twice, keeps nothing and leaves the journal alone.
  await page.getByRole("button", { name: "Réinitialiser mes évaluations" }).click();
  await page.getByRole("button", { name: "Les garder" }).click();
  await expect(page.getByRole("heading", { name: "L’évolution de ma forme" })).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser mes évaluations" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Supprimer 2 évaluation(s)" })).toBeVisible();
  await page.getByRole("button", { name: "Oui, tout effacer" }).click();
  await expect(page.getByText("Tes évaluations ont été réinitialisées.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "L’évolution de ma forme" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Mon niveau actuel" })).toBeVisible();
  await page.goto("/follow-up/training");
  await expect(page.getByRole("link", { name: /Max hangs/ }).filter({ hasText: "Terminée" })).toBeVisible();
});

test("C — navigation moves section, selection and focus together (desktop)", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await signInWithPassword(page, "guided@leblond.local");
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  const area = (name: string) => nav.getByRole("link", { name, exact: true });
  // Five areas, no "Vue d'ensemble" entries: an area link opens its overview.
  for (const name of ["Aujourd’hui", "Grimper", "S’entraîner", "Progrès", "Patrick"]) await expect(area(name)).toBeVisible();
  await expect(nav.getByRole("link", { name: /Vue d’ensemble/ })).toHaveCount(0);

  const steps: Array<{ click: () => Promise<void>; url: RegExp; h1: RegExp; active: string; current: string; visible: string[]; hidden: string[] }> = [
    { click: () => area("Grimper").click(), url: /\/climbing$/, h1: /Grimper/, active: "Grimper", current: "Grimper", visible: ["Séances", "Projets"], hidden: ["Atlas", "Grimpe"] },
    { click: () => area("S’entraîner").click(), url: /\/train$/, h1: /S’entraîner/, active: "S’entraîner", current: "S’entraîner", visible: ["Séances", "Programmes", "Atlas"], hidden: ["Projets", "Agenda"] },
    { click: () => nav.getByRole("link", { name: "Atlas", exact: true }).click(), url: /\/atlas$/, h1: /Training Atlas/, active: "S’entraîner", current: "Atlas", visible: ["Atlas"], hidden: ["Projets"] },
    { click: () => nav.getByRole("link", { name: "Séances", exact: true }).click(), url: /\/train\/sessions$/, h1: /Séances d’entraînement/, active: "S’entraîner", current: "Séances", visible: ["Programmes"], hidden: ["Évaluations"] },
    { click: () => area("Aujourd’hui").click(), url: /\/home$/, h1: /Bonjour/, active: "Aujourd’hui", current: "Aujourd’hui", visible: ["Forme du jour", "Agenda"], hidden: ["Atlas"] },
    { click: () => nav.getByRole("link", { name: "Agenda", exact: true }).click(), url: /\/calendar$/, h1: /Mon agenda/, active: "Aujourd’hui", current: "Agenda", visible: ["Forme du jour"], hidden: ["Programmes"] },
    { click: () => area("Progrès").click(), url: /\/follow-up$/, h1: /^Progrès$/, active: "Progrès", current: "Progrès", visible: ["Grimpe", "Entraînement", "Évaluations"], hidden: ["Atlas", "Séances"] },
    { click: () => nav.getByRole("link", { name: "Évaluations", exact: true }).click(), url: /\/training-assessment$/, h1: /Évaluations/, active: "Progrès", current: "Évaluations", visible: ["Grimpe"], hidden: ["Atlas"] },
    { click: () => area("Patrick").click(), url: /\/patrick$/, h1: /.+/, active: "Patrick", current: "Patrick", visible: [], hidden: ["Grimpe", "Atlas"] },
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
    // One strong highlight: the current page only (the area link itself on an overview).
    await expect(nav.locator("[aria-current=page]")).toHaveCount(1);
    await expect(nav.locator("[aria-current=page]")).toHaveText(s.current);
  }

  // Browser history and deep links keep the state consistent.
  await page.goBack();
  await expect(page).toHaveURL(/\/training-assessment$/);
  await expect(area("Progrès")).toHaveAttribute("data-active-area", "true");
  await page.goto("/atlas/repeaters");
  await expect(nav.getByRole("link", { name: "Atlas", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(area("S’entraîner")).toHaveAttribute("aria-current", "true");
  // Old URLs keep working and land in their new area.
  await page.goto("/train/assess");
  await expect(area("Progrès")).toHaveAttribute("data-active-area", "true");
  await expect(nav.getByRole("link", { name: "Évaluations", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto("/train/today");
  await expect(area("Aujourd’hui")).toHaveAttribute("data-active-area", "true");
  await expect(nav.getByRole("link", { name: "Forme du jour", exact: true })).toHaveAttribute("aria-current", "page");

  // Keyboard: activate an area with Enter; focus lands on the new heading.
  await area("Grimper").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/climbing$/);
  await expect(page.locator("#app-main h1")).toBeFocused();

  // Account menu at the foot of the sidebar: aria-expanded, keyboard, Esc.
  const sidebar = page.locator("aside");
  const account = sidebar.getByRole("button", { name: /Mon compte/ });
  const item = (name: string) => sidebar.getByRole("link", { name, exact: true });
  await expect(account).toHaveAttribute("aria-expanded", "false");
  await expect(item("Profil")).toBeHidden();
  await account.focus();
  await page.keyboard.press("Enter");
  await expect(account).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Profil", "Connexions", "Réglages"]) await expect(item(name)).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Déconnexion" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(account).toHaveAttribute("aria-expanded", "false");
  await expect(account).toBeFocused();
  await expect(item("Profil")).toBeHidden();
  await page.keyboard.press("ArrowDown");
  await expect(account).toHaveAttribute("aria-expanded", "true");
  await expect(item("Profil")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(item("Connexions")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings\/connections$/);
  await expect(nav.locator("[data-active-area=true]")).toHaveCount(0);
  await account.click();
  await expect(item("Connexions")).toHaveAttribute("aria-current", "page");
  await page.locator("#app-main h1").click();
  await expect(account).toHaveAttribute("aria-expanded", "false");

  // Sign-out sits in the account menu, on every page.
  await account.click();
  await sidebar.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("C — mobile: bottom bar, every sub-page on screen, account menu in the header", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInWithPassword(page, "guided@leblond.local");
  await page.goto("/home");
  const bottom = page.getByRole("navigation", { name: "Navigation principale" });
  const sub = page.getByRole("navigation", { name: "Pages de cette section" });
  await expect(bottom.getByRole("link")).toHaveCount(5);
  await expect(sub.getByRole("link", { name: "Forme du jour" })).toBeVisible();
  await expect(sub.getByRole("link", { name: "Agenda" })).toBeVisible();
  await bottom.getByRole("link", { name: "S’entraîner" }).click();
  await expect(page).toHaveURL(/\/train$/);
  await expect(page.locator("#app-main h1")).toBeFocused();
  await expect(sub.getByRole("link", { name: "Atlas" })).toBeVisible();
  await expect(sub.getByRole("link", { name: "Projets" })).toHaveCount(0);
  await sub.getByRole("link", { name: "Programmes" }).click();
  await expect(page).toHaveURL(/\/training-plans$/);
  await expect(page.locator("#app-main h1")).toBeFocused();
  await expect(sub.getByRole("link", { name: "Programmes" })).toHaveAttribute("aria-current", "page");
  await bottom.getByRole("link", { name: "Progrès" }).click();
  await expect(page).toHaveURL(/\/follow-up$/);
  await expect(sub.getByRole("link", { name: "Programmes" })).toHaveCount(0);
  await expect(bottom.locator("[data-active-area=true]")).toHaveText(/Progrès/);
  // Every page of the area is on screen at 375 px: nothing is hidden off to the side.
  for (const name of ["Grimpe", "Entraînement", "Évaluations"]) {
    const box = await sub.getByRole("link", { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x, name).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, name).toBeLessThanOrEqual(375);
  }

  // Account menu in the header: aria-expanded, Esc closes it.
  const account = page.getByRole("button", { name: /Mon compte/ });
  await expect(account).toHaveAttribute("aria-expanded", "false");
  await account.click();
  await expect(account).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(account).toHaveAttribute("aria-expanded", "false");
  await expect(account).toBeFocused();
  await account.click();
  await page.getByRole("link", { name: "Connexions", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/connections$/);
  await expect(sub.getByRole("link", { name: "Connexions" })).toHaveAttribute("aria-current", "page");
  await expect(bottom.locator("[data-active-area=true]")).toHaveCount(0);
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
  for (const size of [DESKTOP, { width: 390, height: 844 }, { width: 360, height: 740 }]) {
    await page.setViewportSize(size);
    for (const p of ["/home", "/climbing", "/session", "/session/new", "/projects", "/train", "/train/today", "/train/assess", "/train/sessions", "/training-plans",
      "/calendar", "/atlas", "/follow-up", "/follow-up/training", "/progress", "/profile", "/settings", "/atlas/max-hangs",
      "/training-assessment", "/train/alter-ego", guidedSessionUrl]) {
      await page.goto(p);
      await expect(page.locator("#app-main h1")).toBeVisible();
      const look = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        // clientWidth, not innerWidth: a phone zooms out to fit a page that is too wide, which hides the overflow from innerWidth.
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
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
  // Reload only once both saves are confirmed: a reload sent mid-save can render before the second one commits.
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("lb-pending-sets-")).length)).toBe(0);
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: /Série \d/ })).toHaveCount(2);
});

test("F — alter ego: sign a pact, train alongside it, pause and leave", async ({ page }) => {
  await signInWithPassword(page, "guided@leblond.local");
  await page.goto("/train");
  await page.getByRole("link", { name: "Signer un pacte" }).click();
  await expect(page).toHaveURL(/\/train\/alter-ego/);
  await page.getByLabel("Nom de ton alter ego").fill("Double");
  // The profile fills in the goal only: the form says what is missing.
  await page.getByRole("button", { name: "Signer le pacte" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Pour chaque discipline" })).toBeVisible();
  await page.getByLabel("Bloc aujourd’hui").selectOption("6A");
  await page.getByRole("button", { name: "Signer le pacte" }).click();
  await expect(page.getByRole("heading", { name: "Toi contre Double" })).toBeVisible();
  await expect(page.getByText("L’écart n’est qu’un score.", { exact: false })).toBeVisible();

  // The score is on the training page, and the ego trains through the running session.
  await page.goto("/train");
  await expect(page.getByRole("heading", { name: "Toi contre Double" })).toBeVisible();
  await page.getByRole("link", { name: /Reprendre/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  const lane = page.getByRole("group", { name: "Double s’entraîne avec toi" });
  await expect(lane).toBeVisible();
  await expect(lane).toContainText(/Série|Repos|terminé/);

  // Nothing overflows at the narrowest phone width.
  await page.setViewportSize({ width: 360, height: 740 });
  for (const p of ["/train/alter-ego", "/train"]) {
    await page.goto(p);
    await expect(page.locator("#app-main h1")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  }

  // A pause freezes the ego, and it leaves the live session too.
  await page.goto("/train/alter-ego");
  await page.getByRole("button", { name: "Mettre le pacte en pause" }).click();
  await expect(page.getByRole("button", { name: "Reprendre le pacte" })).toBeVisible();
  await expect(page.getByText(/En pause/)).toBeVisible();
  await page.goto("/train");
  await page.getByRole("link", { name: /Reprendre/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("group", { name: "Double s’entraîne avec toi" })).toHaveCount(0);

  // Leaving asks twice, then the page offers a new pact.
  await page.goto("/train/alter-ego");
  await page.getByRole("button", { name: "Reprendre le pacte" }).click();
  // Wait for the resumed pact: a refresh landing mid-confirmation would reset it.
  await expect(page.getByRole("button", { name: "Mettre le pacte en pause" })).toBeVisible();
  await page.getByRole("button", { name: "Abandonner le pacte" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("heading", { name: "Toi contre Double" })).toBeVisible();
  await page.getByRole("button", { name: "Abandonner le pacte" }).click();
  await page.getByRole("button", { name: "Oui, abandonner" }).click();
  await expect(page.getByRole("button", { name: "Signer le pacte" })).toBeVisible();
});

test("G — training plans: assisted mode with phases, then a plan proposed by Patrick", async ({ page }) => {
  await register(page, "Plan Builder", "plans@leblond.local");
  await page.goto("/training-plans");

  // No plan yet: choose how to build it.
  await expect(page.getByRole("group", { name: "Comment veux-tu construire ce plan ?" })).toBeVisible();
  await page.getByRole("button", { name: /Je le construis, avec des conseils/ }).click();
  await expect(page.getByText("Construit avec conseils")).toBeVisible();
  const hints = page.getByRole("region", { name: "Conseils de LEBLOND" });
  await page.getByLabel("Nom du plan").fill("Saison 7A");
  await page.getByLabel("Objectif", { exact: true }).fill("Progresser");
  await expect(hints.getByText(/gagnerait à être mesurable/)).toBeVisible();

  // Three months, in two phases.
  await page.getByRole("spinbutton", { name: "Durée du plan" }).fill("3");
  await page.getByLabel("Unité de durée").selectOption("MONTHS");
  await expect(page.getByText("soit 13 semaines")).toBeVisible();
  await expect(hints.getByText(/13 semaines avec la même semaine type/)).toBeVisible();
  await page.getByRole("button", { name: "+ Ajouter une phase" }).click();
  await expect(page.getByRole("tab", { name: "Phase 1 · 9 sem." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Phase 2 · 4 sem." })).toHaveAttribute("aria-selected", "true");
  await expect(hints.getByText(/Pas d’objectif pour cette phase/).first()).toBeVisible();
  await page.getByLabel("Nom de la phase").fill("Spécifique");
  await page.getByRole("combobox", { name: /^Type/ }).selectOption("BUILD");
  await page.getByLabel(/Objectif de la phase/).fill("3 × 10 s sur 20 mm");
  await page.getByLabel("Objectif", { exact: true }).fill("Faire 7A en 3 mois");
  await expect(hints.getByText(/gagnerait à être mesurable/)).toHaveCount(0);
  await expect(hints.getByText(/Le plan finit sur un bloc chargé/)).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Enregistré en privé")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Saison 7A" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tab", { name: "Spécifique · 4 sem." })).toBeVisible();

  // Patrick mode: a checked draft, reviewed before saving.
  await page.getByRole("button", { name: "Nouveau plan +" }).click();
  await page.getByRole("button", { name: /Patrick me le propose/ }).click();
  await page.getByLabel("Ton objectif principal").fill("Enchaîner mon premier 7A");
  await page.getByRole("group", { name: "Jours où je grimpe souvent dehors" }).getByRole("button", { name: "Samedi" }).click();
  await page.getByRole("button", { name: "Demander une proposition à Patrick" }).click();
  await expect(page.getByText(/Proposition de Patrick : relis-la/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Proposé par Patrick")).toBeVisible();
  await expect(page.getByText("Les semaines des phases ont été ajustées à la durée choisie.")).toBeVisible();
  await expect(page.getByText("Des exercices hors Atlas ont été gardés comme séances libres.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Fondations · 4 sem." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Semaine allégée · 1 sem." })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Spécifique · 8 sem." })).toBeVisible();
  await expect(page.getByLabel("Nom du plan")).toHaveValue("MOCK PLAN — Enchaîner mon premier 7A");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Enregistré en privé")).toBeVisible();
});

test("H — coach sessions: a personal key lets the coach add a session, the climber runs it", async ({ page, request }) => {
  await register(page, "Coach Fan", "coach@leblond.local");

  // Settings: create a coach key, shown once.
  await page.goto("/settings");
  const access = page.getByRole("region", { name: "Accès du coach" });
  await access.getByRole("button", { name: "Créer une clé" }).click();
  const key = (await access.getByTestId("coach-key").textContent())?.trim() ?? "";
  expect(key).toMatch(/^lbk_[0-9a-f]{48}$/);
  await access.getByRole("button", { name: "J’ai enregistré la clé" }).click();
  await expect(access.getByTestId("coach-key")).toHaveCount(0);
  await expect(access.getByText(key.slice(0, 12) + "…")).toBeVisible();

  // The coach, outside the app: no session cookie, only the key.
  const auth = { authorization: "Bearer " + key };
  expect((await request.get("/api/coach-sessions", { headers: { authorization: "Bearer lbk_" + "0".repeat(48) } })).status()).toBe(401);
  const invalid = await request.post("/api/coach-sessions", { headers: auth, data: {
    slug: "bad", title: "X", minutes: 60, exercises: [{ block: "MAIN", name: "X", musclewiki: "made-up-page" }],
  } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).issues[0].path).toBe("exercises.0.musclewiki");
  // Only an administrator's key can share a session with every climber.
  expect((await request.post("/api/coach-sessions", { headers: auth, data: {
    slug: "for-all", title: "X", minutes: 60, shared: true, exercises: [{ block: "MAIN", name: "X" }],
  } })).status()).toBe(403);
  const put = await request.post("/api/coach-sessions", { headers: auth, data: {
    slug: "haut-bas-90", title: "Haut et bas test", objective: "Tirage et genou prudent", minutes: 90, place: "HOME",
    exercises: [
      { block: "WARMUP", name: "Écartés à l’élastique", sets: 2, reps: 15, restAfterSeconds: 120, musclewiki: "band-pull-apart" },
      { block: "MAIN", name: "Tractions lestées", sets: 4, reps: 5, restSeconds: 150, load: "poids du corps", musclewiki: "weighted-pull-ups" },
      { block: "COOLDOWN", name: "Squat profond tenu", modality: "HOLD", sets: 3, seconds: 30 },
    ],
    sources: [{ label: "MuscleWiki", url: "https://musclewiki.com" }],
  } });
  expect(put.status()).toBe(200);
  const list = await request.get("/api/coach-sessions", { headers: auth });
  expect((await list.json()).sessions.map((s: { slug: string }) => s.slug)).toEqual(["haut-bas-90"]);
  // The key opens nothing else.
  expect((await request.post("/api/coach", { headers: auth, data: {} })).status()).toBe(401);

  // The climber finds it in the session list and runs it.
  await page.goto("/train/sessions");
  const coach = page.getByRole("region", { name: "Séances du coach" });
  await expect(coach.getByText("Haut et bas test")).toBeVisible();
  await coach.getByText("Voir les exercices").click();
  await expect(coach.getByRole("link", { name: /Démonstration MuscleWiki/ }).first()).toHaveAttribute("href", "https://musclewiki.com/exercise/band-pull-apart");
  await coach.getByRole("link", { name: "Choisir cette séance" }).click();
  await expect(page.getByText("Durée prévue par le coach : 1 h 30")).toBeVisible();
  await page.getByRole("button", { name: /Commencer maintenant/ }).click();
  await expect(page).toHaveURL(/\/train\/sessions\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name: "Écartés à l’élastique" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Démonstration MuscleWiki/ })).toHaveAttribute("href", "https://musclewiki.com/exercise/band-pull-apart");
  await expect(page.getByText("Repos avant l’exercice suivant : 2:00")).toBeVisible();

  // Moving on after a logged set starts the rest between exercises.
  await page.getByRole("button", { name: "Valider la série" }).click();
  await page.getByRole("button", { name: "Exercice suivant →" }).click();
  const timer = page.getByRole("status").filter({ hasText: "Repos avant l’exercice suivant" });
  await expect(timer).toBeVisible();
  await expect(timer.getByText("Ensuite : Tractions lestées")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tractions lestées" })).toBeVisible();
});

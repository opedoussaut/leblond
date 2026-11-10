# Training Lab — public climbing comparison and private plans

## Overview

- **Public `/training`**: curated catalogue of 11 training methods, four coaching systems and four tools, bilingual FR/EN, filtering by goal, interactive multi-overlay radar, direct research or provider source links.
- **Private `/training-plans`**: signed-in beta users can create, edit and delete plans. Sessions are stored privately with row-level security. Maximum 20 plans per user, 12 phases per plan and 14 sessions per weekly template.
  - **Duration** as entered: 1–260 weeks, 1–60 months or 1–5 years (a month is 52/12 weeks). `weeks` stores the derived length.
  - **Phases** (`phases` jsonb, migration `20261114000000_training_plan_modes.sql`): each has a name, a kind (base, specific, deload, taper, performance), weeks, an optional checkable objective and its own weekly template. `sessions` always holds the first phase, so older readers keep working; the programme in progress uses the phase that covers the current week. Sessions can be marked optional.
  - **Three modes** (`mode`): *MANUAL*, the climber builds everything; *ASSISTED*, the same editor with rule-based hints from `lib/training/plan-hints.ts` (recovery, intensity, volume, structure, goal setting, declared injuries), computed by the app and never blocking a save; *PATRICK*, the climber gives a goal, duration, availability, outdoor days and a specific target, and `/api/coach/plan` asks Patrick for phases as JSON. `lib/training/plan-proposal.ts` checks the answer (Atlas methods only, methods the declared health rules out replaced, weeks fitted to the duration) and returns a draft the climber reviews and saves. Nothing is saved by the endpoint; the proposal is never presented as a prediction.
- **Entry point**: `/training` is linked from the public landing page and works without Supabase configuration. All existing private pages remain gated.

### How to interpret the scores

The six radar axes measure **editorially assessed training emphasis**: technique, finger strength, power, endurance, mental/tactics and overall programming structure. They are **not** measurements of efficacy, rankings, personal fitness, or independent clinical evaluations. The atlas labels methods as supported by controlled studies, limited direct evidence or practice-oriented reasoning. Coaching-system descriptions are based on provider documentation, not head-to-head trials.

External URLs point to academic abstracts or the provider's own documentation. Research is not comprehensive or continuously updated; this is a manageable and transparent first catalogue.

### Public versus private

`proxy.ts` permits the **exact** `/training` route to unauthenticated visitors; no other beta routes are opened. Personal plans require the existing Supabase authentication, a live beta whitelist membership, and an onboarded profile. A public atlas does **not** mean public account registration: self-service sign-ups remain forbidden by an `auth.users` trigger. To let additional friends save plans, the administrator must invite them in the beta whitelist.

The plan table's `training_plans_*` RLS policies enforce ownership with `auth.uid()` and active beta membership; queries run as the authenticated user, never the service role. Names, notes and session data are private.

## Deployment

1. Apply `supabase/migrations/20261019000000_training_plans.sql` (`npx supabase db push` or the existing deploy-database workflow).
2. Deploy the Next.js changes to the existing Vercel project.
3. Confirm logged-out `/training` access and logged-out `/training-plans` redirect to login.
4. Sign in as a beta user; create a plan, reload and verify persistence. Sign in as a different user and verify the first user's plan is not visible or editable.
5. Run the repository's existing `lint`, `typecheck`, `test`, `build` and database checks.

## Public assessment and private progress tracking

- **Public `/training/evaluate`**: friends can rate six climbing capacities on a self-assessment scale of 1–5, select a method, examine a tentative scenario and simulate a later check-in. No login, no database storage.
- **Private `/training-assessment`**: invited beta users can save an initial six-skill rating, a chosen coaching method, sessions/week (1–5), horizon (4–24 weeks), personal goal and dated follow-ups. A radar and a weekly chart compare recorded observations against the illustrative method scenario. A session can be corrected later.
- **Current level**: the top of the page shows boulder and route side by side, each with the declared level, the observed level and the goal. Observed levels appear only when the logged climbs meet the data quality rules (60-day working grade; lead ascents only for routes). Boulder and route are never converted into each other, and an observed level is **never projected into a future climbing grade**.
- **Repeat and evolution**: a climber can keep up to 60 assessments (`MAX_ASSESSMENTS`). `lib/analytics/fitness.ts` turns them into one series per measured test, shown as one small chart in that test's own unit, plus separate self-rated series. Partial conditions appear as hollow points and mark the comparison as indicative. There is deliberately no combined fitness score: measured, observed and self-reported evidence stay apart. The next assessment is suggested with `reassessmentDate`.
- **Reset**: "Repartir de zéro" deletes the climber's own assessments, and their check-ins by cascade, after an inline confirmation. The climbing journal, training sessions and plans are not touched. This cannot be undone.
- **Data isolation**: RLS-protected tables `training_assessments` and `training_checkins`, plus a composite ownership foreign key prevent viewing or attaching check-ins across accounts. The assessment's original baseline and method are immutable. A versioned scenario definition supports auditability.

### Important: illustrative scenario is NOT a validated predictor

At 12 weeks with two declared sessions/week, the most emphasized axis is assigned up to **+0.8 self-rating points** as an editorial scenario, with proportional changes for other axes and additional limits for longer durations or greater declared frequency. This is a transparent linear assumption, not a scientifically supported treatment effect or forecast. Self ratings are not climbing grades or objective measures. A trajectory above or below this line is **not proof** of failure or success.

Supporting measurement science for future versions:
- 74-study review of sport climbing determinants: https://pmc.ncbi.nlm.nih.gov/articles/PMC11904605/
- Physical performance test validity/reliability: https://pmc.ncbi.nlm.nih.gov/articles/PMC10203485/
- Finger strength test reliability review: https://pmc.ncbi.nlm.nih.gov/articles/PMC12521219/

Building a validated predictive model would require consented longitudinal data, standardized tests, held-out validation and quantified uncertainty before publishing actual expected-grade predictions.

### Deployment of the tracking component

The public routes need no backend credentials. The private tracker requires migration `20261019000001_training_assessments.sql` **after** the earlier plan migration; confirm local PostgreSQL RLS tests and two distinct tester accounts before enabling private saving. Public visitor ratings are not persisted.

## Atlas detail pages (`/atlas/[id]`)

Each of the 19 catalogue entries has an enriched, bilingual detail page. Content lives in typed TypeScript, not in the page:

| File | Role |
| --- | --- |
| `lib/training/atlas-types.ts` | `AtlasDetail` shape, protocol keys, source kinds and the 13 diagram spec kinds |
| `lib/training/atlas-content/methods.ts` | the 11 methods |
| `lib/training/atlas-content/coaching.ts` | Lattice, Power Company, Crimpd, Hooper's Beta |
| `lib/training/atlas-content/tools.ts` | hangboard, training board, force sensor, video |
| `lib/training/atlas-content/sources.ts` | shared, verified references (citation, URL, FR/EN finding) |
| `lib/training/atlas-diagram.ts` | pure diagram geometry (timelines, ticks, ladders, label wrapping) |
| `components/training/atlas-diagram.tsx` | SVG renderer (server component) |
| `lib/i18n/atlas.ts` | page headings, diagram labels and the diagram's text alternative |

Every entry gives what it trains, who it suits, prerequisites (level, age, injury history), a protocol table (methods fill intensity, effort, rest, reps, sets, session length and frequency), setup and steps, progression, common mistakes, safety, variants, what to track, a plain-language strength-of-evidence note and its sources.

**Writing rules.** Text is LEBLOND's own summary: no copied provider text, figures or photos. No medical claims or promised results; state how strong the evidence is (small trials, mostly experienced climbers). Prices and plan names of coaching providers change: say "at the time of writing" and send users to the official site.

**Diagrams.** Each diagram is drawn from the numbers in its spec: counts are exact and time axes are to scale. Where a method has an executable session template (`lib/training/session-templates.ts`), `tests/unit/atlas-content.test.ts` fails if the diagram and the template disagree, so change both together. Colours come only from theme tokens (`fill-accent`, `stroke-ink-3`…); meaning is carried by labels, patterns (hatching, stripes, dashes) and shapes as well, never by colour alone. The same numbers are listed as text under each drawing and referenced by `aria-describedby`. The force-test curve is an illustrative shape, labelled as such.

**Adding an entry.** Add the catalogue entry, its scores in `lib/training/atlas.ts`, an `AtlasDetail` in the right content file and any new references in `sources.ts` (https only, verified). Run `npm test`: the content test checks coverage, FR/EN completeness, protocol rows, source format and that every diagram renders in both languages.

## Coach sessions (`coach_sessions`, `/api/coach-sessions`)

Complete sessions written for one climber by their coach — Claude, working with
the climber outside the app, later Patrick — and offered first in the session
type list ("Séances du coach"). Starting one copies its exercises (sets, reps or
seconds, rest, load note, steps, safety, MuscleWiki page) into an ordinary
training session, so the player, history and analytics do not change.

- Schema and checks: `lib/training/coach-sessions.ts` (`coachSessionSchema`).
  MuscleWiki links are only kept for pages in `MUSCLEWIKI_SLUGS`, checked to exist.
  Rows are re-validated on read; a row that no longer parses is skipped.
  For exercises MuscleWiki has no page for, `demo` links an illustrated page on
  one of `DEMO_HOSTS` (sites checked to show a diagram or video). Linked, never
  copied: no third-party images are stored in the app.
- Writing from outside: a personal **coach key** created in Settings → Coach
  access. Shown once, stored as a SHA-256 hash (never readable, even by its
  owner), revocable, 3 active at most, 300 calls a day, dead as soon as the
  climber leaves the active whitelist. Its only power is the climber's coach
  session list, through the `coach_key_*` SECURITY DEFINER functions; the route
  uses the anon key, never the service-role key. `proxy.ts` lets exactly
  `/api/coach-sessions` through without a session cookie (`KEY_AUTH_PATHS`).
- **Shared library**: `"shared": true` offers a session to every active climber.
  Only an administrator's key may share (`forbidden_shared` otherwise). Shared
  sessions are read-only for the others; shared content stays generic (no one's
  personal or health details).
- In the app, a climber reads their own and the shared coach sessions and can
  remove only their own (RLS); there is no direct insert or update grant.
- Pushing: `node scripts/coach-session.mjs list | push file.json… | remove slug`,
  key from `LEBLOND_COACH_KEY` or `~/.leblond/coach-key`. Session files are the
  climber's personal training and stay out of this repository.
- `restSeconds` is the rest between sets; `restAfterSeconds` the rest before the
  next exercise (kept in the exercise snapshot as `restAfter`): the player starts
  that timer when the climber moves on, unless the exercise was skipped.
- Loads and volumes are the coach's proposal, not a validated prescription.

## MongoDB decision

**The existing repository does not use MongoDB**. Identity, security policies and climbing data already live in Supabase/PostgreSQL. This milestone deliberately stores private plans there instead of introducing a second source of identity, secret configuration, database driver, migration path and user-access-control implementation. This keeps the change deployable without additional secrets.

If MongoDB Atlas is a specific requirement, use an **optional server-only storage adapter** behind the same validated plan input types and authenticated Supabase user ID. Required rules:

- never expose the Mongo connection string or any administrative key to browsers or public Git;
- add the official MongoDB Node driver and regenerate `package-lock.json` with npm;
- use TLS and a least-privileged database user, with a unique index on `(userId, _id)`;
- enforce the authenticated ID from `requireViewer()` on **every** operation (never take it from request JSON);
- add cross-user authorization tests and rate limiting;
- do not copy existing personal plans into Atlas without explicit consent and a documented retention policy;
- add account deletion/export support and EU data-hosting/privacy checks where applicable.

Changing the backend without these safeguards would weaken an already secure beta. The public comparison itself requires no MongoDB credentials.

## Follow-up opportunities

Public research data can later move from committed TypeScript to a reviewed CMS. Versioned plan templates, a progress log and source-linked protocol descriptions should precede AI-generated individualized training prescriptions.

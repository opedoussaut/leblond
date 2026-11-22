# Grading

## Principles

1. The **native** grade is always stored as the climber sees it on the wall.
2. A **normalised Font estimate** is optional, separate, and always carries `normalization_confidence` (0–1) and `normalization_source` (`FONT_NATIVE`, `USER_ESTIMATE`, `GYM_PUBLISHED`).
3. Progrès reads every boulder on Font through a correspondence table (the climber's own lines, then the defaults). That reading is an estimate with its source, computed when a page is built, never stored over the native grade. Two colour systems are never equated directly: each goes through Font. Grades with no line are never guessed.

## Systems (`lib/grading/systems.ts`)

| System | Values (easy → hard) | Notes |
|---|---|---|
| `ARKOSE_COLOR` | YELLOW, GREEN, BLUE, RED, BLACK, PURPLE | Initiation, beginner, intermediate, advanced, very good, expert. Source: Arkose “niveau escalade bloc couleur”. |
| `CLIMBING_DISTRICT_COLOR` | WHITE, YELLOW, ORANGE, GREEN, BLUE, RED, BLACK, PURPLE + **PINK** | Climbing District's **former** bouldering scale. PINK = mystery: kind `MYSTERY`, ordinal `null`. Colours overlap (≈4a–8a+ overall). Source: Climbing District FAQ. |
| `CLIMBING_DISTRICT_LEVEL` | `1` … `12` | Climbing District's **current** bouldering scale (since migration `20261119000001`). Numbered gym levels, not Font or French grades; shown as "Niv. 7" / "Lvl 7". No published table links them to the colours or to Font, so LEBLOND has none. |
| `BLOCKOUT_LEVEL` | B0 … B15 | Block'Out's numbered levels (B0 and B15 from Kaskad's observed table, 2026-11-22). |
| `FONT` | 1a, 1b, 1c … 5a, 5b, 5c, 6A, 6A+ … 8C+, 9A (34 steps) | Native Font problems are their own normalised grade (confidence 1). Lettered below 6A, as on the Fontainebleau circuits and in Boolder. |
| `CUSTOM_COLOR` | Generic colours | Unordered: LEBLOND does not know an independent gym's ranking. |
| `UNKNOWN` | UNKNOWN | Unordered. |

Each system has a kind (`GRADE_SYSTEM_KIND`): `COLOUR`, `NUMERIC` (gym levels) or `CONVENTIONAL` (Font). French route grades are a separate scale (`lib/grading/route-grades.ts`).

## Scales over time

A gym's scale can change (Climbing District moved from colours to levels 1–12). Stored grades are never rewritten:

- `gyms.grading_system` is the **current** bouldering scale, the default for new sessions;
  `gyms.former_grading_systems` lists earlier scales, still valid at that gym;
  `gyms.grading_system_since` is the start date of the current scale **only when a source verifies it**
  (null for Climbing District). Before that date, new sessions default to the latest former scale.
- `sessions.grade_system` is the scale a boulder session logs **new** boulders in. Sessions logged before
  the change keep their scale (the migration recorded it before switching the gyms), so editing an old
  Climbing District session still offers its colours. A session can be switched to another scale of its gym
  (a "Scale" switch in the logger, shown only when the gym has more than one); boulders already logged keep theirs.
- Every boulder keeps `problems.native_grade` and `native_grade_system`, so its grade can always be read later.
- Routes follow `gyms.route_grading` (French scale, or the gym's colours); outdoor venues use Font.

Helpers: `lib/grading/scales.ts` (`boulderSystemsForGym`, `defaultBoulderSystem`, `sessionBoulderSystem`).
The database enforces the same rules (`gym_accepts_grade_system`, trigger `sessions_grade_system`).

## Progression across scales

Asked by the product owner on 2026-11-22 ("only two grades, boulder Font and route FFME"): **Progrès and its
sub-pages show boulders on Font and routes on the French scale, nothing else.** No section breaks results down
per gym scale any more. The analytics underneath still work per `nativeGradeSystem`; Progrès feeds them a
Font view of the dataset (below), so every figure lands on the single scale `FONT`. Boulders record first-try
sends as `FLASH`; an onsight is not recorded separately for boulders (routes record it).

Pages outside Progrès (a séance's summary, a boulder's page, projects, the rival, Patrick's context) still show
the grade as logged.

### One Font grade per boulder (`lib/analytics/font-view.ts`)

`fontView(dataset, table)` copies the climbing dataset with every boulder on Font. For each boulder, in order:

1. a native Font problem is its own grade (`FONT_NATIVE`);
2. the climber's per-problem Font estimate wins when its confidence is ≥ 0.5 (`PROBLEM_ESTIMATE`);
3. the climber's own line from Réglages › Correspondance des cotations (`USER_SETTING`, table
   `grade_correspondences`);
4. the default table `DEFAULT_BOULDER_TABLE` (`lib/grading/harmonise.ts`).

A table line is a **span** (Arkose red = 6B–6B+). The boulder counts at **the middle of the span, rounded down
to a whole grade** when the middle falls between two grades (`singleFontGrade`): 6B–6B+ → 6B, 6C+–7A → 6C+,
5c–6A+ → 6A, 7B–7C → 7B+. Rounding down never credits a send with more than its line says. This is the same
middle harmonise.ts scores spans at for Progrès › Charge; Charge keeps the half step on its curve, the other
sections need a whole grade to count a pyramid row or a send rate.

Grades with no line (Climbing District's mystery pink, independent gyms' custom colours, unknown grades) are
**never guessed**: their boulders move to the unordered `UNKNOWN` scale, so they leave every graded figure but
still count in séances, sends, attempts and styles. `conversionSummary` names them, per grade, under each Font
figure ("Sans correspondance, comptés à part : Rose · Couleurs Climbing District ×2").

Every converted grade is an estimate: each boulder keeps `conversion` (native grade, span, source, confidence),
records show the grade as logged next to the Font one, and each section carries a note listing how many
boulders came from which scale and source, the rounding rule, the lowest confidence and a link to Réglages.
The climber's target grade goes through the same table (`fontTarget`).

Routes need no conversion: `route_ascents.grade` is already French; at colour-graded route gyms it is the French
grade the climber chose for that colour (see "Routes at colour-graded gyms").

## Results on two common scales (`lib/grading/harmonise.ts`)

Asked by the product owner on 2026-11-22: Progrès › Charge reads results on two scales so gyms can be compared.

- **Boulders on Font.** Every first send is converted through a correspondence table (`DEFAULT_BOULDER_TABLE`)
  to a Font span, scored at its middle, and combined into one series (`lib/analytics/harmonised.ts`). Each point
  keeps its native grade, its source and its confidence: `GYM_PUBLISHED` (Vertical'Art FAQ, 0.8), `USER_SETTING`
  (0.7), `OBSERVED` (Kaskad's observed tables for Arkose colours and Block'Out B0–B15, "pas une norme officielle",
  0.6), `SHARED_ESTIMATE` (a summary of Climbing District's levels 1–12, also bridging its former colours, 0.45),
  `LEBLOND_ESTIMATE` (first estimates for Climb World 1–7, Climb Up, MROC and Le Labo, 0.35). A confident
  per-problem estimate (≥ 0.5) wins over the table. Custom colours,
  the mystery pink and unknown grades are not converted and are counted apart.
- **Routes on the French scale**, as logged (`route_ascents.grade`), with the gym's colour shown next to it.
- The verdict reads these two series (plus board and hangs). There is no per-native-scale fold any more.
- **Per climber:** Réglages › Correspondance des cotations (`/settings/grades`) stores a climber's own span for
  any grade in `grade_correspondences` (RLS by `auth.uid()`). Defaults stay in code.
- Nothing is written over `problems.native_grade`; the conversion is computed when the page is built.

## Utilities (`lib/grading/ordering.ts`)

`gradeToScore`, `scoreToGrade`, `compareGrades` (same system only, `null` if not comparable), `nextGrade`, `previousGrade`, `maxGrade`, `isMysteryGrade`. The database mirrors validity with `public.is_valid_native_grade()` — keep both in sync.

## Estimates

Climbers can add a Font estimate on any colour problem with a confidence preset: rough (0.3), fairly sure (0.6), confident (0.85). Analytics only use estimates ≥ **0.5** (`RELIABLE_CONFIDENCE`) in the normalised view and Font working grade; the UI always shows coverage (reliable / uncertain / none).

## UI

A grade is always rendered with its **name**; the swatch is decorative (WCAG: never colour alone).

## Font notation below 6A

Since 3 October 2026 the Font scale uses Fontainebleau's lettered grades below 6A (`1a … 5c`), the notation Boolder publishes for every Fontainebleau problem, so outdoor problems are stored exactly as graded. From 6A the usual upper-case notation (`6A`, `6A+` …) is kept. Each entry is one grade step, so trends and "next grade" work across the whole scale.

Indoor tickets that only say "4" or "5+" are logged with the nearest letter. Rows saved before this change were moved by migration `20261003000000_fontainebleau_boolder.sql` to the lowest matching letter: `3 → 3a`, `4 → 4a`, `4+ → 4c`, `5 → 5a`, `5+ → 5c` (a convention, chosen because the old notation does not say which letter was meant).

## Indicative Font ranges next to gym grades

While logging, LEBLOND shows an indicative Fontainebleau range next to each gym grade that has a line
in the default correspondence (e.g. Arkose red "≈ 6B–6B+", Vertical'Art violet "≥ 7B+").
`lib/grading/conversions.ts` reads the same table as the harmonised results
(`DEFAULT_BOULDER_TABLE` in `lib/grading/harmonise.ts`), so a grade shows the same span while logging and in
Progrès. The chip's tooltip names the line's source (published by the gym, observed by Kaskad, shared estimate,
LEBLOND first estimate). The ranges are estimates, never replace the native grade, and do not feed the
per-problem estimates. Grades with no line (the mystery pink, independent gyms' custom colours) show nothing.
The climber's own lines from Réglages win there too: the app shell loads them once
(`GradeRangesProvider` in `components/climbing/grade-ranges.tsx`) and every chip and logging picker reads them;
saving a line revalidates the shell.

## Routes at colour-graded gyms

When a route gym grades by colour, an ascent stores the native colour (`route_ascents.native_grade`) **and**
the French sport grade the climber considers equivalent (`route_ascents.grade`). LEBLOND suggests the French
grade the climber last used for that colour at that gym; it never invents a colour-to-French mapping.

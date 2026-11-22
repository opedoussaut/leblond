# Grading

## Principles

1. The **native** grade is always stored as the climber sees it on the wall.
2. A **normalised Font estimate** is optional, separate, and always carries `normalization_confidence` (0–1) and `normalization_source` (`FONT_NATIVE`, `USER_ESTIMATE`, `GYM_PUBLISHED`).
3. LEBLOND **never** derives Font from a colour automatically and never equates two colour systems.

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

A gym's scale can change (Climbing District moved from colours to levels 1–12). Nothing is ever converted:

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

Analytics group every figure by native system: highest send, highest flash, highest tried-but-not-sent
(projects and failed tries, never counted as sends), working level, trend, distributions and objectives.
Climbing District colours and levels are two scales and are never compared or merged; the UI names the scale
whenever a network or a session has figures in both. Boulders record first-try sends as `FLASH`; an onsight is
not recorded separately for boulders (routes record it).

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
- The verdict reads these two series (plus board and hangs). The per-native-scale results stay in a fold below.
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

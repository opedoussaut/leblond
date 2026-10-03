# Grading

## Principles

1. The **native** grade is always stored as the climber sees it on the wall.
2. A **normalised Font estimate** is optional, separate, and always carries `normalization_confidence` (0–1) and `normalization_source` (`FONT_NATIVE`, `USER_ESTIMATE`, `GYM_PUBLISHED`).
3. LEBLOND **never** derives Font from a colour automatically and never equates two colour systems.

## Systems (`lib/grading/systems.ts`)

| System | Values (easy → hard) | Notes |
|---|---|---|
| `ARKOSE_COLOR` | YELLOW, GREEN, BLUE, RED, BLACK, PURPLE | Initiation, beginner, intermediate, advanced, very good, expert. Source: Arkose “niveau escalade bloc couleur”. |
| `CLIMBING_DISTRICT_COLOR` | WHITE, YELLOW, ORANGE, GREEN, BLUE, RED, BLACK, PURPLE + **PINK** | PINK = mystery: kind `MYSTERY`, ordinal `null`. Colours overlap (≈4a–8a+ overall). Source: Climbing District FAQ. |
| `FONT` | 1a, 1b, 1c … 5a, 5b, 5c, 6A, 6A+ … 8C+, 9A (34 steps) | Native Font problems are their own normalised grade (confidence 1). Lettered below 6A, as on the Fontainebleau circuits and in Boolder. |
| `CUSTOM_COLOR` | Generic colours | Unordered: LEBLOND does not know an independent gym's ranking. |
| `UNKNOWN` | UNKNOWN | Unordered. |

## Utilities (`lib/grading/ordering.ts`)

`gradeToScore`, `scoreToGrade`, `compareGrades` (same system only, `null` if not comparable), `nextGrade`, `previousGrade`, `maxGrade`, `isMysteryGrade`. The database mirrors validity with `public.is_valid_native_grade()` — keep both in sync.

## Estimates

Climbers can add a Font estimate on any colour problem with a confidence preset: rough (0.3), fairly sure (0.6), confident (0.85). Analytics only use estimates ≥ **0.5** (`RELIABLE_CONFIDENCE`) in the normalised view and Font working grade; the UI always shows coverage (reliable / uncertain / none).

## UI

A grade is always rendered with its **name**; the swatch is decorative (WCAG: never colour alone).

## Font notation below 6A

Since 3 October 2026 the Font scale uses Fontainebleau's lettered grades below 6A (`1a … 5c`), the notation Boolder publishes for every Fontainebleau problem, so outdoor problems are stored exactly as graded. From 6A the usual upper-case notation (`6A`, `6A+` …) is kept. Each entry is one grade step, so trends and "next grade" work across the whole scale.

Indoor tickets that only say "4" or "5+" are logged with the nearest letter. Rows saved before this change were moved by migration `20261003000000_fontainebleau_boolder.sql` to the lowest matching letter: `3 → 3a`, `4 → 4a`, `4+ → 4c`, `5 → 5a`, `5+ → 5c` (a convention, chosen because the old notation does not say which letter was meant).

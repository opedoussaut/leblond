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
| `FONT` | 3, 4, 4+, 5, 5+, 6A … 8C+, 9A | Native Font problems are their own normalised grade (confidence 1). |
| `CUSTOM_COLOR` | Generic colours | Unordered: LEBLOND does not know an independent gym's ranking. |
| `UNKNOWN` | UNKNOWN | Unordered. |

## Utilities (`lib/grading/ordering.ts`)

`gradeToScore`, `scoreToGrade`, `compareGrades` (same system only, `null` if not comparable), `nextGrade`, `previousGrade`, `maxGrade`, `isMysteryGrade`. The database mirrors validity with `public.is_valid_native_grade()` — keep both in sync.

## Estimates

Climbers can add a Font estimate on any colour problem with a confidence preset: rough (0.3), fairly sure (0.6), confident (0.85). Analytics only use estimates ≥ **0.5** (`RELIABLE_CONFIDENCE`) in the normalised view and Font working grade; the UI always shows coverage (reliable / uncertain / none).

## UI

A grade is always rendered with its **name**; the swatch is decorative (WCAG: never colour alone).

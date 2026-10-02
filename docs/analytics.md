# Analytics

All metrics are pure functions in `lib/analytics`, tested in `tests/unit`. Rates are always returned with their counts.

| Metric | Definition |
|---|---|
| Problem outcome | Per problem over a set of attempts: sent (any TOP/FLASH), flashed (an attempt classified FLASH — only possible on attempt #1), attempts to send (global attempt number of the first send). |
| Send rate | sent problems ÷ problems tried (distinct problems). |
| Flash rate | flashed problems ÷ problems tried. |
| Attempts per send | mean attempts-to-send over sent problems. |
| Tops | distinct problems sent. |
| Highest sent / flashed | per native system; mystery/unordered grades excluded; Font estimate shown only if reliable. |
| **Working level** | Highest grade where, over the last **60 days**: ≥ **5** distinct problems tried, ≥ **3** sent, send rate ≥ **40 %**. Per native system, independently. Not the hardest-ever send. |
| **Font working grade** | Same rule using only reliable Font estimates (confidence ≥ 0.5) and native Font problems; `null` otherwise. |
| Recent trend | Mean ordinal of the 5 hardest sends in the last 30 days vs the previous 30; needs ≥ 3 sends per window; ±0.5 grade step to call improving/declining. |
| Weekly activity | ISO weeks (UTC), sessions / attempts / tops / flashes, empty weeks included. |
| Style / wall-angle stats | Per tag/angle: problems, sent, flashed, send rate. Verdicts need ≥ 3 problems (≥ 2 within one session). |
| Cross-gym native view | Per network → per native grade, tried vs sent. Never merged across networks. |
| Cross-gym normalised view | Per Font grade from reliable estimates only; shown when ≥ 10 reliable problems; coverage always reported. |
| Wearable personal trend | Session avg HR vs the previous 3 sessions within ±25 % duration; ≥ 5 bpm to say higher/lower. Personal context, not physiology. |
| Road to target | Six dimensions (grade exposure, consistency, flash ability, efficiency, style coverage, recent progression), each with status + evidence. **No composite percentage.** |

`computeSnapshot()` assembles them for a period (30/90 days/all); working levels always use their own 60-day window. The UI exposes “How is this calculated?” next to working level, trend and road-to-target.

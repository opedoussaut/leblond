# Tindeq Progressor: integration plan

Status: **design, nothing built.** This workstream starts after the current Training Journey, Atlas, outdoor topo and session-editing work, all released by November 2026.

Nothing below claims compatibility with a Tindeq file that hasn't been checked. The parser is written only against real exports (see "Sample files needed").

## What is known, and from where

| Topic | Known | Source |
|---|---|---|
| App CSV/ZIP export | **Not publicly documented.** We don't know the columns, units, separator, decimal mark, metadata or file grouping. | No Tindeq page found; to be confirmed with real files |
| Bluetooth protocol | Progressor service `7e4e1701-1ea6-40c9-9dcc-13d34ffead57`, data notifications `…1702…`, control point `…1703…`. Commands are TLV: tare 100, start weight 101, stop 102, peak RFD 103/104, app version 107, battery 111, sleep 110. Weight packets (code 1) hold 8-byte samples: little-endian float32 weight and uint32 timestamp in **µs**. Unit labelled kg in Tindeq's example. | [Tindeq Progressor API](https://tindeq.com/progressor_api/), [example client](https://github.com/blims/Tindeq-Progressor-API) |
| Sampling rate | Not stated by Tindeq; to be measured from the timestamps in real data | — |

## Fit with the existing data model

Tindeq reuses what is already there. It doesn't add a new training workflow.

- **Source file**
  - Kept in a new private storage bucket, `force-files`, under `<user_id>/…`.
  - Same policy as `wearable-files`: the owner only, private, with a size limit.
- **`force_recordings`** (one per imported file or BLE capture)
  - `user_id`, `source` (`TINDEQ_CSV` | `TINDEQ_BLE`).
  - `content_sha256`, unique per user, so a re-import is a no-op. This is idempotent in the same way as the FIT `dedup_key`.
  - `raw_file_reference` (checked to be in the owner's folder), `recorded_at`, `sample_rate_hz` (measured), `unit`.
  - Parser version and file metadata as found.
  - Optional links:
    - `training_session_id` / `training_exercise_id` (max hangs, repeaters, other finger protocols);
    - `assessment_id`.
- **`force_recording_samples`**
  - The raw series, kept apart from the summary, as `wearable_activity_samples` already is.
  - Full resolution for the curve. It is never sent to Patrick.
- **`force_efforts`**
  - Individual pulls or reps found in the signal.
  - Derived metrics, each stored with its method name and version.
- **`force_test_conditions`**
  - Hand (L/R/both), grip, edge depth (mm), body position, protocol (+ version), unit, body weight included (y/n) and body weight, equipment, date and time.
  - A **comparability key** built from these conditions. Charts and Patrick only compare recordings that share the key.
- **Training**
  - An effort can fill the set it belongs to: `training_exercise_sets.load_kg` / `seconds`.
  - This happens only when the climber confirms, never silently.
- **Assessment**
  - `training_assessments` stays self-reported.
  - Measurements are a separate, labelled "measured" layer: a baseline, then reassessments.
  - An import never overwrites an assessment.
- **Follow-up**
  - Curve per recording.
  - Change over time, only within one comparability key.
- **Patrick**
  - Added to `lib/coach/context.ts` (bounded): derived metrics plus their conditions and method, labelled as measurements.
  - No raw samples, and no computing by the model.
- **RLS**
  - Every new table is owner-only, with active beta membership, like `training_*`.
  - pgTAP-style tests in `supabase/tests/`.

## Metrics (phase 2): only with a documented method

| Metric | Method (to confirm against real data) |
|---|---|
| Peak force | Maximum sample over the effort, in the recorded unit |
| Mean force | Mean over a stated window (e.g. the 7 s of a 7:3 rep, the middle N s of a max hang) |
| Rate of force development | Slope over a stated window from a stated onset threshold. Reported only if the sampling rate allows it. |
| Sustained force / critical force | Mean of the last N contractions of an all-out repeater test. The Atlas already describes this rule. |
| Force decline | Change in per-rep mean between the first and last reps of a set |

Each metric is a pure function in `lib/analytics` with unit tests on fixtures, following the existing rule that there are no formulas in JSX.

## Phase 4: live Bluetooth (separate milestone)

- **Web Bluetooth**
  - Works in Chrome on Android, Windows, macOS and ChromeOS.
  - Not available in Safari on iOS or iPadOS (every iOS browser uses WebKit), so iPhone climbers couldn't record live in the PWA.
- **The real options**
  1. Android/desktop live recording in the PWA, plus CSV import for everyone else.
  2. A native wrapper later. That is a separate decision, as the brief requires.
- **Cost**
  - No paid service is needed for either.
  - [Grip Connect](https://github.com/Stevie-Ray/hangtime-grip-connect) is the best candidate for the Bluetooth layer:
    - BSD 2-Clause, compatible with LEBLOND.
    - Web Bluetooth plus Capacitor and React Native packages. Capacitor would be the route to iPhone without rewriting the app.
    - It supports several devices besides the Progressor (Force Board, Climbro, Entralpi, WH-C06…), so one integration could cover several sensors later.
    - It isn't made or supported by Tindeq, and some commands come from firmware analysis. Use only the commands in Tindeq's published API, pin the version, and test on a real Progressor.
    - Its `download()` CSV/JSON is the library's own format, not the Tindeq app's export. It could become a second import source, but the importer still needs real Tindeq app files.

## Sample files needed before writing the importer

From the Tindeq Progressor app, exported as-is, unedited:

1. **Peak force / max hang** test, one hand, 2–3 pulls.
2. **Same test, other hand**, to see how hand and conditions appear.
3. **Repeaters**, e.g. 7:3 × 6, so per-rep segmentation can be checked.
4. **Endurance / critical force** test, if used.
5. **Peak RFD** test, if the app offers it.
6. **A full session export** with several tests, as a ZIP or one big file if the app groups them.
7. The **same file exported twice**, to confirm duplicates are detected by content.
8. **One export with the phone set to French** and one in English, for separators, decimal mark and headers.

For each file, a note of: the test chosen in the app, hand, edge depth, body weight included or not, and app version. These are the conditions the file might not contain.

The files are personal data. They stay out of the repo. Fixtures for tests are synthetic files that follow the confirmed format.

## Acceptance scenario (end-to-end, to build)

1. Upload a CSV.
2. See the curve.
3. Confirm the protocol.
4. Fill in the missing conditions.
5. Save it against a training session or an assessment.
6. Re-upload the same file: you're told it's already imported, and nothing is duplicated.
7. Compare it with an earlier recording that has the same conditions.
8. See the change in Follow-up.
9. Patrick explains it using the stored metrics.

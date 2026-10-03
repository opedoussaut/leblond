# Integrations

## Status

| Provider | V1 status | Method |
|---|---|---|
| Arkose | Supported | Native grade + adapter |
| Climbing District | Supported | Native grade + adapter |
| COROS | Supported path | Official API/MCP when authorized + FIT fallback |
| Suunto | Supported path | Official Cloud API when authorized + FIT fallback |
| Garmin | Supported path | Official Developer Program when authorized + FIT fallback |
| Strava | Planned next | Official OAuth/API |
| Boolder (Fontainebleau) | Supported | Open data import (CC BY 4.0), read-only catalogue |
| bleau.info | Link only | No licence to reuse its data: problems link to bleau.info, nothing is copied |

## Gym networks (`lib/integrations/gyms`)

`ClimbingGymProvider` contract. Arkose and Climbing District adapters exist and report `NATIVE_GRADING_ONLY`; `getGyms()` throws `NoOfficialApiError` instead of scraping. No public, authorised API is documented by either network today. When one becomes available: *provider API → adapter → canonical model*, no domain change needed.

V1 behaviour = native grade support + manual logging (+ any future user-authorised export).

## Fontainebleau — Boolder (`lib/integrations/outdoor/boolder.ts`)

Boolder publishes its Fontainebleau topo as open data (SQLite `boolder.db`, https://github.com/boolder-org/boolder-data) under **CC BY 4.0**. LEBLOND imports it into a read-only catalogue:

- `outdoor_areas` (one LEBLOND gym per area: brand `OUTDOOR`, grading `FONT`, `external_provider = 'BOOLDER'`), `outdoor_circuits`, `outdoor_problems`, and an `outdoor_data_imports` log.
- Grades: Boolder's lower-case grades map one-to-one onto LEBLOND's Font scale (`4b` stays `4b`, `6a+` becomes `6A+`). A problem without a valid grade is **skipped and reported**, never guessed (4 of 19,139 in the 5 September 2026 data).
- Steepness: slab → `SLAB`, wall → `VERTICAL`, overhang → `OVERHANG`, roof → `ROOF`; traverse and other → `UNKNOWN` (a traverse is a direction, not a wall angle).
- Area warnings (e.g. closures after the July 2026 wildfires) are shown before starting a session there.
- In a live session at a Fontainebleau area the climber picks the boulder from the topo (search by name or circuit number, filter by circuit colour and grade). Picking the same boulder again reuses the climber's own problem, so attempts accumulate across sessions. A boulder missing from the topo can still be logged with the Font grade grid.
- Climbers never write the catalogue (RLS + revoked privileges); their problems and attempts stay private. If a problem disappears upstream, the climber's history is kept and only the link is cleared.
- **Attribution**: "Topo: © Boolder, CC BY 4.0" with links, wherever catalogue data appears (area picker, live picker, problem page, Connections).

Import: GitHub Actions → **Import Boolder (Fontainebleau)** (`.github/workflows/import-boolder.yml`), or locally `npx tsx scripts/import-boolder.ts --db boolder.db` (service role). `tests/fixtures/boolder-sample.json` holds 39 real rows for tests and local development.

## Policy

- Official/authorised APIs only. No scraping, no reverse engineering.
- Endpoints come from official documentation; partner-only endpoints are configuration, never guessed.
- A provider is “Connected” only after a stored, successful OAuth exchange (see `lib/integrations/wearables/status.ts`, unit-tested).
- Provider logos are not used.

Wearable details: [wearables.md](wearables.md).

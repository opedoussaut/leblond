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
| Google My Maps (team topos) | Supported | KMZ/KML export uploaded by the admin; the data stays out of the repository |
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

Import: GitHub Actions → **Import Boolder (Fontainebleau)** (`.github/workflows/import-boolder.yml`), or locally `npx tsx scripts/import-boolder.ts --db boolder.db` (service role). With `--sql-dir <dir>` the script writes SQL batches instead; the workflow runs those through the Supabase Management API with the deploy secrets. `tests/fixtures/boolder-sample.json` holds 39 real rows for tests and local development.

## Other outdoor sites

Sites Boolder does not cover are single rows in `gyms`, added by migration with `external_provider = 'LEBLOND'` (see `20261102000001_outdoor_sites.sql`). They appear in the outdoor tab, not in the gym list, and work even if the Boolder catalogue was never imported.

Climbers can also add a crag from the outdoor picker (*+ Ajouter un site extérieur*): a shared `gyms` row with brand `OUTDOOR`, Font grading for boulders, the disciplines it offers and an optional link to its source page (a guide, a federation page). Boulders and routes logged there carry their own name, grade, sector, beta and topo reference (book, page, number) with an optional link. These are citations: guidebook diagrams and photos are never copied.

- **Dampierre Maincourt:** bouldering on the Font scale. The climber logs by grade, or picks from the team topo once the admin has imported it.
- **bleau.info:** link only, opened in a new tab. Nothing is copied or scraped.

## Team topos — Google My Maps (`lib/integrations/outdoor/mymaps.ts`)

A beta tester can draw a site's topo in Google My Maps; the admin uploads its export in *Profil → Bêta fermée → Topos de l’équipe*. The file is read on the server (`kmz.ts`: a .kmz zip holding `doc.kml`, or a plain .kml; 900 KB upload, 5 MB inflated at most) and never stored. Only the boulders reach the database, through `admin_import_leblond_topo()` in the admin's own session. Team topos are never committed to this repository: a map is its author's work, not open data.

- **Map conventions:** one layer per circuit colour (`Orange`, `Rouge`, `Jaune`, `Bleu`, `Blanc`, `Noir`, `Vert`, `Violet`, `Saumon`, `Bleu ciel`, or the English names); other layers (`Hors circuit…`, `Autres`) are off-circuit. One pin per boulder named `<name> <grade>`, e.g. `La Roncerie 5` or `Sourire 7a`. On a circuit layer the description starts with the circuit code (`O12`, `B5b:`); off-circuit, a `O13b: ` name prefix puts the boulder on its circuit (the letter is learnt from the circuit layers).
- **Grades:** lettered grades map one-to-one (`4c`, `6a+` → `6A+`). Grades without a letter use the app's convention (docs/grading.md): the lowest matching letter, `4-` and `4` → `4a`, `4+` → `4c`. From 6 a letter is required. Pins without a readable grade (parking, notes, sectors) are skipped and listed to the admin, never guessed.
- **Storage:** the same tables as Boolder, with `source = 'LEBLOND'`: one `outdoor_areas` row for the site's gym (with a `credit`), one circuit per colour, one problem per pin. Ids come from `outdoor_leblond_id_seq` (from 1,000,000,000, far above Boolder's).
- **Re-import:** replaces the site's topo. A boulder keeps its id when its key is unchanged (`<colour>:<number>`, or `hc:<name>` off-circuit), so climbers' logged problems stay linked; a boulder that leaves the topo is deleted and the climber's problem keeps its attempts, unlinked. The admin is told how many logged boulders lose their link.
- **Replacing a topo with a list:** the *Deploy database* workflow, mode `topo-list` (inputs `topo_site`, `topo_list`), runs `scripts/apply-topo-list.ts`: the written list becomes the whole topo. Boulders it matches (by name, or circuit and number) keep their key and position; the others are removed, climbers' logs unlinked. The script reads its inputs from the event file, runs the import as the active admin and prints counts only. Em dashes are never kept in boulder names.
- **Boolder is untouched:** the Boolder import deletes and counts `source = 'BOOLDER'` rows only, and a team topo cannot be imported into a Boolder area.
- **Credit:** the live picker and problem page show "Topo : <credit>" instead of Boolder's attribution, and no Boolder link.

## Boulder map — OpenStreetMap (`components/climbing/topo-map.tsx`)

The boulder picker has a *Liste / Carte* switch, and a catalogue boulder's page has *Voir sur la carte* and *Ouvrir dans OpenStreetMap*. Both work for Boolder areas and team topos (`outdoor_problems.latitude/longitude`).

- **Loaded on demand.** Leaflet (`leaflet` 1.9) and its CSS are code-split with `next/dynamic` (`ssr: false`). Neither they nor any tile are fetched until the climber opens a map.
- **Pins.** Each pin shows the circuit colour and number, or the grade off-circuit. It is a keyboard-focusable button labelled "orange 12 · La Roseline · 4c". Pins are built with DOM nodes, never HTML strings, because topo names come from uploaded files. Tapping a pin shows the boulder, then *Choisir ce bloc*. The filters (circuit, grade, search) apply to the map too, capped at 1,500 pins.
- **Tiles.** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, following the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/):
  - "© OpenStreetMap" attribution on the map;
  - the browser's Referer is sent (`strict-origin-when-cross-origin`);
  - no prefetching or offline download (`public/sw.js` only handles navigations, so tiles stay in the browser cache);
  - max zoom 19.
  If usage outgrows a small beta, switch to a tile provider with a key. The URL is `OSM_TILES` in `lib/integrations/outdoor/osm.ts`.
- **Tests.** The E2E topo test opens the map and picks a boulder from its pin. Tile requests are aborted, so CI never calls OSM.

## Policy

- Official/authorised APIs only. No scraping, no reverse engineering.
- Endpoints come from official documentation; partner-only endpoints are configuration, never guessed.
- A provider is “Connected” only after a stored, successful OAuth exchange (see `lib/integrations/wearables/status.ts`, unit-tested).
- Provider logos are not used.

Wearable details: [wearables.md](wearables.md).

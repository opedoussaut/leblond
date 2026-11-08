# Roadmap

Status as of November 2026. "Delivered" means live on https://leblond.vercel.app and covered by tests.

## Delivered

- **Logging**
  - Live and after-the-fact sessions, editable afterwards (date, start time, hours + minutes duration).
  - Bouldering: native gym colours (Arkose, Climbing District, Block’Out, Climb Up, Vertical Art, custom colours) and Font, with optional Font estimates; batch entry.
  - Routes: lead, top-rope or auto-belay, French grades, route projects.
- **Outdoor**
  - Fontainebleau topo from Boolder open data (CC BY 4.0, attributed): searchable areas and problems, picked while logging, links to Boolder and bleau.info.
  - Crags without a topo, added by climbers and shared with the other testers, with a link to their source page.
  - Problems and route lines logged outside a topo, then completed afterwards: name, grade, sector, notes, beta, topo reference and link, photos and videos.
  - Topo references are citations; guidebook diagrams and photos are never copied.
- **Training Lab**: assessments, atlas, plans, calendar, session player, Training vs Follow-up, alter ego.
- **Patrick**: AI coach on a bounded, structured context. Served by OpenAI or by any OpenAI-compatible server; production uses OpenRouter. Streaming, a per-climber daily limit, and clear messages when the provider is busy or out of credit.
- **Wearables**
  - Provider-neutral FIT import with de-duplication.
  - Link to the overlapping session; optionally take the watch's start time and duration after a side-by-side confirmation (Europe/Paris).
  - Each session's times are marked as typed by hand or taken from the watch.
- **Platform**: FR/EN, mobile-first PWA, RLS on every user table, CI with database and end-to-end tests.

## Pending release

- **Closed beta.** Sign-up restricted to the invitation whitelist (built and tested). It ships once the invitations are loaded in production, so that nobody is locked out.

## Next — ROAD TO TARGET

- Richer working-level views per grading system, style and wall angle.
- Normalised cross-gym analysis as estimate coverage grows.
- Wearable trend overlays.
- More licensed outdoor topo sources, when their licence allows reuse.
  - Found so far: OpenBeta (CC0) has too little French data to be useful.

## Milestone — VISION

Photo analysis, selected video-frame analysis, movement annotations, problem recognition help, Patrick visual coaching, video comparison. Media metadata (duration, dimensions) is already stored.

## Milestone — SYNC

- COROS, Suunto and Garmin production sync, once each provider approves API access. The adapters are written and report their status truthfully.
- Strava OAuth and activity sync, with cross-provider de-duplication.
- Deeper Arkose or Climbing District integration, if an authorised API appears.
- Offline session logging.

## Later — not built now

Friends and shared or live sessions, comments, likes, leaderboards, public profiles, gym maps, Apple Health, Google Health Connect, coach voice mode, notifications, AI video comparison, MCP server, public API.

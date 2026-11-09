# Wearables

## Model

Every source becomes a `NormalizedWorkout` (`lib/integrations/wearables/types.ts`): provider, external id, type, start, duration, and only the optional fields actually present (calories, avg/max HR, HR samples, provider training load, recovery metrics, device). Provenance is kept in `raw_metadata`.

## FIT import (universal fallback)

`/api/uploads/fit` → Garmin's official FIT JavaScript SDK → integrity check → session/record parsing → de-duplication → raw file kept in the user's private `wearable-files` folder → suggestion of the overlapping climbing session. Max 4 MB. Works with exports from COROS, Suunto, Garmin and most watches.

### Session times from the watch (`20261108000000_fit_timing.sql`, `20261109000004_watch_timing_wins.sql`)

- **The watch wins.** Linking an activity to a finished session (after a FIT import, from Connections or from the session page) gives the session the watch's start time and duration at once: `link_wearable_activity` calls `apply_activity_timing`. There is no side-by-side comparison and nothing to confirm. Before linking, the session page says which times the session will take (Europe/Paris time).
- **Sessions still running.** An activity linked to a live session gives its times when the session is ended (`endSession`).
- **No usable timing.** If the activity has no usable duration or starts in the future, the link is kept and the typed times stay; the session page says why.
- **Correcting by hand.** Editing the times afterwards marks them `MANUAL` ("Horaires corrigés à la main"); a single button goes back to the watch's.
- **Older links.** `20261109000004` switched sessions that were linked with typed times to the watch's times (internal `apply_activity_timing_as`, not callable by climbers).
- **What `apply_activity_timing` does.**
  - Sets `started_at`, `ended_at` and `duration_minutes` from the activity.
  - Refuses a live session, an activity without a usable duration (under 1 minute or over 24 hours), or a start in the future.
  - Moves attempts and ascents with the session when they would otherwise fall outside it.
- **Where the times come from.** `sessions.timing_source` is `ACTIVITY` until the times are edited by hand, then `MANUAL`. The session page shows which, and whether the activity came from an imported FIT file.
- **No duplicates.** One activity per session; re-importing the same file is reported as a duplicate.

## Providers

| Provider | Auth | Activity delivery | Configuration |
|---|---|---|---|
| Garmin | OAuth 2.0 + PKCE — `connect.garmin.com/oauth2Confirm`, token `diauth.garmin.com/di-oauth2-service/oauth/token` (Garmin PKCE spec); user id via Wellness API; deregistration on disconnect | Push/ping notifications registered in the Garmin portal — part of program approval (M4 SYNC). Until then: FIT. | `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_REDIRECT_URI` |
| Suunto | OAuth 2.0 — `cloudapi-oauth.suunto.com/oauth/authorize` / `/oauth/token`, `Ocp-Apim-Subscription-Key` on every call | Pull `cloudapi.suunto.com/v2/workouts` (mapping to validate with live credentials) | `SUUNTO_CLIENT_ID`, `SUUNTO_CLIENT_SECRET`, `SUUNTO_SUBSCRIPTION_KEY`, `SUUNTO_REDIRECT_URI` |
| COROS | OAuth 2.0 (Partner API) | Webhook push + FIT downloads (partner docs) | `COROS_CLIENT_ID`, `COROS_CLIENT_SECRET`, `COROS_REDIRECT_URI`, `COROS_AUTHORIZE_URL`, `COROS_TOKEN_URL` |
| Strava | OAuth 2.0 (developers.strava.com) | Next milestone | `STRAVA_*` (unused in V1) |

Redirect URIs must be `https://<domain>/api/integrations/<provider>/callback`. `<PROVIDER>_API_ENV=development` shows “Development/testing”.

COROS also documents a self-service developer path (COROS MCP) for a developer's own account — useful for prototyping with Olivier's own data, not a multi-user integration.

## Status logic

`REQUIRES_PROVIDER_APPROVAL` when credentials/endpoints, `TOKEN_ENCRYPTION_KEY` or the service-role key are missing → `CONNECTED` / `ERROR` / `DISCONNECTED` from the stored connection → otherwise `AVAILABLE` (or `DEVELOPMENT_TESTING`). Strava: `NOT_YET_AVAILABLE`.

## De-duplication

Exact: unique (user, provider, provider activity id). Cross-source: `dedup_key` = hash(start minute, duration in minutes) and a tolerance match (start ±2 min, duration ±5 % or 60 s). Prevents counting a Garmin workout mirrored to Strava twice.

## Use in analytics

Displayed: duration, avg/max HR, calories, provider training load, device — only when present. Patrick may compare a session to the climber's own previous comparable sessions. No medical interpretation.

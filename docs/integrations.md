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

## Gym networks (`lib/integrations/gyms`)

`ClimbingGymProvider` contract. Arkose and Climbing District adapters exist and report `NATIVE_GRADING_ONLY`; `getGyms()` throws `NoOfficialApiError` instead of scraping. No public, authorised API is documented by either network today. When one becomes available: *provider API → adapter → canonical model*, no domain change needed.

V1 behaviour = native grade support + manual logging (+ any future user-authorised export).

## Policy

- Official/authorised APIs only. No scraping, no reverse engineering.
- Endpoints come from official documentation; partner-only endpoints are configuration, never guessed.
- A provider is “Connected” only after a stored, successful OAuth exchange (see `lib/integrations/wearables/status.ts`, unit-tested).
- Provider logos are not used.

Wearable details: [wearables.md](wearables.md).

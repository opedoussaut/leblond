@AGENTS.md

# LEBLOND — notes for coding agents

The master specification is the LEBLOND build brief (kept in the LeBlond Claude project).
Non-negotiables, in short:

- Never fake an integration or a "Connected" state. Provider status comes from `lib/integrations/wearables/status.ts`.
- Native gym grades are always stored as-is. Font normalisation is a separate, optional estimate with confidence + source (`lib/grading`).
- Analytics are pure functions in `lib/analytics` with unit tests. No formulas in JSX. Patrick never computes metrics.
- Patrick receives a bounded, structured context from `lib/coach/context.ts`, never raw DB dumps.
- Personal data is private by default: every user table has RLS. Wearable tokens are encrypted and never readable by the client.
- No secrets, no real beta-tester emails, no real climbing history in the repo.
- User-facing strings live in `lib/i18n` (fr default, en).
- Before finishing: `npm run lint && npm run typecheck && npm test && npm run build` and `npm run test:db` (needs Postgres).

# Security and privacy

## Checklist (brief §45)

| Item | Implementation |
|---|---|
| RLS enabled | Every table; owner-scoped policies; gym catalogue readable by active beta users only; `anon` has no table access. Verified by `supabase/tests/rls.test.sql` (CI + real local Supabase). |
| No secrets committed | `.env*` ignored except `.env.example`; gitleaks job in CI. |
| Service-role key never in browser | Imported only from `lib/supabase/admin.ts` (`server-only`). |
| Private routes protected | `proxy.ts` + `requireViewer()` (whitelist still active, onboarding done). |
| Uploads constrained | Private buckets with size and MIME limits; objects under `<user_id>/`; server re-checks type, size, path and object existence. FIT ≤ 4 MB with integrity check. |
| API routes authenticated | `/api/coach`, `/api/uploads/fit`, `/api/integrations/*` require a signed-in active beta user. |
| OAuth | Random `state` (+ PKCE for Garmin) in an httpOnly, path-scoped, 10-minute cookie bound to the user id; constant-time comparison; tokens AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`); token columns not granted to client roles. |
| AI rate limit | Per user per 24 h, counted on append-only `ai_usage`. |
| Input validation | Zod on every server action and route; DB check constraints for grades, flash rule, ranges. |
| Safe errors | Generic error codes to clients; no private content in logs; AI telemetry has no prompt text. |
| Whitelist | Server pre-check before sending email + `auth.users` trigger rejecting uninvited/deactivated emails. |

## Admin

The admin can manage the whitelist and see aggregate counts (account created, Patrick requests in 30 days) via `admin_beta_overview()`. Admin rights do **not** grant access to testers' climbing data.

## Personal data

Height/weight optional. Wearable data is shown as personal context, never as medical data. Demo/seed data is synthetic (`@leblond.local`).

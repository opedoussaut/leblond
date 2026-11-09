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
| Whitelist | `auth.users` trigger rejects uninvited/deactivated emails on every sign-up route (password, email code, magic link, Google). `is_active_beta_user()` gates RLS, and `requireViewer()` sends accounts outside the active whitelist to `/revoked`; their data is kept. The login page tells a refused address it is not part of the closed beta, which reveals whether an address is invited, not whether it has an account. |
| Invitation links | `beta_invites`: the admin alone reads, creates and cancels them (RLS); never deleted. A code is 10 characters from a 32-symbol alphabet (≈10^15 values), single-use, valid 30 days. `redeem_beta_invite()` (callable without an account: holding the code is the permission) adds the email to the whitelist just before sign-up and answers only yes or no; it never re-activates a tester the admin deactivated. |

## Admin

The admin can manage the whitelist and see aggregate counts (account created, Patrick requests in 30 days) via `admin_beta_overview()`. Deactivating / reactivating a tester goes through `admin_set_beta_user_active()` in the admin's own session (checks `is_admin()`; never the admin's own row or another admin), so the app needs no service-role key for it. Admin rights do **not** grant access to testers' climbing data.

## Personal data

Height/weight optional. Wearable data is shown as personal context, never as medical data. Demo/seed data is synthetic (`@leblond.local`).

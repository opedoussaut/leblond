# Training Lab — public climbing comparison and private plans

## Overview

- **Public `/training`**: curated catalogue of 11 training methods, four coaching systems and four tools, bilingual FR/EN, filtering by goal, interactive multi-overlay radar, direct research or provider source links.
- **Private `/training-plans`**: signed-in beta users can create, edit and delete individual weekly plan templates repeated over 1–52 weeks. Sessions are stored privately with row-level security. Maximum 20 plans per user and 14 sessions per week.
- **Entry point**: `/training` is linked from the public landing page and works without Supabase configuration. All existing private pages remain gated.

### How to interpret the scores

The six radar axes measure **editorially assessed training emphasis**: technique, finger strength, power, endurance, mental/tactics and overall programming structure. They are **not** measurements of efficacy, rankings, personal fitness, or independent clinical evaluations. The atlas labels methods as supported by controlled studies, limited direct evidence or practice-oriented reasoning. Coaching-system descriptions are based on provider documentation, not head-to-head trials.

External URLs point to academic abstracts or the provider's own documentation. Research is not comprehensive or continuously updated; this is a manageable and transparent first catalogue.

### Public versus private

`proxy.ts` permits the **exact** `/training` route to unauthenticated visitors; no other beta routes are opened. Personal plans require the existing Supabase authentication, a live beta whitelist membership, and an onboarded profile. A public atlas does **not** mean public account registration: self-service sign-ups remain forbidden by an `auth.users` trigger. To let additional friends save plans, the administrator must invite them in the beta whitelist.

The plan table's `training_plans_*` RLS policies enforce ownership with `auth.uid()` and active beta membership; queries run as the authenticated user, never the service role. Names, notes and session data are private.

## Deployment

1. Apply `supabase/migrations/20261019000000_training_plans.sql` (`npx supabase db push` or the existing deploy-database workflow).
2. Deploy the Next.js changes to the existing Vercel project.
3. Confirm logged-out `/training` access and logged-out `/training-plans` redirect to login.
4. Sign in as a beta user; create a plan, reload and verify persistence. Sign in as a different user and verify the first user's plan is not visible or editable.
5. Run the repository's existing `lint`, `typecheck`, `test`, `build` and database checks.

## MongoDB decision

**The existing repository does not use MongoDB**. Identity, security policies and climbing data already live in Supabase/PostgreSQL. This milestone deliberately stores private plans there instead of introducing a second source of identity, secret configuration, database driver, migration path and user-access-control implementation. This keeps the change deployable without additional secrets.

If MongoDB Atlas is a specific requirement, use an **optional server-only storage adapter** behind the same validated plan input types and authenticated Supabase user ID. Required rules:

- never expose the Mongo connection string or any administrative key to browsers or public Git;
- add the official MongoDB Node driver and regenerate `package-lock.json` with npm;
- use TLS and a least-privileged database user, with a unique index on `(userId, _id)`;
- enforce the authenticated ID from `requireViewer()` on **every** operation (never take it from request JSON);
- add cross-user authorization tests and rate limiting;
- do not copy existing personal plans into Atlas without explicit consent and a documented retention policy;
- add account deletion/export support and EU data-hosting/privacy checks where applicable.

Changing the backend without these safeguards would weaken an already secure beta. The public comparison itself requires no MongoDB credentials.

## Follow-up opportunities

Public research data can later move from committed TypeScript to a reviewed CMS. Versioned plan templates, a progress log and source-linked protocol descriptions should precede AI-generated individualized training prescriptions.

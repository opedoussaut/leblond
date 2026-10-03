# Hosting LEBLOND with nothing installed on your laptop

Everything below is done in a web browser. GitHub holds the code and runs the
setup jobs, Vercel runs the app, Supabase holds the data and sends sign-in
emails (through an SMTP provider), and a model provider runs Patrick.

| Piece | Service | Free tier facts (check current terms) |
|---|---|---|
| Code + setup jobs | GitHub | Public repo, GitHub Actions |
| App (website + API) | Vercel Hobby | Free, **non-commercial personal use only**; functions up to 300 s |
| Database, sign-in, files | Supabase Free | 2 active projects, 500 MB database, 1 GB files; **paused after 1 week of inactivity** (restore from the dashboard) |
| Sign-in emails | An SMTP provider (e.g. Resend, Brevo, Postmark) | Supabase's built-in mailer only reaches your Supabase team, not your testers |
| Patrick | See [Choosing Patrick's model](#choosing-patricks-model) | |

GitHub Pages alone cannot host LEBLOND: it serves static files only, and the
app needs server code (sign-in, Patrick, uploads) and a database.

## Steps

### 0. Merge the release into `main`
Merge the open `develop → main` pull request. GitHub only shows the
"Run workflow" button for workflows that exist on the default branch.

### 1. Create the Supabase project
supabase.com → New project (EU region). Note:
- the **project ref** (the id in the project URL) and the **database password** you chose;
- Project Settings → API: the **URL**, the **anon key** and the **service_role key**;
- Account → Access Tokens: create a **personal access token**.

### 2. Add GitHub secrets
Repository → Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | personal access token |
| `SUPABASE_PROJECT_ID` | project ref |
| `SUPABASE_DB_PASSWORD` | database password |
| `NEXT_PUBLIC_SUPABASE_URL` | API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `BETA_OLIVIER_EMAIL` … `BETA_DAVID_EMAIL` | the five testers' emails |

Secrets are never shown in the public repo or in workflow logs.

### 3. Create the tables
Actions → **Deploy database (Supabase)** → Run workflow. Re-run it whenever a release adds a migration.
(Alternative: Supabase → SQL editor → paste each file of `supabase/migrations/` in name order → Run.)

### 4. Load the whitelist
Actions → **Update beta whitelist** → Run workflow. The log shows names and roles only.

### 4b. Load the Fontainebleau topo (optional)
Actions → **Import Boolder (Fontainebleau)** → Run workflow. It downloads Boolder's open data (© Boolder, CC BY 4.0) and loads the Fontainebleau areas, circuits and problems; the log shows the counts. Re-run it from time to time to pick up Boolder's updates (new problems, closures). Settings → Connections shows the date of the last import.

### 5. Configure Supabase Auth (dashboard)
- Authentication → **SMTP**: enter your SMTP provider's settings.
- Authentication → **Email Templates**: paste `supabase/templates/magic-link.html` into *Magic Link* and `supabase/templates/confirmation.html` into *Confirm signup* (open the files on GitHub and copy them).

### 6. Create the encryption key
In any browser, open the developer console (F12) and run:
```js
btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
```
Copy the result: it is `TOKEN_ENCRYPTION_KEY`. Keep it only in Vercel.

### 7. Deploy on Vercel
vercel.com → Add New → Project → import `opedoussaut/leblond` (production branch `main`).
Environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `TOKEN_ENCRYPTION_KEY` | from step 6 |
| Patrick variables | see below |

Deploy, then note the production URL (e.g. `https://leblond-xyz.vercel.app`).

### 8. Connect the URLs
- Vercel → Settings → Environment Variables: `NEXT_PUBLIC_SITE_URL` = the production URL → Redeploy.
- Supabase → Authentication → URL Configuration: Site URL = the production URL; add `https://<production-url>/auth/callback` to Redirect URLs.

### 9. Use it
On the phone, open the URL, sign in with your email, complete onboarding.
iPhone: Safari → Share → *Add to Home Screen*. Android: Chrome → *Install app*.

## Choosing Patrick's model

Patrick works with two kinds of provider (`lib/coach/config.ts`):

**A. OpenAI** — `COACH_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`. Paid per use.

**B. Any OpenAI-compatible server running an open-weight model** —
`COACH_PROVIDER=openai-compatible`, `COACH_BASE_URL`, `COACH_MODEL`, and
`COACH_API_KEY` only if the server requires one.

- *Hosted open-model APIs* (Groq, Mistral, OpenRouter, Cerebras, GitHub Models…)
  need nothing on your laptop, but **do require an API key** (stored in Vercel).
  Several have free tiers with daily request limits; compare them against your
  expected use (five testers × `MAX_COACH_REQUESTS_PER_USER_PER_DAY`), and check
  whether the free tier may use your requests for training — Patrick's context
  contains your climbing statistics.
- *Self-hosted, no key at all* (Ollama, vLLM…) requires a machine that is always
  on and reachable from Vercel: a rented server, or a home computer exposed
  through a tunnel. Speed depends heavily on hardware: in this project's test, a
  1.7-billion-parameter model on 2 CPU cores took about 2 minutes per answer.

### Recommended free setup: Groq

Facts from Groq's documentation (checked 3 October 2026; re-check, limits change):
- free plan, OpenAI-compatible API at `https://api.groq.com/openai/v1`;
- `openai/gpt-oss-120b` is a **production** model (131,072-token context);
- free limits for that model: **30 requests/min, 1,000 requests/day, 8,000 tokens/min, 200,000 tokens/day**, counted for the whole Groq organisation (all testers together);
- by default Groq does not retain inference data; a Zero Data Retention option exists under Data Controls; data that is retained is stored in the United States.

**Budget (estimate, method shown).** A Patrick request = instructions + context + conversation history (capped by `COACH_HISTORY_CHAR_BUDGET`) + the question. Sizes measured on 3 October 2026, after the Fontainebleau update:
- instructions (`prompts/patrick-v1.md`): **4,865 characters**;
- context, worst case measured: **11,365 characters** — a synthetic 90-day history with 36 sessions and 432 problems across Arkose, Climbing District and Fontainebleau, 8 recent sessions with watch data, and a session under review with 40 problems (the context is hard-capped at 14,000 characters by `lib/coach/context.ts`);
- history: 4,000 characters; question: ≈ 200 characters.

At the ratio measured on a real call (≈3.9 characters per token, on Qwen's tokenizer — gpt-oss's tokenizer differs, so treat this as an estimate):
- input ≈ (4,865 + 11,365 + 4,000 + 200) / 3.9 ≈ **5,240 tokens**;
- output capped at **1,500 tokens** with `COACH_MAX_OUTPUT_TOKENS`;
- ⇒ ≈ **6,700 tokens per request** in the worst case (most requests are smaller).

So, on the free plan: about **one full request per minute** for the whole group (8,000 tokens/min), and at least **29 requests per day** (200,000 / 6,740). With five testers, `MAX_COACH_REQUESTS_PER_USER_PER_DAY=5` keeps the group under the daily quota even in the worst case (5 × 5 = 25). If two testers ask Patrick in the same minute, the second sees “Patrick is very busy, try again in a minute”.

**Steps (browser only)**
1. console.groq.com → sign up → **API Keys** → *Create API Key* (starts with `gsk_`).
2. Optional, recommended: **Data Controls** → enable Zero Data Retention.
3. Vercel → Settings → Environment Variables:

   | Variable | Value |
   |---|---|
   | `COACH_PROVIDER` | `openai-compatible` |
   | `COACH_BASE_URL` | `https://api.groq.com/openai/v1` |
   | `COACH_MODEL` | `openai/gpt-oss-120b` |
   | `COACH_API_KEY` | your `gsk_…` key |
   | `COACH_MAX_OUTPUT_TOKENS` | `1500` |
   | `COACH_REASONING_EFFORT` | `low` |
   | `COACH_HISTORY_CHAR_BUDGET` | `4000` |
   | `MAX_COACH_REQUESTS_PER_USER_PER_DAY` | `5` |

   Redeploy.
4. To test before the testers do: add the same `COACH_*` values as GitHub repository secrets, then Actions → **Patrick live check** → Run workflow. It asks Patrick one question about synthetic data and prints the answer, the time taken and the tokens used. Check that it answers in French, quotes 3/6 sent (50 %), and invents nothing.

Whichever you choose, model quality matters: Patrick's rules (answer in the
climber's language, never invent figures, label estimates) are followed less
reliably by very small models. Use
`tests/unit/coach-live-model.test.ts` to try a candidate model on synthetic data
before giving it to the testers.

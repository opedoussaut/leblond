-- Training journey: one notion of "the programme in progress" and a daily check-in.
--
--   training_assessments (bilan complet: goal, availability, health, tests, method)
--          │ 1
--          ▼ 0..n   training_plans.assessment_id   (the weekly template it proposed)
--          │
--          └──────► training_day_checks.assessment_id (bilan du jour: readiness → today's session)
--
-- Purely additive. Health, availability and home equipment of a full assessment
-- live in its existing `context` jsonb, so legacy rows are untouched.

-- ── Programme ← assessment link ───────────────────────────────────────────
-- Composite key: a plan can only point at an assessment of the same climber.
-- Deleting the assessment keeps the plan (only the link is cleared).
alter table public.training_plans add column assessment_id uuid;
alter table public.training_plans
  add constraint training_plans_assessment_fk foreign key (user_id, assessment_id)
  references public.training_assessments(user_id, id) on delete set null (assessment_id);
create index training_plans_assessment on public.training_plans (user_id, assessment_id) where assessment_id is not null;

-- ── Daily check-in ("bilan du jour") ──────────────────────────────────────
-- One row per climber and local day; redoing the check-in replaces it.
-- pain: array of {area, level}; recommendation: the session LEBLOND proposed,
-- kept as a snapshot because the programme it was derived from can change.
create table public.training_day_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  check_date date not null check (check_date between '2020-01-01' and '2100-12-31'),
  sleep smallint not null check (sleep between 1 and 3),
  fatigue smallint not null check (fatigue between 1 and 3),
  soreness smallint not null check (soreness between 0 and 2),
  pain jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pain) = 'array' and jsonb_array_length(pain) <= 7),
  minutes_available integer not null check (minutes_available between 0 and 300),
  place text not null check (place in ('BOULDER_GYM','ROUTE_GYM','CRAG','HOME','NONE')),
  outcome text not null check (outcome in ('AS_PLANNED','REDUCED','TECHNIQUE','MOBILITY','REST')),
  method_id text check (method_id is null or char_length(method_id) between 1 and 100),
  recommended_minutes integer not null default 0 check (recommended_minutes between 0 and 300),
  reasons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reasons) = 'array' and jsonb_array_length(reasons) <= 12),
  assessment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, check_date),
  foreign key (user_id, assessment_id) references public.training_assessments(user_id, id) on delete set null (assessment_id)
);
create index training_day_checks_owner_date on public.training_day_checks (user_id, check_date desc);
create trigger training_day_checks_updated_at before update on public.training_day_checks
  for each row execute function public.set_updated_at();

alter table public.training_day_checks enable row level security;
-- Start from nothing so the column-level UPDATE grant below is what applies.
revoke all on public.training_day_checks from anon, authenticated;
grant select, insert, delete on public.training_day_checks to authenticated;
-- Owner, day and programme link are never rewritten by an update.
grant update (sleep, fatigue, soreness, pain, minutes_available, place, outcome, method_id,
  recommended_minutes, reasons) on public.training_day_checks to authenticated;

create policy day_checks_select on public.training_day_checks for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy day_checks_insert on public.training_day_checks for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy day_checks_update on public.training_day_checks for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy day_checks_delete on public.training_day_checks for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

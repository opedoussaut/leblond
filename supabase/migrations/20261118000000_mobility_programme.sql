-- Mobility programmes (first one: hip mobility, from zero to functional climbing mobility).
--
--   mobility_enrollments    one row per climber and programme. The working level is the
--                           level whose content the sessions use; only the climber changes
--                           it (never the calendar, never a number of weeks).
--   mobility_assessments    dated, repeatable beginner tests (left/right, conditions,
--                           support, discomfort). The results are validated by the app;
--                           `stage` is the internal training stage shown at the time
--                           (NOT a clinical grade) and `rules_version` the rules that set it.
--   training_exercise_sets  + side, variant, controlled, discomfort and details, so a
--                           mobility set records more than reps.
--
-- Sessions stay ordinary training_sessions (method_id 'hip-mobility'), run in the
-- existing player and shown in the existing calendar. Purely additive, except the
-- daily check-in pain list, which grows by one area ('hip').

create table public.mobility_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  programme text not null check (programme in ('HIP')),
  started_on date not null check (started_on between '2020-01-01' and '2100-12-31'),
  working_level smallint not null default 0 check (working_level between 0 and 4),
  level_changed_at timestamptz not null default now(),
  sessions_per_week smallint not null default 3 check (sessions_per_week between 1 and 7),
  session_length text not null default 'STANDARD' check (session_length in ('SHORT','STANDARD')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, programme)
);
create trigger mobility_enrollments_updated_at before update on public.mobility_enrollments
  for each row execute function public.set_updated_at();

create table public.mobility_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  programme text not null check (programme in ('HIP')),
  assessed_on date not null check (assessed_on between '2020-01-01' and '2100-12-31'),
  protocol_version smallint not null check (protocol_version between 1 and 100),
  conditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conditions) = 'object' and pg_column_size(conditions) <= 4000),
  results jsonb not null
    check (jsonb_typeof(results) = 'array' and jsonb_array_length(results) between 1 and 16 and pg_column_size(results) <= 16000),
  stage smallint not null check (stage between 0 and 4),
  rules_version smallint not null check (rules_version between 1 and 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mobility_assessments_owner_date on public.mobility_assessments (user_id, programme, assessed_on desc, created_at desc);
create trigger mobility_assessments_updated_at before update on public.mobility_assessments
  for each row execute function public.set_updated_at();

alter table public.mobility_enrollments enable row level security;
alter table public.mobility_assessments enable row level security;
-- Start from nothing so the column-level UPDATE grants below are what applies.
revoke all on public.mobility_enrollments, public.mobility_assessments from anon, authenticated;
grant select, insert, delete on public.mobility_enrollments, public.mobility_assessments to authenticated;
-- Owner, programme and start date are never rewritten; results are never edited after the fact.
grant update (working_level, level_changed_at, sessions_per_week, session_length, status)
  on public.mobility_enrollments to authenticated;
grant update (notes) on public.mobility_assessments to authenticated;

create policy mobility_enrollments_select on public.mobility_enrollments for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_enrollments_insert on public.mobility_enrollments for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_enrollments_update on public.mobility_enrollments for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_enrollments_delete on public.mobility_enrollments for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

create policy mobility_assessments_select on public.mobility_assessments for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_assessments_insert on public.mobility_assessments for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_assessments_update on public.mobility_assessments for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_assessments_delete on public.mobility_assessments for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

-- ── What a mobility set records ────────────────────────────────────────────
-- side: which leg; variant: the version actually done; controlled: the climber
-- kept control through the whole range; discomfort: 0–10 as felt; details:
-- warning signs (catching, block, sharp pain) and, later, board-drill settings.
alter table public.training_exercise_sets
  add column side text check (side is null or side in ('LEFT','RIGHT','BOTH')),
  add column variant text check (variant is null or variant in ('EASIER','STANDARD','HARDER')),
  add column controlled boolean,
  add column discomfort smallint check (discomfort is null or discomfort between 0 and 10),
  add column details jsonb check (details is null or (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2000));
grant update (side, variant, controlled, discomfort, details) on public.training_exercise_sets to authenticated;

-- ── 'hip' joins the body areas: a daily check-in can list 8 areas ─────────
alter table public.training_day_checks drop constraint training_day_checks_pain_check;
alter table public.training_day_checks add constraint training_day_checks_pain_check
  check (jsonb_typeof(pain) = 'array' and jsonb_array_length(pain) <= 8);

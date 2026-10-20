-- Executable training sessions, distinct from climbing sessions.
--
--   training_plans ──(plan_id, plan_session_index)──┐
--   calendar_entries ──(calendar_entry_id)──────────┤
--                                                   ▼
--                                        training_sessions  (PLANNED → IN_PROGRESS → COMPLETED,
--                                                   │          or SKIPPED / CANCELED / INTERRUPTED)
--                                                   ▼
--                                  training_session_exercises  (immutable instruction snapshot)
--                                                   ▼
--                                    training_exercise_sets    (recorded work, one row per set)
--
-- Purely additive: no existing table or row is modified. Every table is
-- user-owned and protected by RLS. A climbing session done as part of a
-- training session is LINKED (climbing_session_id), never copied, so attempts
-- are counted once, in the climbing journal.

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  objective text not null default '' check (char_length(objective) <= 300),
  method_id text check (method_id is null or char_length(method_id) between 1 and 100),
  plan_id uuid references public.training_plans(id) on delete set null,
  plan_session_index integer check (plan_session_index is null or plan_session_index between 0 and 13),
  calendar_entry_id uuid references public.calendar_entries(id) on delete set null,
  climbing_session_id uuid references public.sessions(id) on delete set null,
  venue text not null default '' check (char_length(venue) <= 120),
  status text not null default 'PLANNED'
    check (status in ('PLANNED','IN_PROGRESS','COMPLETED','SKIPPED','CANCELED','INTERRUPTED')),
  -- Local wall-clock schedule, like calendar_entries (never converted to UTC).
  scheduled_date date check (scheduled_date is null or scheduled_date between '2020-01-01' and '2100-12-31'),
  scheduled_time time(0),
  planned_minutes integer check (planned_minutes is null or planned_minutes between 5 and 480),
  -- Timers derive from timestamps, never from client interval callbacks.
  started_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds between 0 and 86400),
  completed_at timestamptz,
  actual_minutes integer check (actual_minutes is null or actual_minutes between 0 and 1440),
  current_index integer not null default 0 check (current_index between 0 and 40),
  rpe smallint check (rpe is null or rpe between 1 and 10),
  pain smallint check (pain is null or pain between 0 and 10),
  pain_notes text not null default '' check (char_length(pain_notes) <= 500),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint training_sessions_started check (status in ('PLANNED','SKIPPED','CANCELED') or started_at is not null),
  constraint training_sessions_completed check (status <> 'COMPLETED' or completed_at is not null),
  constraint training_sessions_order check (completed_at is null or started_at is null or completed_at >= started_at),
  constraint training_sessions_plan_ref check ((plan_id is null) = (plan_session_index is null) or plan_id is null)
);
create index training_sessions_owner_date on public.training_sessions (user_id, scheduled_date desc nulls last, created_at desc);
-- At most one running training session per climber.
create unique index training_sessions_one_live on public.training_sessions (user_id) where status = 'IN_PROGRESS';
-- Starting a calendar entry twice resumes the same session (idempotent).
create unique index training_sessions_one_per_calendar_entry on public.training_sessions (calendar_entry_id)
  where calendar_entry_id is not null;
create trigger training_sessions_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();

create table public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null,
  position integer not null check (position between 0 and 40),
  block text not null check (block in ('WARMUP','MAIN','COOLDOWN')),
  method_id text check (method_id is null or char_length(method_id) between 1 and 100),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- Snapshot of the instructions as they were when the session was created,
  -- so later Atlas edits never rewrite a historical workout.
  instructions jsonb not null default '{}'::jsonb check (jsonb_typeof(instructions) = 'object'),
  modality text not null check (modality in ('REPS','HOLD','TIME','ROUTES','INTERVALS','FREE')),
  target_sets integer check (target_sets is null or target_sets between 1 and 30),
  target_reps integer check (target_reps is null or target_reps between 1 and 200),
  target_seconds integer check (target_seconds is null or target_seconds between 1 and 7200),
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 1800),
  intensity text not null default '' check (char_length(intensity) <= 160),
  status text not null default 'PENDING' check (status in ('PENDING','DONE','MODIFIED','SKIPPED')),
  rpe smallint check (rpe is null or rpe between 1 and 10),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position),
  unique (user_id, id),
  foreign key (user_id, session_id) references public.training_sessions(user_id, id) on delete cascade
);
create index training_session_exercises_owner on public.training_session_exercises (user_id, session_id, position);
create trigger training_session_exercises_updated_at before update on public.training_session_exercises
  for each row execute function public.set_updated_at();

create table public.training_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  exercise_id uuid not null,
  set_index integer not null check (set_index between 1 and 50),
  reps integer check (reps is null or reps between 0 and 500),
  seconds integer check (seconds is null or seconds between 0 and 7200),
  load_kg numeric(5,1) check (load_kg is null or load_kg between -100 and 300),
  completed boolean not null default true,
  notes text not null default '' check (char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- (exercise, set number) is the natural key: retried saves upsert, never duplicate.
  unique (exercise_id, set_index),
  foreign key (user_id, exercise_id) references public.training_session_exercises(user_id, id) on delete cascade
);
create index training_exercise_sets_owner on public.training_exercise_sets (user_id, exercise_id, set_index);
create trigger training_exercise_sets_updated_at before update on public.training_exercise_sets
  for each row execute function public.set_updated_at();

-- ── Row-level security ─────────────────────────────────────────────────────
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
alter table public.training_exercise_sets enable row level security;
-- Supabase default privileges grant ALL to anon and authenticated; start from nothing so
-- the column-level UPDATE grants below are what actually applies.
revoke all on public.training_sessions, public.training_session_exercises, public.training_exercise_sets from anon, authenticated;
grant select, insert, delete on public.training_sessions, public.training_session_exercises, public.training_exercise_sets to authenticated;
-- Identity and lineage columns are never updatable by clients.
grant update (title, objective, venue, status, scheduled_date, scheduled_time, planned_minutes,
  started_at, paused_at, paused_seconds, completed_at, actual_minutes, current_index,
  rpe, pain, pain_notes, notes, climbing_session_id)
  on public.training_sessions to authenticated;
grant update (status, rpe, notes) on public.training_session_exercises to authenticated;
grant update (reps, seconds, load_kg, completed, notes) on public.training_exercise_sets to authenticated;

create policy training_sessions_select on public.training_sessions for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy training_sessions_insert on public.training_sessions for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and (plan_id is null or exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid()))
    and (calendar_entry_id is null or exists (select 1 from public.calendar_entries c where c.id = calendar_entry_id and c.user_id = auth.uid())));
create policy training_sessions_update on public.training_sessions for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and (climbing_session_id is null or exists (select 1 from public.sessions s where s.id = climbing_session_id and s.user_id = auth.uid())));
create policy training_sessions_delete on public.training_sessions for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

create policy training_exercises_select on public.training_session_exercises for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy training_exercises_insert on public.training_session_exercises for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy training_exercises_update on public.training_session_exercises for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy training_exercises_delete on public.training_session_exercises for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

create policy training_sets_select on public.training_exercise_sets for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy training_sets_insert on public.training_exercise_sets for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy training_sets_update on public.training_exercise_sets for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy training_sets_delete on public.training_exercise_sets for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

-- ── Assessment protocol metadata (additive; existing rows keep defaults) ──
-- kind: SELF (legacy six-slider rows), BASIC (short profile), STRUCTURED (guided protocol).
-- measurements: array of {id, value, unit, evidence, protocolVersion, conditions, quality}.
-- context: reference conditions, observed-from-log evidence snapshot, safety screening.
alter table public.training_assessments
  add column kind text not null default 'SELF' check (kind in ('SELF','BASIC','STRUCTURED')),
  add column protocol_version integer not null default 1 check (protocol_version between 1 and 100),
  add column measurements jsonb not null default '[]'::jsonb check (jsonb_typeof(measurements) = 'array'),
  add column context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object');

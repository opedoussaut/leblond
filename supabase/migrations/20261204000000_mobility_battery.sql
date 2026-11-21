-- Mobility performance assessment (battery v2): a 4-weekly tracking bilan of 20 cards
-- (M01–M20), 18 done at home and 2 by a clinician. It sits BESIDE the hip-mobility
-- beginner assessment (mobility_assessments), which keeps driving the hip programme.
--
--   mobility_battery_sessions  one sitting (or two slots) of the battery. Only one can be
--                              in progress per climber. Once completed or stopped, only the
--                              next-day symptom check and the notes can change.
--   mobility_battery_results   one raw value per card / side / item / scored trial, or an
--                              explicit "not done" with its reason (never a zero). Results
--                              can only be written while their session is in progress.
--
-- No score is stored: the app shows raw values and their trend per test. The safety screen
-- answers (red flags) are never stored: a red flag blocks the start and nothing is written.
-- Purely additive.

create table public.mobility_battery_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  protocol_version smallint not null check (protocol_version between 1 and 100),
  started_on date not null check (started_on between '2020-01-01' and '2100-12-31'),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','STOPPED')),
  -- Why a session was stopped part-way: a warning sign during a test, or the climber's choice.
  stop_reason text check (stop_reason is null or stop_reason in ('NEURO_WORSE','SYMPTOM','CHOICE')),
  -- Chair height, shoes, framing, warm-up, time of day: so the next bilan can be done the same way.
  conditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conditions) = 'object' and pg_column_size(conditions) <= 2000),
  knee_pain_today boolean not null default false,
  -- Self-declared: the date a clinician reviewed the spine and the radiating pain.
  -- It unlocks the cards marked "after clinical review"; the app cannot verify it.
  clinical_review_on date check (clinical_review_on is null or clinical_review_on between '2000-01-01' and '2100-12-31'),
  -- Symptoms the day after (D+1), as felt.
  d1_check jsonb check (d1_check is null or (jsonb_typeof(d1_check) = 'object' and pg_column_size(d1_check) <= 2000)),
  completed_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'STOPPED') = (stop_reason is not null)),
  check ((status = 'IN_PROGRESS') = (completed_at is null))
);
create index mobility_battery_sessions_owner_date on public.mobility_battery_sessions (user_id, started_on desc, created_at desc);
create unique index mobility_battery_sessions_one_open on public.mobility_battery_sessions (user_id) where status = 'IN_PROGRESS';
create trigger mobility_battery_sessions_updated_at before update on public.mobility_battery_sessions
  for each row execute function public.set_updated_at();

-- A finished session is a record: it never goes back in progress, and only the D+1 check
-- and the notes change afterwards.
create or replace function public.mobility_battery_session_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'IN_PROGRESS' then
    if new.status is distinct from old.status or new.stop_reason is distinct from old.stop_reason
       or new.conditions is distinct from old.conditions or new.knee_pain_today is distinct from old.knee_pain_today
       or new.clinical_review_on is distinct from old.clinical_review_on or new.completed_at is distinct from old.completed_at then
      raise exception 'a finished mobility bilan only accepts its next-day check and notes' using errcode = '42501';
    end if;
  end if;
  if new.d1_check is not null and old.d1_check is distinct from new.d1_check and new.status = 'IN_PROGRESS' then
    raise exception 'the next-day check comes after the bilan' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger mobility_battery_session_guard before update on public.mobility_battery_sessions
  for each row execute function public.mobility_battery_session_guard();

create table public.mobility_battery_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mobility_battery_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  card_id text not null check (card_id ~ '^M(0[1-9]|1[0-9]|20)$'),
  card_version smallint not null check (card_version between 1 and 100),
  side text not null check (side in ('LEFT','RIGHT','BOTH')),
  -- A card can hold several items (PSFS: 3 tasks; M01: back and leg pain).
  item smallint not null default 1 check (item between 1 and 6),
  -- Scored trial 1 or 2 (the familiarisation try is not recorded).
  trial smallint not null default 1 check (trial between 1 and 2),
  status text not null check (status in ('DONE','NOT_DONE')),
  value numeric(7,1) check (value is null or value between -1000 and 10000),
  category text check (category is null or category ~ '^[A-Z_]{1,32}$'),
  unit text not null check (unit in ('SCORE','SECONDS','REPS','CM','DEGREES','CATEGORY','REPORT')),
  not_done_reason text check (not_done_reason is null or not_done_reason in
    ('PAIN','STOPPED_SYMPTOM','LOCKED','NO_EQUIPMENT','NO_TIME','NOT_SAFE','OTHER')),
  pain_before smallint check (pain_before is null or pain_before between 0 and 10),
  pain_after smallint check (pain_after is null or pain_after between 0 and 10),
  radiation text check (radiation is null or radiation in ('NONE','SAME','LOWER_OR_STRONGER')),
  -- Stop signs seen, hands used, variant, compensation, PSFS task, clinician-reported angles.
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 3000),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, card_id, side, item, trial),
  -- "Not done" is never a zero: no value, and always a reason.
  check (
    (status = 'DONE' and not_done_reason is null and (value is not null or category is not null or unit = 'REPORT'))
    or (status = 'NOT_DONE' and value is null and category is null and not_done_reason is not null)
  )
);
create index mobility_battery_results_owner_card on public.mobility_battery_results (user_id, card_id);
create index mobility_battery_results_session on public.mobility_battery_results (session_id);
create trigger mobility_battery_results_updated_at before update on public.mobility_battery_results
  for each row execute function public.set_updated_at();

-- Access levels, enforced again in the database: cards that need a clinical review, or no
-- knee pain, cannot be recorded as done without it; clinician cards are only ever a report.
create or replace function public.mobility_battery_result_guard() returns trigger
language plpgsql set search_path = '' as $$
declare s record;
begin
  select user_id, status, knee_pain_today, clinical_review_on into s
    from public.mobility_battery_sessions where id = new.session_id;
  if s is null or s.user_id <> new.user_id then
    raise exception 'result and bilan must belong to the same climber' using errcode = '42501';
  end if;
  if new.status = 'DONE' then
    if new.card_id in ('M11','M17','M18') and s.clinical_review_on is null then
      raise exception 'this card needs a clinical review first' using errcode = '23514';
    end if;
    if new.card_id = 'M05' and s.knee_pain_today then
      raise exception 'this card is skipped on a day with knee pain' using errcode = '23514';
    end if;
    if new.card_id in ('M19','M20') and new.unit <> 'REPORT' then
      raise exception 'clinician cards are reports, not self-tests' using errcode = '23514';
    end if;
    if new.unit = 'REPORT' and new.card_id not in ('M19','M20') then
      raise exception 'only clinician cards are reports' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger mobility_battery_result_guard before insert or update on public.mobility_battery_results
  for each row execute function public.mobility_battery_result_guard();

alter table public.mobility_battery_sessions enable row level security;
alter table public.mobility_battery_results enable row level security;
revoke all on public.mobility_battery_sessions, public.mobility_battery_results from anon, authenticated;
grant select, insert, delete on public.mobility_battery_sessions, public.mobility_battery_results to authenticated;
-- Owner, protocol version and date are never rewritten.
grant update (status, stop_reason, conditions, knee_pain_today, clinical_review_on, d1_check, completed_at, notes)
  on public.mobility_battery_sessions to authenticated;
grant update (status, value, category, unit, not_done_reason, pain_before, pain_after, radiation, details, note)
  on public.mobility_battery_results to authenticated;

create policy mobility_battery_sessions_select on public.mobility_battery_sessions for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_battery_sessions_insert on public.mobility_battery_sessions for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user() and status = 'IN_PROGRESS');
create policy mobility_battery_sessions_update on public.mobility_battery_sessions for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_battery_sessions_delete on public.mobility_battery_sessions for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

-- Results: the owner's own, and written only while their bilan is in progress.
create policy mobility_battery_results_select on public.mobility_battery_results for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_battery_results_insert on public.mobility_battery_results for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user() and exists (
    select 1 from public.mobility_battery_sessions s
    where s.id = session_id and s.user_id = auth.uid() and s.status = 'IN_PROGRESS'));
create policy mobility_battery_results_update on public.mobility_battery_results for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user() and exists (
    select 1 from public.mobility_battery_sessions s
    where s.id = session_id and s.user_id = auth.uid() and s.status = 'IN_PROGRESS'))
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_battery_results_delete on public.mobility_battery_results for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user() and exists (
    select 1 from public.mobility_battery_sessions s
    where s.id = session_id and s.user_id = auth.uid() and s.status = 'IN_PROGRESS'));

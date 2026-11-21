-- Mobility Rebuild | 12 Weeks: a personal 12-week programme of 36 dated séances.
--
--   mobility_enrollments      + programme 'REBUILD_12W', its weekdays, the content written for the
--                               climber (18 séances: A/B/C × 6 phases) and a self-reported clinical
--                               review (date and restrictions; the app authorises nothing).
--   training_sessions         + enrollment_id / programme_slot (1–36): one séance per slot, so
--                               assigning twice never duplicates; programme_phase (planned phase) and
--                               original_date (first planned date, to show "postponed").
--   mobility_session_checks   the symptom check before a séance, the stop reason during it and the
--                               next-day follow-up. Owner-only health data. The answers to the
--                               emergency questions are never stored: only the verdict.
--   coach_key_assign_rebuild  writes the programme to the coach key's owner (and no one else),
--                               never with a date in the past; re-running only adds missing slots.
--   coach_key_rebuild_status  counts, to verify an assignment.
--
-- Additive: no row is changed, the hip programme is untouched.

-- ── Enrolment ─────────────────────────────────────────────────────────────
alter table public.mobility_enrollments drop constraint mobility_enrollments_programme_check;
alter table public.mobility_enrollments add constraint mobility_enrollments_programme_check
  check (programme in ('HIP', 'REBUILD_12W'));
alter table public.mobility_enrollments
  add column schedule_days smallint[] check (
    schedule_days is null or (array_length(schedule_days, 1) between 1 and 7 and 1 <= all (schedule_days) and 7 >= all (schedule_days))),
  add column content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 524288),
  add column clinical_review_on date check (clinical_review_on is null or clinical_review_on between '2020-01-01' and '2100-12-31'),
  add column clinical_restrictions text not null default '' check (char_length(clinical_restrictions) <= 1000);
comment on column public.mobility_enrollments.clinical_review_on is
  'Self-reported by the climber: the day a professional reviewed them. Not a medical clearance issued by the app.';
-- The climber changes their days and records a review; the content is the coach's (key only).
grant update (schedule_days, clinical_review_on, clinical_restrictions) on public.mobility_enrollments to authenticated;

-- ── Séances of the programme ─────────────────────────────────────────────
alter table public.training_sessions
  add column enrollment_id uuid references public.mobility_enrollments(id) on delete set null,
  add column programme_slot smallint check (programme_slot is null or programme_slot between 1 and 36),
  add column programme_phase smallint check (programme_phase is null or programme_phase between 1 and 6),
  add column original_date date check (original_date is null or original_date between '2020-01-01' and '2100-12-31');
create unique index training_sessions_one_per_slot on public.training_sessions (enrollment_id, programme_slot)
  where enrollment_id is not null;
-- Re-dating when the climber changes their days moves the reference date too.
grant update (original_date) on public.training_sessions to authenticated;

drop policy training_sessions_insert on public.training_sessions;
create policy training_sessions_insert on public.training_sessions for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and (plan_id is null or exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid()))
    and (calendar_entry_id is null or exists (select 1 from public.calendar_entries c where c.id = calendar_entry_id and c.user_id = auth.uid()))
    and (enrollment_id is null or exists (select 1 from public.mobility_enrollments e where e.id = enrollment_id and e.user_id = auth.uid())));

-- ── Before / during / after ──────────────────────────────────────────────
create table public.mobility_session_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null,
  moment text not null check (moment in ('BEFORE', 'AFTER', 'D1')),
  back_pain smallint check (back_pain is null or back_pain between 0 and 10),
  leg_radiation smallint check (leg_radiation is null or leg_radiation between 0 and 10),
  radiation_spreading boolean not null default false,
  unusual_pain boolean not null default false,
  verdict text check (verdict is null or verdict in ('GO', 'ADAPT', 'STOP', 'EMERGENCY')),
  phase_used smallint check (phase_used is null or phase_used between 1 and 6),
  stop_reason text check (stop_reason is null or stop_reason in ('RADIATION_WORSE', 'PAINFUL_BLOCK', 'BALANCE_UNSAFE', 'UNUSUAL_PAIN', 'NEURO')),
  overall text check (overall is null or overall in ('BETTER', 'SAME', 'WORSE')),
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, moment),
  constraint mobility_session_checks_before check (moment <> 'BEFORE' or verdict is not null),
  constraint mobility_session_checks_d1 check (moment <> 'D1' or overall is not null),
  foreign key (user_id, session_id) references public.training_sessions(user_id, id) on delete cascade
);
create index mobility_session_checks_owner on public.mobility_session_checks (user_id, session_id);
create trigger mobility_session_checks_updated_at before update on public.mobility_session_checks
  for each row execute function public.set_updated_at();

alter table public.mobility_session_checks enable row level security;
revoke all on public.mobility_session_checks from anon, authenticated;
grant select, insert, delete on public.mobility_session_checks to authenticated;
grant update (back_pain, leg_radiation, radiation_spreading, unusual_pain, verdict, phase_used, stop_reason, overall, notes)
  on public.mobility_session_checks to authenticated;
create policy mobility_session_checks_select on public.mobility_session_checks for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_session_checks_insert on public.mobility_session_checks for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_session_checks_update on public.mobility_session_checks for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy mobility_session_checks_delete on public.mobility_session_checks for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

-- ── Coach key: assign the programme to the key's owner ───────────────────
-- p_sessions: [{slot, date, phase, minutes, title, exercises:[training_session_exercises columns]}],
-- built and validated by the app (lib/training/mobility-rebuild). The database checks again
-- what matters: the owner comes from the key only, no date today or earlier, one séance per slot.
create or replace function public.coach_key_assign_rebuild(p_key text, p_days smallint[], p_content jsonb, p_sessions jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_enrollment uuid;
  v_started date;
  v_first date;
  v_session uuid;
  v_count integer;
  v_created integer := 0;
  v_existing integer := 0;
  s jsonb;
begin
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) > 36 then
    raise exception 'invalid_programme' using errcode = '22023';
  end if;
  if p_days is null or array_length(p_days, 1) <> 3 then
    raise exception 'invalid_programme' using errcode = '22023';
  end if;
  select min((x ->> 'date')::date) into v_first from jsonb_array_elements(p_sessions) x;
  if v_first is not null and v_first <= v_today then
    raise exception 'backdated' using errcode = '22023';
  end if;

  select id, started_on into v_enrollment, v_started from public.mobility_enrollments
    where user_id = v_user and programme = 'REBUILD_12W' for update;
  if v_enrollment is null then
    if v_first is null then
      raise exception 'invalid_programme' using errcode = '22023';
    end if;
    insert into public.mobility_enrollments (user_id, programme, started_on, sessions_per_week, schedule_days, content)
    values (v_user, 'REBUILD_12W', v_first, 3, p_days, p_content)
    returning id, started_on into v_enrollment, v_started;
  else
    -- Re-running refreshes the content; days, start and the climber's own entries stay.
    update public.mobility_enrollments set content = p_content where id = v_enrollment;
  end if;

  for s in select * from jsonb_array_elements(p_sessions) loop
    if jsonb_typeof(s -> 'exercises') <> 'array' or jsonb_array_length(s -> 'exercises') not between 1 and 40 then
      raise exception 'invalid_programme' using errcode = '22023';
    end if;
    insert into public.training_sessions (user_id, title, method_id, status, scheduled_date, planned_minutes,
      enrollment_id, programme_slot, programme_phase, original_date)
    values (v_user, s ->> 'title', 'mobility-rebuild', 'PLANNED', (s ->> 'date')::date, (s ->> 'minutes')::integer,
      v_enrollment, (s ->> 'slot')::smallint, (s ->> 'phase')::smallint, (s ->> 'date')::date)
    on conflict (enrollment_id, programme_slot) where enrollment_id is not null do nothing
    returning id into v_session;
    if v_session is null then
      v_existing := v_existing + 1;
      continue;
    end if;
    insert into public.training_session_exercises (user_id, session_id, position, block, method_id, name, instructions,
      modality, target_sets, target_reps, target_seconds, rest_seconds, intensity)
    select v_user, v_session, x.position, x.block, x.method_id, x.name, coalesce(x.instructions, '{}'::jsonb),
      x.modality, x.target_sets, x.target_reps, x.target_seconds, x.rest_seconds, coalesce(x.intensity, '')
    from jsonb_to_recordset(s -> 'exercises') as x(position integer, block text, method_id text, name text, instructions jsonb,
      modality text, target_sets integer, target_reps integer, target_seconds integer, rest_seconds integer, intensity text);
    v_created := v_created + 1;
    v_session := null;
  end loop;

  select count(*) into v_count from public.training_sessions where enrollment_id = v_enrollment;
  return jsonb_build_object('enrollment_id', v_enrollment, 'started_on', v_started,
    'created', v_created, 'existing', v_existing, 'sessions', v_count);
end $$;

create or replace function public.coach_key_rebuild_status(p_key text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
  v_enrollment public.mobility_enrollments;
begin
  select * into v_enrollment from public.mobility_enrollments where user_id = v_user and programme = 'REBUILD_12W';
  if v_enrollment.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'enrollment_id', v_enrollment.id, 'started_on', v_enrollment.started_on, 'days', to_jsonb(v_enrollment.schedule_days),
    'status', v_enrollment.status, 'clinical_review_on', v_enrollment.clinical_review_on,
    'templates', coalesce(jsonb_array_length(v_enrollment.content -> 'templates'), 0),
    'sessions', (select count(*) from public.training_sessions t where t.enrollment_id = v_enrollment.id),
    'slots', (select count(distinct t.programme_slot) from public.training_sessions t where t.enrollment_id = v_enrollment.id),
    'exercises', (select count(*) from public.training_session_exercises e
      join public.training_sessions t on t.id = e.session_id where t.enrollment_id = v_enrollment.id),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select t.status, count(*) n from public.training_sessions t
      where t.enrollment_id = v_enrollment.id group by t.status) q), '{}'::jsonb),
    'first_date', (select min(t.original_date) from public.training_sessions t where t.enrollment_id = v_enrollment.id),
    'last_date', (select max(t.original_date) from public.training_sessions t where t.enrollment_id = v_enrollment.id));
end $$;

revoke all on function public.coach_key_assign_rebuild(text, smallint[], jsonb, jsonb), public.coach_key_rebuild_status(text) from public;
grant execute on function public.coach_key_assign_rebuild(text, smallint[], jsonb, jsonb), public.coach_key_rebuild_status(text) to anon, authenticated;

-- ── Coach key: import a bilan done outside the app (for example the baseline S0) ──
-- p_rows: mobility_battery_results rows built and validated by the app (buildCardRows, the
-- same rules as a card entered in the app). The owner comes from the key only; the date is
-- today or earlier; one bilan per day is imported (re-running returns the existing one);
-- the usual guards (one open bilan, clinical and knee rules, locked once finished) apply.
create or replace function public.coach_key_import_battery(p_key text, p_protocol smallint, p_started_on date,
  p_status text, p_stop_reason text, p_knee_pain boolean, p_conditions jsonb, p_notes text, p_rows jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_session uuid;
  v_count integer;
begin
  if p_started_on is null or p_started_on > v_today then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if p_status not in ('COMPLETED', 'STOPPED') or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) not between 1 and 200 then
    raise exception 'invalid_bilan' using errcode = '22023';
  end if;
  select id into v_session from public.mobility_battery_sessions
    where user_id = v_user and started_on = p_started_on and status <> 'IN_PROGRESS'
    order by created_at limit 1;
  if v_session is not null then
    select count(*) into v_count from public.mobility_battery_results where session_id = v_session;
    return jsonb_build_object('session_id', v_session, 'created', false, 'results', v_count);
  end if;
  if exists (select 1 from public.mobility_battery_sessions where user_id = v_user and status = 'IN_PROGRESS') then
    raise exception 'bilan_open' using errcode = '23505';
  end if;

  insert into public.mobility_battery_sessions (user_id, protocol_version, started_on, conditions, knee_pain_today, notes)
  values (v_user, p_protocol, p_started_on, coalesce(p_conditions, '{}'::jsonb), coalesce(p_knee_pain, false), coalesce(p_notes, ''))
  returning id into v_session;

  insert into public.mobility_battery_results (session_id, user_id, card_id, card_version, side, item, trial, status,
    value, category, unit, not_done_reason, pain_before, pain_after, radiation, details, note)
  select v_session, v_user, x.card_id, x.card_version, x.side, x.item, x.trial, x.status,
    x.value, x.category, x.unit, x.not_done_reason, x.pain_before, x.pain_after, x.radiation,
    coalesce(x.details, '{}'::jsonb), coalesce(x.note, '')
  from jsonb_to_recordset(p_rows) as x(card_id text, card_version smallint, side text, item smallint, trial smallint,
    status text, value numeric, category text, unit text, not_done_reason text, pain_before smallint, pain_after smallint,
    radiation text, details jsonb, note text);
  get diagnostics v_count = row_count;

  update public.mobility_battery_sessions
    set status = p_status, stop_reason = case when p_status = 'STOPPED' then p_stop_reason end, completed_at = now()
    where id = v_session;
  return jsonb_build_object('session_id', v_session, 'created', true, 'results', v_count);
end $$;

revoke all on function public.coach_key_import_battery(text, smallint, date, text, text, boolean, jsonb, text, jsonb) from public;
grant execute on function public.coach_key_import_battery(text, smallint, date, text, text, boolean, jsonb, text, jsonb) to anon, authenticated;

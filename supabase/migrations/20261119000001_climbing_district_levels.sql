-- LEBLOND: Climbing District's numbered bouldering levels (1–12) become the
-- network's current scale; its colours stay valid as its former scale.
--
-- Additive and backward-compatible:
--  * no problem, attempt, project or objective row changes: every boulder keeps
--    the grade AND the scale (problems.native_grade_system) it was logged with.
--    No conversion, and no colour ↔ level table (none is published);
--  * a gym keeps its CURRENT bouldering scale in grading_system (default for new
--    sessions) and lists the scales it used before in former_grading_systems:
--    those stay valid at that gym, for what was logged with them and for a
--    session still logged in them. grading_system_since records the day the
--    current scale started ONLY when a source verifies it (none for Climbing
--    District, so it stays null);
--  * each boulder session records the scale it logs NEW boulders in
--    (sessions.grade_system). Existing sessions get their gym's scale as it is
--    before step 5, so every Climbing District session logged until now stays
--    a colour session — editing it keeps offering the colours.
--
-- Mirrors lib/grading/systems.ts and lib/grading/scales.ts: keep them in sync.

-- ── 1. Grade validity: levels '1' … '12' ──────────────────────────────────────
create or replace function public.is_valid_native_grade(p_system public.grade_system, p_grade text) returns boolean
language sql immutable as $$
  select case p_system
    when 'ARKOSE_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'CLIMBING_DISTRICT_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE','PINK'])
    when 'CLIMBING_DISTRICT_LEVEL' then p_grade = any (array['1','2','3','4','5','6','7','8','9','10','11','12'])
    when 'FONT' then p_grade = any (public.font_grades())
    when 'CUSTOM_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','PINK','PURPLE','BLACK','GREY','BROWN'])
    when 'UNKNOWN' then p_grade = 'UNKNOWN'
    when 'BLOCKOUT_LEVEL' then p_grade = any (array['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14'])
    when 'CLIMB_UP_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','PURPLE','RED','WHITE','BLACK'])
    when 'VERTICAL_ART_COLOR' then p_grade = any (array['WHITE','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE'])
  end
$$;

-- ── 2. A gym's bouldering scales over time ────────────────────────────────────
alter table public.gyms
  add column former_grading_systems public.grade_system[] not null default '{}',
  add column grading_system_since date;
comment on column public.gyms.grading_system is
  'CURRENT bouldering scale of the gym: the default for new boulder sessions.';
comment on column public.gyms.former_grading_systems is
  'Bouldering scales the gym used before (oldest first). Still valid at this gym for what was logged with them; never converted.';
comment on column public.gyms.grading_system_since is
  'Day the current scale started, ONLY when a source verifies it (null otherwise). Before it, new sessions default to the latest former scale.';
alter table public.gyms add constraint gyms_former_not_current
  check (not (grading_system = any (former_grading_systems)));

-- Climbing District venues may grade boulders with their levels or their colours.
alter table public.gyms drop constraint gyms_brand_system;
alter table public.gyms add constraint gyms_brand_system check (
  (brand = 'ARKOSE' and grading_system = 'ARKOSE_COLOR')
  or (brand = 'CLIMBING_DISTRICT' and grading_system in ('CLIMBING_DISTRICT_LEVEL', 'CLIMBING_DISTRICT_COLOR'))
  or (brand = 'BLOCKOUT' and grading_system in ('BLOCKOUT_LEVEL', 'FONT'))
  or (brand = 'CLIMB_UP' and grading_system in ('CLIMB_UP_COLOR', 'FONT'))
  or (brand = 'VERTICAL_ART' and grading_system in ('VERTICAL_ART_COLOR', 'FONT'))
  or (brand not in ('ARKOSE', 'CLIMBING_DISTRICT', 'BLOCKOUT', 'CLIMB_UP', 'VERTICAL_ART')
      and grading_system in ('FONT', 'CUSTOM_COLOR', 'UNKNOWN'))
);

-- Whether a scale is one of the gym's bouldering scales (current or former).
create or replace function public.gym_accepts_grade_system(p_gym_id uuid, p_system public.grade_system) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.gyms g
    where g.id = p_gym_id and (g.grading_system = p_system or p_system = any (g.former_grading_systems))
  )
$$;

-- ── 3. A problem is graded in one of its gym's scales (was: the current one only) ──
create or replace function public.problems_match_gym_system() returns trigger
language plpgsql as $$
begin
  if not public.gym_accepts_grade_system(new.gym_id, new.native_grade_system) then
    raise exception 'Problem grade system % is not a scale of this gym', new.native_grade_system
      using errcode = '23514';
  end if;
  return new;
end $$;

-- ── 4. The scale a boulder session logs new boulders in ───────────────────────
alter table public.sessions add column grade_system public.grade_system;
comment on column public.sessions.grade_system is
  'BOULDER sessions: the scale new boulders are logged in (one of the gym''s scales). Each boulder keeps its own native_grade_system. NULL for ROUTE sessions.';

-- Existing boulder sessions: their gym's scale as it is now (before step 5).
-- updated_at is left as it was: nothing the climber did changed.
alter table public.sessions disable trigger sessions_updated_at;
update public.sessions s set grade_system = g.grading_system
  from public.gyms g
  where g.id = s.gym_id and s.discipline = 'BOULDER' and s.grade_system is null;
alter table public.sessions enable trigger sessions_updated_at;

alter table public.sessions add constraint sessions_grade_system_discipline
  check ((discipline = 'BOULDER') = (grade_system is not null));

-- ── 5. Climbing District bouldering moves to levels 1–12 ──────────────────────
-- Colours become the former scale. No transition date: none is verified.
-- Venues grading routes by colour (none today) keep their colours.
update public.gyms
   set former_grading_systems = array['CLIMBING_DISTRICT_COLOR']::public.grade_system[],
       grading_system = 'CLIMBING_DISTRICT_LEVEL'
 where brand = 'CLIMBING_DISTRICT' and grading_system = 'CLIMBING_DISTRICT_COLOR' and route_grading = 'FRENCH';

-- ── 6. New boulder sessions take their gym's default scale ────────────────────
-- A session may be switched to another of its gym's scales (e.g. completing an
-- old colour session, or walls not re-graded yet); any other scale is refused.
create or replace function public.sessions_grade_system() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_gym public.gyms;
begin
  if new.discipline <> 'BOULDER' then
    new.grade_system := null;
    return new;
  end if;
  select * into v_gym from public.gyms g where g.id = new.gym_id;
  if not found then return new; end if; -- the foreign key reports it
  if new.grade_system is null
     or (tg_op = 'UPDATE' and new.gym_id is distinct from old.gym_id
         and new.grade_system is not distinct from old.grade_system
         and not public.gym_accepts_grade_system(new.gym_id, new.grade_system)) then
    new.grade_system := case
      when v_gym.grading_system_since is not null and cardinality(v_gym.former_grading_systems) > 0
           and new.started_at < (v_gym.grading_system_since::timestamp at time zone 'Europe/Paris')
        then v_gym.former_grading_systems[cardinality(v_gym.former_grading_systems)]
      else v_gym.grading_system
    end;
  elsif not (new.grade_system = v_gym.grading_system or new.grade_system = any (v_gym.former_grading_systems)) then
    raise exception 'GRADE_SYSTEM_NOT_FOR_GYM' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger sessions_grade_system before insert or update of grade_system, gym_id, discipline on public.sessions
  for each row execute function public.sessions_grade_system();

-- ── 7. Batch entry logs in the session's scale (body otherwise unchanged from 20261111000000) ──
create or replace function public.log_boulder_batch(
  p_session_id uuid,
  p_grade text,
  p_count integer,
  p_tries integer,
  p_outcome text,
  p_notes text default null
) returns uuid[]
language plpgsql security invoker set search_path = public as $$
declare
  v_session public.sessions;
  v_system public.grade_system;
  v_ids uuid[] := '{}';
  v_problem uuid;
  v_n integer;
  v_at timestamptz;
  v_result public.attempt_result;
  i integer;
  j integer;
begin
  select * into v_session from public.sessions s where s.id = p_session_id and s.user_id = auth.uid();
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_session.discipline <> 'BOULDER' then raise exception 'NOT_A_BOULDER_SESSION' using errcode = '23514'; end if;
  if p_count is null or p_count < 1 or p_count > 30 then raise exception 'INVALID_COUNT' using errcode = '23514'; end if;
  if p_tries is null or p_tries < 1 or p_tries > 50 then raise exception 'INVALID_TRIES' using errcode = '23514'; end if;
  if p_outcome not in ('FLASH','TOP','ATTEMPT','PROJECT') then raise exception 'INVALID_OUTCOME' using errcode = '23514'; end if;
  if p_outcome = 'FLASH' and p_tries <> 1 then raise exception 'FLASH_NOT_FIRST_ATTEMPT' using errcode = '23514'; end if;
  if p_notes is not null and char_length(p_notes) > 2000 then raise exception 'NOTES_TOO_LONG' using errcode = '23514'; end if;
  select coalesce(v_session.grade_system, g.grading_system) into v_system from public.gyms g where g.id = v_session.gym_id;
  if not public.is_valid_native_grade(v_system, p_grade) then raise exception 'INVALID_GRADE' using errcode = '23514'; end if;

  select count(*) into v_n from public.attempts a where a.session_id = p_session_id;
  for i in 1..p_count loop
    insert into public.problems (gym_id, created_by, native_grade, native_grade_system, notes)
      values (v_session.gym_id, auth.uid(), p_grade, v_system, nullif(btrim(coalesce(p_notes, '')), ''))
      returning id into v_problem;
    v_ids := v_ids || v_problem;
    for j in 1..p_tries loop
      v_n := v_n + 1;
      v_at := case when v_session.ended_at is null then now() + make_interval(secs => v_n * 0.001)
                   else least(v_session.ended_at, v_session.started_at + make_interval(secs => v_n)) end;
      v_result := case when j = p_tries and p_outcome in ('FLASH','TOP') then p_outcome::public.attempt_result
                       else 'ATTEMPT'::public.attempt_result end;
      insert into public.attempts (session_id, problem_id, user_id, attempt_number, result, created_at)
        values (p_session_id, v_problem, auth.uid(), j, v_result, v_at);
    end loop;
    if p_outcome = 'PROJECT' then
      insert into public.projects (user_id, problem_id, status, session_id) values (auth.uid(), v_problem, 'ACTIVE', p_session_id);
    end if;
  end loop;
  return v_ids;
end $$;
revoke execute on function public.log_boulder_batch(uuid, text, integer, integer, text, text) from public, anon;
grant execute on function public.log_boulder_batch(uuid, text, integer, integer, text, text) to authenticated;

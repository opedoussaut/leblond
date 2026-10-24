-- Faster logging: session names, tries per route line, and batch bouldering entry.
-- Additive only.

-- 1. Optional session name ("Sortie avec Thomas", "Projet du jeudi").
alter table public.sessions
  add column title text check (title is null or char_length(btrim(title)) between 1 and 80);

-- 2. A route line can record how many goes it took (default 1). Onsight / flash
--    are first-go results by definition.
alter table public.route_ascents
  add column tries smallint not null default 1 check (tries between 1 and 100),
  add constraint route_ascents_first_go_single_try check (result not in ('ONSIGHT','FLASH') or tries = 1);
grant update (tries) on public.route_ascents to authenticated;

-- 3. Batch entry for bouldering: N problems of one grade, each with T tries and a
--    final outcome, optionally kept as projects, in a single transaction.
--    p_outcome: 'FLASH' (1 try), 'TOP' (T-1 attempts then a top), 'ATTEMPT' (T attempts,
--    not sent) or 'PROJECT' (T attempts, not sent, and a project is opened).
--    Attempts in a finished session are dated inside it (same rule as log_attempt).
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
  select g.grading_system into v_system from public.gyms g where g.id = v_session.gym_id;
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
      insert into public.projects (user_id, problem_id, status) values (auth.uid(), v_problem, 'ACTIVE');
    end if;
  end loop;
  return v_ids;
end $$;
revoke execute on function public.log_boulder_batch(uuid, text, integer, integer, text, text) from public, anon;
grant execute on function public.log_boulder_batch(uuid, text, integer, integer, text, text) to authenticated;

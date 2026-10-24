-- Past sessions, session editing, and native colour grades on route ascents.
-- Additive: one function replaced with the same signature, one new function,
-- two nullable columns. No existing row changes.

-- 1. Attempts logged into a FINISHED session (added afterwards or edited) are
--    dated inside that session, not "now", so analytics windows stay correct.
--    Live sessions behave exactly as before.
create or replace function public.log_attempt(
  p_session_id uuid,
  p_problem_id uuid,
  p_result public.attempt_result
) returns public.attempts
language plpgsql security invoker set search_path = public as $$
declare
  v_next integer;
  v_row public.attempts;
  v_session public.sessions;
  v_in_session integer;
  v_at timestamptz;
begin
  select * into v_session from public.sessions s where s.id = p_session_id and s.user_id = auth.uid();
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_session.discipline <> 'BOULDER' then
    raise exception 'NOT_A_BOULDER_SESSION' using errcode = '23514';
  end if;
  -- Serialise concurrent taps on the same problem.
  perform 1 from public.problems p where p.id = p_problem_id and p.created_by = auth.uid() for update;
  if not found then
    raise exception 'PROBLEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  select coalesce(max(a.attempt_number), 0) + 1 into v_next
    from public.attempts a where a.problem_id = p_problem_id and a.user_id = auth.uid();
  if p_result = 'FLASH' and v_next > 1 then
    raise exception 'FLASH_NOT_FIRST_ATTEMPT' using errcode = '23514';
  end if;
  v_at := now();
  if v_session.ended_at is not null then
    select count(*) into v_in_session from public.attempts a where a.session_id = p_session_id;
    v_at := least(v_session.ended_at, v_session.started_at + make_interval(secs => v_in_session + 1));
  end if;
  insert into public.attempts (session_id, problem_id, user_id, attempt_number, result, created_at)
    values (p_session_id, p_problem_id, auth.uid(), v_next, p_result, v_at)
    returning * into v_row;
  return v_row;
end $$;
revoke execute on function public.log_attempt(uuid, uuid, public.attempt_result) from public, anon;
grant execute on function public.log_attempt(uuid, uuid, public.attempt_result) to authenticated;

-- 2. Move a finished session to another date/time and/or change its duration.
--    Its attempts and route ascents move by the same offset, so they stay inside it.
--    SECURITY DEFINER because clients cannot update created_at; ownership is checked here.
create or replace function public.reschedule_session(
  p_session_id uuid,
  p_started_at timestamptz,
  p_duration_minutes integer
) returns public.sessions
language plpgsql security definer set search_path = public as $$
declare
  v_old public.sessions;
  v_delta interval;
  v_row public.sessions;
begin
  select * into v_old from public.sessions s where s.id = p_session_id and s.user_id = auth.uid() for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old.ended_at is null then
    raise exception 'SESSION_STILL_LIVE' using errcode = '23514';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 1 or p_duration_minutes > 1440 then
    raise exception 'INVALID_DURATION' using errcode = '23514';
  end if;
  if p_started_at > now() or p_started_at < timestamptz '2000-01-01' then
    raise exception 'INVALID_START' using errcode = '23514';
  end if;
  v_delta := p_started_at - v_old.started_at;
  update public.sessions
    set started_at = p_started_at,
        ended_at = p_started_at + make_interval(mins => p_duration_minutes),
        duration_minutes = p_duration_minutes
    where id = p_session_id
    returning * into v_row;
  update public.attempts set created_at = created_at + v_delta where session_id = p_session_id;
  update public.route_ascents set created_at = created_at + v_delta where session_id = p_session_id;
  -- Keep every event inside the (possibly shorter) session.
  update public.attempts set created_at = least(created_at, v_row.ended_at) where session_id = p_session_id;
  update public.route_ascents set created_at = least(created_at, v_row.ended_at) where session_id = p_session_id;
  return v_row;
end $$;
revoke execute on function public.reschedule_session(uuid, timestamptz, integer) from public, anon;
grant execute on function public.reschedule_session(uuid, timestamptz, integer) to authenticated;

-- 3. Routes at colour-graded gyms keep the native colour next to the French
--    grade the climber considers equivalent. Both or neither.
alter table public.route_ascents
  add column native_grade text check (native_grade is null or char_length(native_grade) between 1 and 20),
  add column native_grade_system public.grade_system,
  add constraint route_ascents_native_pair check ((native_grade is null) = (native_grade_system is null));
grant update (native_grade, native_grade_system) on public.route_ascents to authenticated;

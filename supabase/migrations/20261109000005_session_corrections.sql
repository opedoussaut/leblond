-- LEBLOND: correcting a session, and logging a topo boulder in one step.
--
-- 1. remove_problem_from_session(): takes a boulder out of one session, i.e.
--    deletes its tries there. When nothing else is left of the boulder (no
--    tries in any session, not an active project) the boulder is deleted too;
--    otherwise its remaining tries are renumbered from 1, so "first try" (a
--    flash) keeps its meaning.
-- 2. log_problem_tries(): adds N tries ending with an outcome (flash, top, not
--    sent, project) to an existing boulder, in one transaction. Used when a
--    boulder is picked from a topo, live or when filling in a past session.

-- ── 1. Remove a boulder from a session ─────────────────────────────────────
-- SECURITY DEFINER because renumbering updates attempt_number, which climbers
-- cannot update; ownership of the session and the boulder is checked here.
create or replace function public.remove_problem_from_session(p_session_id uuid, p_problem_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_removed integer;
  v_left integer;
  v_deleted boolean := false;
begin
  if v_uid is null or not exists (select 1 from public.sessions s where s.id = p_session_id and s.user_id = v_uid) then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform 1 from public.problems p where p.id = p_problem_id and p.created_by = v_uid for update;
  if not found then
    raise exception 'PROBLEM_NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.attempts a where a.session_id = p_session_id and a.problem_id = p_problem_id and a.user_id = v_uid;
  get diagnostics v_removed = row_count;
  select count(*) into v_left from public.attempts a where a.problem_id = p_problem_id;

  if v_left = 0 and not exists (
    select 1 from public.projects pr where pr.problem_id = p_problem_id and pr.status = 'ACTIVE'
  ) then
    delete from public.problems p where p.id = p_problem_id and p.created_by = v_uid;
    v_deleted := true;
  elsif v_removed > 0 and v_left > 0 then
    -- Two steps, because attempt numbers are unique per climber and boulder:
    -- park the tries far above, then number them 1..n in their original order.
    -- A flash is always try 1 and stays where it is (attempts_flash_is_first).
    update public.attempts a set attempt_number = a.attempt_number + 100000
      where a.problem_id = p_problem_id and a.user_id = v_uid and a.result <> 'FLASH';
    update public.attempts a set attempt_number = r.n
      from (
        select x.id, row_number() over (order by x.attempt_number) as n
        from public.attempts x where x.problem_id = p_problem_id and x.user_id = v_uid
      ) r
      where a.id = r.id and a.attempt_number <> r.n;
  end if;

  return jsonb_build_object('removed', v_removed, 'problem_deleted', v_deleted);
end $$;
revoke execute on function public.remove_problem_from_session(uuid, uuid) from public, anon;
grant execute on function public.remove_problem_from_session(uuid, uuid) to authenticated;

-- ── 2. Several tries on one boulder, in one go ─────────────────────────────
-- Same timing rules as log_boulder_batch: live sessions get the current time,
-- finished ones get times inside the session, in order.
create or replace function public.log_problem_tries(
  p_session_id uuid,
  p_problem_id uuid,
  p_tries integer,
  p_outcome text
) returns setof public.attempts
language plpgsql security invoker set search_path = public as $$
declare
  v_session public.sessions;
  v_last integer;
  v_n integer;
  v_at timestamptz;
  v_result public.attempt_result;
  v_row public.attempts;
  j integer;
begin
  select * into v_session from public.sessions s where s.id = p_session_id and s.user_id = auth.uid();
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_session.discipline <> 'BOULDER' then raise exception 'NOT_A_BOULDER_SESSION' using errcode = '23514'; end if;
  if p_tries is null or p_tries < 1 or p_tries > 50 then raise exception 'INVALID_TRIES' using errcode = '23514'; end if;
  if p_outcome is null or p_outcome not in ('FLASH','TOP','ATTEMPT','PROJECT') then
    raise exception 'INVALID_OUTCOME' using errcode = '23514';
  end if;
  -- Serialise with live taps on the same boulder.
  perform 1 from public.problems p where p.id = p_problem_id and p.created_by = auth.uid() for update;
  if not found then raise exception 'PROBLEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.problems p where p.id = p_problem_id and p.gym_id = v_session.gym_id) then
    raise exception 'WRONG_SITE' using errcode = '23514';
  end if;

  select coalesce(max(a.attempt_number), 0) into v_last
    from public.attempts a where a.problem_id = p_problem_id and a.user_id = auth.uid();
  if p_outcome = 'FLASH' and (p_tries <> 1 or v_last > 0) then
    raise exception 'FLASH_NOT_FIRST_ATTEMPT' using errcode = '23514';
  end if;

  select count(*) into v_n from public.attempts a where a.session_id = p_session_id;
  for j in 1..p_tries loop
    v_n := v_n + 1;
    v_at := case when v_session.ended_at is null then now() + make_interval(secs => j * 0.001)
                 else least(v_session.ended_at, v_session.started_at + make_interval(secs => v_n)) end;
    v_result := case when j = p_tries and p_outcome in ('FLASH','TOP') then p_outcome::public.attempt_result
                     else 'ATTEMPT'::public.attempt_result end;
    insert into public.attempts (session_id, problem_id, user_id, attempt_number, result, created_at)
      values (p_session_id, p_problem_id, auth.uid(), v_last + j, v_result, v_at)
      returning * into v_row;
    return next v_row;
  end loop;
  if p_outcome = 'PROJECT' then
    insert into public.projects (user_id, problem_id, status) values (auth.uid(), p_problem_id, 'ACTIVE')
      on conflict (user_id, problem_id) do nothing;
  end if;
end $$;
revoke execute on function public.log_problem_tries(uuid, uuid, integer, text) from public, anon;
grant execute on function public.log_problem_tries(uuid, uuid, integer, text) to authenticated;

-- Taking boulders out of a session, one or several at once.
--
-- 1. remove_problem_from_session(): a project opened in this session goes with
--    the boulder when no try is left anywhere (it was logged by mistake). A
--    project opened in another session, or one with tries elsewhere, stays.
-- 2. remove_problems_from_session(): the same for a list of boulders, in one
--    transaction (all or nothing).

create or replace function public.remove_problem_from_session(p_session_id uuid, p_problem_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_removed integer;
  v_left integer;
  v_projects integer := 0;
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

  if v_left = 0 then
    -- Nothing tried anywhere any more: a project opened in this very session goes too.
    delete from public.projects pr
      where pr.problem_id = p_problem_id and pr.user_id = v_uid and pr.session_id = p_session_id;
    get diagnostics v_projects = row_count;
  end if;

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

  return jsonb_build_object('removed', v_removed, 'problem_deleted', v_deleted, 'project_deleted', v_projects > 0);
end $$;
revoke execute on function public.remove_problem_from_session(uuid, uuid) from public, anon;
grant execute on function public.remove_problem_from_session(uuid, uuid) to authenticated;

create or replace function public.remove_problems_from_session(p_session_id uuid, p_problem_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_one jsonb;
  v_removed integer := 0;
  v_problems uuid[] := '{}';
  v_projects uuid[] := '{}';
begin
  if p_problem_ids is null or cardinality(p_problem_ids) = 0 or cardinality(p_problem_ids) > 200 then
    raise exception 'INVALID_LIST' using errcode = '22023';
  end if;
  foreach v_id in array (select array_agg(distinct x) from unnest(p_problem_ids) x) loop
    v_one := public.remove_problem_from_session(p_session_id, v_id);
    v_removed := v_removed + (v_one ->> 'removed')::integer;
    if (v_one ->> 'problem_deleted')::boolean then v_problems := v_problems || v_id; end if;
    if (v_one ->> 'project_deleted')::boolean then v_projects := v_projects || v_id; end if;
  end loop;
  return jsonb_build_object('removed', v_removed, 'problems_deleted', to_jsonb(v_problems), 'projects_deleted', to_jsonb(v_projects));
end $$;
revoke execute on function public.remove_problems_from_session(uuid, uuid[]) from public, anon;
grant execute on function public.remove_problems_from_session(uuid, uuid[]) to authenticated;

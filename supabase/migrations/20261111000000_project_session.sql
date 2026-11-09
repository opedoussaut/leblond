-- LEBLOND: a boulder project remembers the session it was opened in, so the
-- session shows "project opened here" and the project links back to it, even
-- before any try. Additive: a nullable column, filled in for existing projects
-- from the session of their first try.

alter table public.projects add column session_id uuid references public.sessions (id) on delete set null;
create index projects_session on public.projects (session_id) where session_id is not null;

-- Only one of the climber's own sessions (RLS on projects checks user_id only).
create or replace function public.projects_session_owned() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.session_id is not null
     and not exists (select 1 from public.sessions s where s.id = new.session_id and s.user_id = new.user_id) then
    raise exception 'SESSION_NOT_FOUND' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger projects_session_owned before insert or update of session_id on public.projects
  for each row execute function public.projects_session_owned();

update public.projects pr set session_id = f.session_id
from (
  select distinct on (a.user_id, a.problem_id) a.user_id, a.problem_id, a.session_id
  from public.attempts a order by a.user_id, a.problem_id, a.created_at, a.attempt_number
) f
where pr.session_id is null and f.user_id = pr.user_id and f.problem_id = pr.problem_id;

-- The two functions that open projects now record the session (bodies otherwise unchanged).
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
      insert into public.projects (user_id, problem_id, status, session_id) values (auth.uid(), v_problem, 'ACTIVE', p_session_id);
    end if;
  end loop;
  return v_ids;
end $$;
revoke execute on function public.log_boulder_batch(uuid, text, integer, integer, text, text) from public, anon;
grant execute on function public.log_boulder_batch(uuid, text, integer, integer, text, text) to authenticated;

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
    insert into public.projects (user_id, problem_id, status, session_id) values (auth.uid(), p_problem_id, 'ACTIVE', p_session_id)
      on conflict (user_id, problem_id) do nothing;
  end if;
end $$;
revoke execute on function public.log_problem_tries(uuid, uuid, integer, text) from public, anon;
grant execute on function public.log_problem_tries(uuid, uuid, integer, text) to authenticated;

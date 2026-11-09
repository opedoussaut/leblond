-- LEBLOND: the watch's times win. Linking a watch activity to a finished
-- session now takes the activity's start time and duration straight away:
-- no choice to make, no side-by-side comparison. Sessions already linked with
-- typed times switch to the watch's. A later edit of the times is still
-- possible and marks them manual, as before (sessions_timing_source_guard).

-- ── 1. The timing copy for one climber's session (internal) ─────────────────
-- Same body as apply_activity_timing (20261108000000_fit_timing.sql), with the
-- owner passed in so this migration can run it for every climber.
create or replace function public.apply_activity_timing_as(p_session_id uuid, p_user_id uuid)
returns public.sessions
language plpgsql security definer set search_path = public as $$
declare
  v_session public.sessions;
  v_activity public.wearable_activities;
  v_start timestamptz;
  v_end timestamptz;
  v_minutes integer;
  v_delta interval;
  v_outside boolean;
  v_row public.sessions;
begin
  select * into v_session from public.sessions s where s.id = p_session_id and s.user_id = p_user_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_session.ended_at is null then
    raise exception 'SESSION_STILL_LIVE' using errcode = '23514';
  end if;
  select * into v_activity from public.wearable_activities a
    where a.id = v_session.wearable_activity_id and a.user_id = p_user_id;
  if not found then
    raise exception 'NO_ACTIVITY' using errcode = 'P0002';
  end if;
  v_minutes := round(v_activity.duration_seconds / 60.0);
  if v_minutes < 1 or v_minutes > 1440 then
    raise exception 'NO_TIMING' using errcode = '23514';
  end if;
  v_start := v_activity.started_at;
  v_end := v_start + make_interval(secs => v_activity.duration_seconds);
  if v_start > now() or v_start < timestamptz '2000-01-01' then
    raise exception 'INVALID_START' using errcode = '23514';
  end if;

  v_delta := v_start - v_session.started_at;
  select exists (select 1 from public.attempts where session_id = p_session_id and (created_at < v_start or created_at > v_end))
      or exists (select 1 from public.route_ascents where session_id = p_session_id and (created_at < v_start or created_at > v_end))
    into v_outside;

  update public.sessions set timing_source = 'MANUAL' where id = p_session_id and timing_source = 'ACTIVITY';
  update public.sessions
    set started_at = v_start, ended_at = v_end, duration_minutes = v_minutes, timing_source = 'ACTIVITY'
    where id = p_session_id
    returning * into v_row;
  if v_outside then
    update public.attempts set created_at = least(greatest(created_at + v_delta, v_start), v_end)
      where session_id = p_session_id;
    update public.route_ascents set created_at = least(greatest(created_at + v_delta, v_start), v_end)
      where session_id = p_session_id;
  end if;
  return v_row;
end $$;
revoke all on function public.apply_activity_timing_as(uuid, uuid) from public, anon, authenticated;

-- ── 2. The climber's entry point: their own session only ───────────────────
create or replace function public.apply_activity_timing(p_session_id uuid)
returns public.sessions
language plpgsql security definer set search_path = public as $$
begin
  return public.apply_activity_timing_as(p_session_id, auth.uid());
end $$;
revoke execute on function public.apply_activity_timing(uuid) from public, anon;
grant execute on function public.apply_activity_timing(uuid) to authenticated;

-- ── 3. Linking takes the watch's times when they are usable ────────────────
create or replace function public.link_wearable_activity(p_activity_id uuid, p_session_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_previous uuid;
begin
  select session_id into v_previous from public.wearable_activities
    where id = p_activity_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.sessions where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_previous is not distinct from p_session_id then
    return; -- already linked there
  end if;
  -- The session this activity leaves keeps its times, now as manual ones.
  update public.sessions set wearable_activity_id = null, timing_source = 'MANUAL'
    where id = v_previous and wearable_activity_id = p_activity_id;
  if p_session_id is not null then
    -- One activity per session: detach whatever was linked before.
    update public.wearable_activities set session_id = null
      where session_id = p_session_id and id <> p_activity_id and user_id = auth.uid();
    update public.sessions set wearable_activity_id = p_activity_id, timing_source = 'MANUAL'
      where id = p_session_id;
  end if;
  update public.wearable_activities set session_id = p_session_id where id = p_activity_id;
  if p_session_id is not null then
    begin
      perform public.apply_activity_timing(p_session_id);
    exception when sqlstate '23514' then
      null; -- live session, unusable duration or a start in the future: the typed times stay
    end;
  end if;
end $$;

-- ── 4. Sessions already linked with typed times take the watch's ───────────
do $$
declare
  r record;
begin
  for r in
    select s.id, s.user_id from public.sessions s
    where s.wearable_activity_id is not null and s.timing_source = 'MANUAL' and s.ended_at is not null
  loop
    begin
      perform public.apply_activity_timing_as(r.id, r.user_id);
    exception when sqlstate '23514' or sqlstate 'P0002' then
      null; -- no usable watch timing: keep the typed times
    end;
  end loop;
end $$;

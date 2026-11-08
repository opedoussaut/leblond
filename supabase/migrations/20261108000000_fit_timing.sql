-- FIT / wearable timing for climbing sessions.
--  1. sessions.timing_source says where the start time and duration come from:
--     typed by the climber (MANUAL) or taken from the linked watch activity (ACTIVITY).
--  2. One activity per session: linking a new activity detaches the previous one.
--  3. apply_activity_timing() copies the linked activity's start and duration
--     onto a finished session, keeping its attempts and route ascents inside it.
--  4. reschedule_session() is a no-op when nothing changed at minute precision,
--     so saving the title does not erase the watch's exact start time.

create type public.session_timing_source as enum ('MANUAL', 'ACTIVITY');
alter table public.sessions
  add column timing_source public.session_timing_source not null default 'MANUAL';

-- Any change to the times that does not explicitly come from the activity makes them manual.
create or replace function public.sessions_timing_source_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.started_at, new.ended_at, new.duration_minutes) is distinct from (old.started_at, old.ended_at, old.duration_minutes)
     and new.timing_source = 'ACTIVITY' and old.timing_source = 'ACTIVITY' then
    new.timing_source := 'MANUAL';
  end if;
  return new;
end $$;
create trigger sessions_timing_source_guard before update on public.sessions
  for each row execute function public.sessions_timing_source_guard();

-- Links (or unlinks, with p_session_id null) a wearable activity and a session.
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
end $$;

-- Copies the linked activity's start time and duration onto a finished session.
-- Attempts and route ascents already inside the new window keep their real
-- timestamps (sessions logged live); otherwise they move by the start offset
-- (sessions entered afterwards) and are clamped inside the window.
-- SECURITY DEFINER because clients cannot update created_at; ownership is checked here.
create or replace function public.apply_activity_timing(p_session_id uuid)
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
  select * into v_session from public.sessions s where s.id = p_session_id and s.user_id = auth.uid() for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_session.ended_at is null then
    raise exception 'SESSION_STILL_LIVE' using errcode = '23514';
  end if;
  select * into v_activity from public.wearable_activities a
    where a.id = v_session.wearable_activity_id and a.user_id = auth.uid();
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
revoke execute on function public.apply_activity_timing(uuid) from public, anon;
grant execute on function public.apply_activity_timing(uuid) to authenticated;

-- Same as before, plus: nothing to do when the start (to the minute) and the
-- duration are unchanged, so the exact watch time survives an unrelated save.
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
  if date_trunc('minute', p_started_at) = date_trunc('minute', v_old.started_at)
     and p_duration_minutes = v_old.duration_minutes then
    return v_old;
  end if;
  v_delta := p_started_at - v_old.started_at;
  update public.sessions
    set started_at = p_started_at,
        ended_at = p_started_at + make_interval(mins => p_duration_minutes),
        duration_minutes = p_duration_minutes,
        timing_source = 'MANUAL'
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

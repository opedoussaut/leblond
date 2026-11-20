-- One-step FIT import: a watch activity can be filed as a training séance too.
--
-- Climbing séances already hold their watch activity (sessions.wearable_activity_id
-- <-> wearable_activities.session_id). Training séances had no link at all, so an
-- imported strength, mobility or cardio file could not keep its file or heart rate.
--
-- Additive only: a nullable column, an index, a check and a link function.
-- Existing rows keep training_session_id = null.

-- ── 1. The link ─────────────────────────────────────────────────────────────
alter table public.wearable_activities
  add column training_session_id uuid references public.training_sessions (id) on delete set null;

-- At most one watch activity per training séance (also serves the séance page's lookup).
create unique index wearable_activities_one_per_training_session
  on public.wearable_activities (training_session_id) where training_session_id is not null;

-- An activity is filed as climbing or as training, never both.
alter table public.wearable_activities
  add constraint wearable_activities_one_target check (session_id is null or training_session_id is null);

-- ── 2. RLS: a climber can only point an activity at their own training séance ──
drop policy wearable_activities_all on public.wearable_activities;
create policy wearable_activities_all on public.wearable_activities for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (training_session_id is null or exists (
      select 1 from public.training_sessions t where t.id = training_session_id and t.user_id = auth.uid()))
  );

-- ── 3. Linking to a climbing séance takes the activity off any training séance ──
-- Same as 20261109000004_watch_timing_wins.sql, plus training_session_id cleared
-- when the activity moves to a climbing séance.
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
  update public.wearable_activities
    set session_id = p_session_id,
        training_session_id = case when p_session_id is null then training_session_id else null end
    where id = p_activity_id;
  if p_session_id is not null then
    begin
      perform public.apply_activity_timing(p_session_id);
    exception when sqlstate '23514' then
      null; -- live session, unusable duration or a start in the future: the typed times stay
    end;
  end if;
end $$;

-- ── 4. Linking to a training séance ─────────────────────────────────────────
-- Files (or, with p_training_session_id null, unfiles) an activity as a training
-- séance. It leaves any climbing séance it was on (that séance keeps its times,
-- as manual ones), and replaces the training séance's previous activity.
create or replace function public.link_training_activity(p_activity_id uuid, p_training_session_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_climbing uuid;
begin
  select session_id into v_climbing from public.wearable_activities
    where id = p_activity_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_training_session_id is null then
    update public.wearable_activities set training_session_id = null where id = p_activity_id;
    return;
  end if;
  if not exists (
    select 1 from public.training_sessions where id = p_training_session_id and user_id = auth.uid()
  ) then
    raise exception 'TRAINING_SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.sessions set wearable_activity_id = null, timing_source = 'MANUAL'
    where id = v_climbing and wearable_activity_id = p_activity_id;
  update public.wearable_activities set training_session_id = null
    where training_session_id = p_training_session_id and id <> p_activity_id and user_id = auth.uid();
  update public.wearable_activities set session_id = null, training_session_id = p_training_session_id
    where id = p_activity_id;
end $$;

revoke all on function public.link_training_activity(uuid, uuid) from public, anon;
grant execute on function public.link_training_activity(uuid, uuid) to authenticated;

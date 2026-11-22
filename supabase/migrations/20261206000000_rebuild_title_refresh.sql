-- Re-assigning Mobility Rebuild | 12 Weeks also refreshes the title of the séances not started
-- yet (status PLANNED, no set recorded), so a renamed séance in the content reaches the séances
-- already created. Dates, status, exercises and the climber's entries are never touched.
-- Same signature and grants as in 20261205000000_mobility_rebuild.sql.

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
  v_inserted boolean;
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
    on conflict (enrollment_id, programme_slot) where enrollment_id is not null do update
      -- An existing séance keeps its date, status and entries; only the title of one not started yet follows the content.
      set title = excluded.title
      where public.training_sessions.status = 'PLANNED'
        and not exists (select 1 from public.training_exercise_sets x
          join public.training_session_exercises e on e.id = x.exercise_id
          where e.session_id = public.training_sessions.id)
    returning id, (xmax = 0) into v_session, v_inserted;
    if v_session is null or not v_inserted then
      v_existing := v_existing + 1;
      v_session := null;
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

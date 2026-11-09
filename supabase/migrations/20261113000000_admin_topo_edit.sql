-- Team topos (source 'LEBLOND'): the admin corrects, adds or deletes one boulder
-- at a time, between imports. Boolder rows are never touched (they come from
-- Boolder's open data and are replaced by its import).
--
-- The key (`source_key`) follows the import's rule — colour:number on a circuit,
-- hc:<searchable name> off-circuit — and is computed by the app, so a later
-- re-import still recognises the boulder and climbers' logs stay linked.

-- The site's team-topo area, or an error.
create or replace function public.leblond_area_of(p_gym_id uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare v_area integer;
begin
  select a.id into v_area from public.outdoor_areas a where a.gym_id = p_gym_id and a.source = 'LEBLOND';
  if v_area is null then
    raise exception 'NO_TEAM_TOPO' using errcode = '22023';
  end if;
  return v_area;
end $$;
revoke all on function public.leblond_area_of(uuid) from public, anon, authenticated;

-- Count and bounding box follow the boulders.
create or replace function public.leblond_area_refresh(p_area integer) returns void
language sql volatile security definer set search_path = '' as $$
  update public.outdoor_areas a set
    problems_count = s.n,
    south_west_lat = coalesce(s.min_lat, a.south_west_lat), south_west_lon = coalesce(s.min_lon, a.south_west_lon),
    north_east_lat = coalesce(s.max_lat, a.north_east_lat), north_east_lon = coalesce(s.max_lon, a.north_east_lon),
    updated_at = now()
  from (
    select count(*)::integer as n, min(latitude) as min_lat, min(longitude) as min_lon, max(latitude) as max_lat, max(longitude) as max_lon
    from public.outdoor_problems where area_id = p_area and source = 'LEBLOND'
  ) s
  where a.id = p_area;
$$;
revoke all on function public.leblond_area_refresh(integer) from public, anon, authenticated;

-- p_problem = { key, name, name_searchable, grade, circuit_color?, circuit_number?,
--               steepness?, sit_start?, latitude?, longitude? }
-- p_id null adds a boulder; otherwise updates that boulder of the site. Returns its id.
create or replace function public.admin_save_topo_problem(p_gym_id uuid, p_id integer, p_problem jsonb) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_area integer;
  v_id integer;
  v_color text := nullif(p_problem ->> 'circuit_color', '');
  v_circuit integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_area := public.leblond_area_of(p_gym_id);
  if jsonb_typeof(p_problem) is distinct from 'object' or coalesce(p_problem ->> 'key', '') = '' then
    raise exception 'INVALID_PROBLEM' using errcode = '22023';
  end if;

  if v_color is not null then
    select c.id into v_circuit from public.outdoor_circuits c
      where c.source = 'LEBLOND' and c.area_id = v_area and c.source_key = v_color;
    if v_circuit is null then
      insert into public.outdoor_circuits (id, source, area_id, source_key, color, average_grade, updated_at)
      values (nextval('public.outdoor_leblond_id_seq'), 'LEBLOND', v_area, v_color, v_color, p_problem ->> 'grade', now())
      returning id into v_circuit;
    end if;
  end if;

  if p_id is null then
    insert into public.outdoor_problems (id, source, source_key, area_id, name, name_searchable, grade,
      circuit_id, circuit_number, circuit_color, steepness, sit_start, latitude, longitude, updated_at)
    values (nextval('public.outdoor_leblond_id_seq'), 'LEBLOND', p_problem ->> 'key', v_area,
      p_problem ->> 'name', coalesce(p_problem ->> 'name_searchable', ''), p_problem ->> 'grade',
      v_circuit, case when v_color is null then null else nullif(p_problem ->> 'circuit_number', '') end, v_color,
      coalesce(p_problem ->> 'steepness', ''), coalesce((p_problem ->> 'sit_start')::boolean, false),
      (p_problem ->> 'latitude')::double precision, (p_problem ->> 'longitude')::double precision, now())
    returning id into v_id;
  else
    update public.outdoor_problems op set
      source_key = p_problem ->> 'key',
      name = p_problem ->> 'name',
      name_searchable = coalesce(p_problem ->> 'name_searchable', ''),
      grade = p_problem ->> 'grade',
      circuit_id = v_circuit,
      circuit_number = case when v_color is null then null else nullif(p_problem ->> 'circuit_number', '') end,
      circuit_color = v_color,
      steepness = coalesce(p_problem ->> 'steepness', ''),
      sit_start = coalesce((p_problem ->> 'sit_start')::boolean, false),
      latitude = (p_problem ->> 'latitude')::double precision,
      longitude = (p_problem ->> 'longitude')::double precision,
      updated_at = now()
    where op.id = p_id and op.area_id = v_area and op.source = 'LEBLOND'
    returning op.id into v_id;
    if v_id is null then
      raise exception 'PROBLEM_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  perform public.leblond_area_refresh(v_area);
  return v_id;
end $$;
revoke all on function public.admin_save_topo_problem(uuid, integer, jsonb) from public, anon;
grant execute on function public.admin_save_topo_problem(uuid, integer, jsonb) to authenticated;

-- Deletes one boulder of the site. Climbers' logged boulders keep their tries;
-- only their link to the topo is cleared (on delete set null). Returns how many.
create or replace function public.admin_delete_topo_problem(p_gym_id uuid, p_id integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_area integer;
  v_unlinked integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_area := public.leblond_area_of(p_gym_id);
  select count(*) into v_unlinked from public.problems p where p.outdoor_problem_id = p_id;
  delete from public.outdoor_problems op where op.id = p_id and op.area_id = v_area and op.source = 'LEBLOND';
  if not found then
    raise exception 'PROBLEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.leblond_area_refresh(v_area);
  return jsonb_build_object('unlinked', v_unlinked);
end $$;
revoke all on function public.admin_delete_topo_problem(uuid, integer) from public, anon;
grant execute on function public.admin_delete_topo_problem(uuid, integer) to authenticated;

-- How many climbers' logged boulders point at each boulder of the site (counts only).
create or replace function public.admin_topo_link_counts(p_gym_id uuid)
returns table (outdoor_problem_id integer, logged integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select p.outdoor_problem_id, count(*)::integer
    from public.problems p
    join public.outdoor_problems op on op.id = p.outdoor_problem_id
    where op.area_id = public.leblond_area_of(p_gym_id) and op.source = 'LEBLOND'
    group by p.outdoor_problem_id;
end $$;
revoke all on function public.admin_topo_link_counts(uuid) from public, anon;
grant execute on function public.admin_topo_link_counts(uuid) to authenticated;

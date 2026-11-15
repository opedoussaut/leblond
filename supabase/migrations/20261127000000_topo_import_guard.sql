-- LEBLOND: a team topo cannot be replaced by the topo of another place, and
-- climbers' boulders find their topo boulder again after a bad import.
--
-- What happened (15 Nov): the map of another crag was imported into a site
-- that already had its topo. The import replaced everything: boulders whose
-- key (circuit colour + number) existed in both topos were overwritten, the
-- others were deleted, and the climbers' boulders pointing at them lost their
-- link (on delete set null). Importing the right file again brought the
-- boulders back under new ids, but the links stayed cleared.
--
-- 1. admin_import_leblond_topo() refuses a topo whose boulders stand more
--    than 3 km from the site's current ones (TOPO_ELSEWHERE). A crag is a few
--    hundred metres wide; another crag is kilometres away.
-- 2. After every import, a climber's boulder of the site that has no topo
--    link is linked again when exactly one boulder of the topo has its name
--    and grade. Nothing else about the climber's boulder changes.
-- 3. The same re-linking runs once now, for the links already cleared.

-- ── Re-link (never callable from the API) ──────────────────────────────────
create or replace function public.leblond_relink_problems(p_gym_id uuid, p_area integer) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_relinked integer;
begin
  with candidates as (
    -- One topo boulder with this name and grade, and only one.
    select p.id as problem_id, p.created_by, min(op.id) as topo_id
    from public.problems p
    join public.outdoor_problems op on op.source = 'LEBLOND' and op.area_id = p_area
      and lower(left(op.name, 120)) = lower(p.name) and op.grade = p.native_grade
    where p.gym_id = p_gym_id and p.outdoor_problem_id is null and p.native_grade_system = 'FONT' and p.name is not null
    group by p.id, p.created_by
    having count(*) = 1
  ), free as (
    -- One boulder per climber and topo boulder (problems_outdoor_owner_key): skip when it is taken or disputed.
    select c.problem_id, c.topo_id from candidates c
    where not exists (select 1 from public.problems q where q.created_by = c.created_by and q.outdoor_problem_id = c.topo_id)
      and not exists (select 1 from candidates d where d.created_by = c.created_by and d.topo_id = c.topo_id and d.problem_id <> c.problem_id)
  )
  update public.problems p set outdoor_problem_id = f.topo_id from free f where p.id = f.problem_id;
  get diagnostics v_relinked = row_count;
  return v_relinked;
end $$;
revoke all on function public.leblond_relink_problems(uuid, integer) from public, anon, authenticated;

-- ── Import (as 20261109000003, plus the two protections) ───────────────────
create or replace function public.admin_import_leblond_topo(p_gym_id uuid, p_topo jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_gym record;
  v_area_id integer;
  v_area_source text;
  v_now timestamptz := now();
  v_total integer;
  v_updated integer;
  v_removed integer;
  v_unlinked integer;
  v_circuits integer;
  v_relinked integer;
  v_old_lat double precision;
  v_old_lon double precision;
  v_new_lat double precision;
  v_new_lon double precision;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select id, name, brand::text as brand, external_provider into v_gym from public.gyms where id = p_gym_id;
  if not found or v_gym.brand <> 'OUTDOOR' or v_gym.external_provider is not distinct from 'BOOLDER' then
    raise exception 'NOT_A_TEAM_SITE' using errcode = '22023';
  end if;
  select id, source into v_area_id, v_area_source from public.outdoor_areas where gym_id = p_gym_id;
  if v_area_id is not null and v_area_source <> 'LEBLOND' then
    raise exception 'NOT_A_TEAM_SITE' using errcode = '22023';
  end if;

  if jsonb_typeof(p_topo) is distinct from 'object'
     or jsonb_typeof(p_topo -> 'problems') is distinct from 'array'
     or jsonb_typeof(coalesce(p_topo -> 'circuits', '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_TOPO' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_topo -> 'problems');
  if v_total = 0 or v_total > 5000
     or exists (select 1 from jsonb_to_recordset(p_topo -> 'problems') as r(key text) where r.key is null or r.key = '')
     or (select count(distinct r.key) from jsonb_to_recordset(p_topo -> 'problems') as r(key text)) <> v_total
     or exists (
       select 1 from jsonb_to_recordset(coalesce(p_topo -> 'circuits', '[]'::jsonb)) as r(color text)
       group by r.color having r.color is null or count(*) > 1) then
    raise exception 'INVALID_TOPO' using errcode = '22023';
  end if;

  -- The topo of another place: its boulders stand kilometres from the site's current ones.
  select avg(op.latitude), avg(op.longitude) into v_old_lat, v_old_lon
  from public.outdoor_problems op
  where op.source = 'LEBLOND' and op.area_id = v_area_id and op.latitude is not null;
  select avg(r.latitude), avg(r.longitude) into v_new_lat, v_new_lon
  from jsonb_to_recordset(p_topo -> 'problems') as r(latitude double precision, longitude double precision)
  where r.latitude is not null and r.longitude is not null;
  if v_old_lat is not null and v_new_lat is not null
     and 111.195 * sqrt(power(v_new_lat - v_old_lat, 2)
                        + power(cos(radians((v_new_lat + v_old_lat) / 2)) * (v_new_lon - v_old_lon), 2)) > 3 then
    raise exception 'TOPO_ELSEWHERE' using errcode = '22023';
  end if;

  -- The site's area: one per gym, created on the first import.
  if v_area_id is null then
    v_area_id := nextval('public.outdoor_leblond_id_seq');
  end if;
  insert into public.outdoor_areas as a (id, gym_id, source, name, name_searchable, credit,
    south_west_lat, south_west_lon, north_east_lat, north_east_lon, problems_count, updated_at)
  select v_area_id, p_gym_id, 'LEBLOND', left(v_gym.name, 120), lower(left(v_gym.name, 120)),
    nullif(left(trim(p_topo ->> 'credit'), 200), ''),
    min(r.latitude), min(r.longitude), max(r.latitude), max(r.longitude), count(*), v_now
  from jsonb_to_recordset(p_topo -> 'problems') as r(latitude double precision, longitude double precision)
  on conflict (id) do update set
    name = excluded.name, name_searchable = excluded.name_searchable, credit = excluded.credit,
    south_west_lat = excluded.south_west_lat, south_west_lon = excluded.south_west_lon,
    north_east_lat = excluded.north_east_lat, north_east_lon = excluded.north_east_lon,
    problems_count = excluded.problems_count, updated_at = excluded.updated_at;

  -- What the climbers lose: boulders that leave the topo, and their logged problems.
  select count(*) into v_updated
  from jsonb_to_recordset(p_topo -> 'problems') as r(key text)
  join public.outdoor_problems op on op.source = 'LEBLOND' and op.area_id = v_area_id and op.source_key = r.key;
  select count(*) into v_unlinked
  from public.problems p
  join public.outdoor_problems op on op.id = p.outdoor_problem_id
  where op.source = 'LEBLOND' and op.area_id = v_area_id
    and not exists (select 1 from jsonb_to_recordset(p_topo -> 'problems') as r(key text) where r.key = op.source_key);

  delete from public.outdoor_problems op
  where op.source = 'LEBLOND' and op.area_id = v_area_id
    and not exists (select 1 from jsonb_to_recordset(p_topo -> 'problems') as r(key text) where r.key = op.source_key);
  get diagnostics v_removed = row_count;
  delete from public.outdoor_circuits c
  where c.source = 'LEBLOND' and c.area_id = v_area_id
    and not exists (
      select 1 from jsonb_to_recordset(coalesce(p_topo -> 'circuits', '[]'::jsonb)) as r(color text) where r.color = c.source_key);

  -- Circuits (one per colour), then boulders; existing rows keep their id.
  insert into public.outdoor_circuits as c (id, source, area_id, source_key, color, average_grade, updated_at)
  select coalesce(old.id, nextval('public.outdoor_leblond_id_seq')::integer), 'LEBLOND', v_area_id, r.color, r.color, r.average_grade, v_now
  from jsonb_to_recordset(coalesce(p_topo -> 'circuits', '[]'::jsonb)) as r(color text, average_grade text)
  left join public.outdoor_circuits old on old.source = 'LEBLOND' and old.area_id = v_area_id and old.source_key = r.color
  on conflict (id) do update set color = excluded.color, average_grade = excluded.average_grade, updated_at = excluded.updated_at;
  get diagnostics v_circuits = row_count;

  insert into public.outdoor_problems as p (id, source, source_key, area_id, name, name_searchable, grade,
    circuit_id, circuit_number, circuit_color, steepness, latitude, longitude, updated_at)
  select coalesce(old.id, nextval('public.outdoor_leblond_id_seq')::integer), 'LEBLOND', r.key, v_area_id,
    r.name, coalesce(r.name_searchable, ''), r.grade, c.id, r.circuit_number, r.circuit_color, '', r.latitude, r.longitude, v_now
  from jsonb_to_recordset(p_topo -> 'problems') as r(key text, name text, name_searchable text, grade text,
    circuit_color text, circuit_number text, latitude double precision, longitude double precision)
  left join public.outdoor_problems old on old.source = 'LEBLOND' and old.area_id = v_area_id and old.source_key = r.key
  left join public.outdoor_circuits c on c.source = 'LEBLOND' and c.area_id = v_area_id and c.source_key = r.circuit_color
  on conflict (id) do update set
    name = excluded.name, name_searchable = excluded.name_searchable, grade = excluded.grade,
    circuit_id = excluded.circuit_id, circuit_number = excluded.circuit_number, circuit_color = excluded.circuit_color,
    latitude = excluded.latitude, longitude = excluded.longitude, updated_at = excluded.updated_at;

  v_relinked := public.leblond_relink_problems(p_gym_id, v_area_id);

  insert into public.outdoor_data_imports (source, areas, circuits, problems, skipped)
  values ('LEBLOND', 1, v_circuits, v_total, greatest(coalesce((p_topo ->> 'skipped')::integer, 0), 0));

  return jsonb_build_object(
    'area_id', v_area_id, 'circuits', v_circuits, 'problems', v_total,
    'added', v_total - v_updated, 'updated', v_updated, 'removed', v_removed, 'unlinked', v_unlinked,
    'relinked', v_relinked);
end $$;
revoke all on function public.admin_import_leblond_topo(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_leblond_topo(uuid, jsonb) to authenticated;

-- ── Once: the links already cleared ────────────────────────────────────────
do $$
declare a record;
begin
  for a in select id, gym_id from public.outdoor_areas where source = 'LEBLOND' loop
    perform public.leblond_relink_problems(a.gym_id, a.id);
  end loop;
end $$;

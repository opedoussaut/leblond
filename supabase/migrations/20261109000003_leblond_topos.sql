-- LEBLOND: topos made by the beta team (a Google My Maps export, parsed in the
-- app) for outdoor sites that Boolder does not cover, e.g. Dampierre Maincourt.
-- They live in the same tables as the Boolder catalogue, told apart by `source`:
-- the Boolder import only ever touches Boolder rows, and a team topo only ever
-- touches its own site's rows. The topo data is never in the repository; the
-- admin uploads it from Beta administration.
--
-- Ids come from a sequence far above Boolder's. A re-import keeps each boulder's
-- id (matched on its key: circuit colour + number, or its name off-circuit), so
-- climbers' logged problems stay linked; a boulder removed from the topo is
-- deleted and the climber's problem keeps its attempts (the link is cleared).

-- ── 1. Source of each catalogue row ────────────────────────────────────────
alter table public.outdoor_data_imports drop constraint outdoor_data_imports_source_check;
alter table public.outdoor_data_imports add constraint outdoor_data_imports_source_check
  check (source in ('BOOLDER', 'LEBLOND'));

alter table public.outdoor_areas
  add column source text not null default 'BOOLDER' check (source in ('BOOLDER', 'LEBLOND')),
  add column credit text check (credit is null or char_length(credit) <= 200);

alter table public.outdoor_circuits
  add column source text not null default 'BOOLDER' check (source in ('BOOLDER', 'LEBLOND')),
  add column area_id integer references public.outdoor_areas (id) on delete cascade,
  add column source_key text check (source_key is null or char_length(source_key) <= 40),
  add constraint outdoor_circuits_leblond_keyed check (source = 'BOOLDER' or (area_id is not null and source_key is not null));

alter table public.outdoor_problems
  add column source text not null default 'BOOLDER' check (source in ('BOOLDER', 'LEBLOND')),
  add column source_key text check (source_key is null or char_length(source_key) <= 200),
  add constraint outdoor_problems_leblond_keyed check (source = 'BOOLDER' or source_key is not null);

create unique index outdoor_circuits_leblond_key on public.outdoor_circuits (area_id, source_key) where source = 'LEBLOND';
create unique index outdoor_problems_leblond_key on public.outdoor_problems (area_id, source_key) where source = 'LEBLOND';

create sequence public.outdoor_leblond_id_seq as integer start with 1000000000 maxvalue 2147483647;
revoke all on sequence public.outdoor_leblond_id_seq from public, anon, authenticated;

-- ── 2. Import (admin only, in their own session) ───────────────────────────
-- p_topo = { credit?: text, circuits: [{ color, average_grade }],
--            problems: [{ key, name, name_searchable, grade, circuit_color?, circuit_number?, latitude, longitude }],
--            skipped?: integer }
-- Replaces the site's topo with p_topo. Returns counts for the admin.
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

  insert into public.outdoor_data_imports (source, areas, circuits, problems, skipped)
  values ('LEBLOND', 1, v_circuits, v_total, greatest(coalesce((p_topo ->> 'skipped')::integer, 0), 0));

  return jsonb_build_object(
    'area_id', v_area_id, 'circuits', v_circuits, 'problems', v_total,
    'added', v_total - v_updated, 'updated', v_updated, 'removed', v_removed, 'unlinked', v_unlinked);
end $$;
revoke all on function public.admin_import_leblond_topo(uuid, jsonb) from public, anon;
grant execute on function public.admin_import_leblond_topo(uuid, jsonb) to authenticated;

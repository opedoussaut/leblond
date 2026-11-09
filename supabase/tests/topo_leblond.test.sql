-- Team topos (Google My Maps imports) in the catalogue tables: admin-only import,
-- stable ids on re-import, climbers' links kept or cleared, Boolder untouched.
-- Self-contained: @topo.test accounts, f6… ids, its own sites.
\set ON_ERROR_STOP 1
create or replace function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  begin execute stmt; exception when others then
    raise notice 'ok (expected failure) %: [%] %', label, sqlstate, sqlerrm; return; end;
  raise exception 'EXPECTED FAILURE did not happen: %', label;
end $$;
create or replace function pg_temp.expect(cond boolean, label text) returns void
language plpgsql as $$
begin if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;
-- Rows of the team topo on the test site, by key.
create or replace function pg_temp.topo_id(p_key text) returns integer
language sql stable as $$
  select op.id from public.outdoor_problems op join public.outdoor_areas a on a.id = op.area_id
  where a.gym_id = 'f6000000-0000-0000-0000-000000000001' and op.source = 'LEBLOND' and op.source_key = p_key
$$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;
grant execute on function pg_temp.topo_id(text) to authenticated, anon;

insert into public.beta_users (email, display_name, role) values
  ('tp-admin@topo.test', 'TP Admin', 'admin'),
  ('tp-climber@topo.test', 'TP Climber', 'beta_tester');
insert into auth.users (id, email) values
  ('f6000000-0000-0000-0000-00000000000a', 'tp-admin@topo.test'),
  ('f6000000-0000-0000-0000-00000000000b', 'tp-climber@topo.test');
insert into public.gyms (id, name, brand, city, country, grading_system, external_provider, external_id) values
  ('f6000000-0000-0000-0000-000000000001', 'Site Topo Test', 'OUTDOOR', 'Nulle part', 'FR', 'FONT', 'LEBLOND', 'topo-test-site'),
  ('f6000000-0000-0000-0000-000000000002', 'Zone Boolder Topo Test', 'OUTDOOR', 'Fontainebleau', 'FR', 'FONT', 'BOOLDER', '990001');
insert into public.outdoor_areas (id, gym_id, name, name_searchable, problems_count) values
  (990001, 'f6000000-0000-0000-0000-000000000002', 'Zone Boolder Topo Test', 'zoneboolder', 1);
insert into public.outdoor_problems (id, area_id, name, name_searchable, grade, steepness, latitude, longitude) values
  (990100, 990001, 'Bloc Boolder', 'blocboolder', '5a', 'wall', 48.4, 2.6);
select pg_temp.expect((select source from public.outdoor_problems where id = 990100) = 'BOOLDER', 'catalogue rows default to Boolder');
select pg_temp.expect_error($$insert into public.outdoor_problems (id, area_id, name, grade, steepness, latitude, longitude, source)
  values (990101, 990001, 'Sans clé', '5a', 'wall', 48.4, 2.6, 'LEBLOND')$$, 'a team-topo boulder needs its key');

-- ── First import by the admin ─────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000a","email":"tp-admin@topo.test","role":"authenticated"}', false);
select pg_temp.expect(public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001', $j${
  "credit": "Topo test",
  "circuits": [{"color": "orange", "average_grade": "3a"}],
  "problems": [
    {"key": "orange:1", "name": "Premier", "name_searchable": "premier", "grade": "3a", "circuit_color": "orange", "circuit_number": "1", "latitude": 48.70, "longitude": 2.00},
    {"key": "orange:2", "name": "Second", "name_searchable": "second", "grade": "4c", "circuit_color": "orange", "circuit_number": "2", "latitude": 48.71, "longitude": 2.01},
    {"key": "hc:lagrotte", "name": "La Grotte", "name_searchable": "lagrotte", "grade": "7A", "latitude": 48.72, "longitude": 2.02}
  ],
  "skipped": 2}$j$::jsonb) - 'area_id'
  = '{"circuits": 1, "problems": 3, "added": 3, "updated": 0, "removed": 0, "unlinked": 0}'::jsonb,
  'the first import adds every boulder');
reset role;

select pg_temp.expect((select source = 'LEBLOND' and credit = 'Topo test' and problems_count = 3 and id >= 1000000000
  and south_west_lat = 48.70 and north_east_lon = 2.02
  from public.outdoor_areas where gym_id = 'f6000000-0000-0000-0000-000000000001'), 'the site gets its own team-topo area');
select pg_temp.expect((select count(*) = 1 from public.outdoor_circuits c join public.outdoor_areas a on a.id = c.area_id
  where a.gym_id = 'f6000000-0000-0000-0000-000000000001' and c.source = 'LEBLOND' and c.color = 'orange'), 'one circuit per colour');
select pg_temp.expect((select count(*) filter (where circuit_id is not null) = 2 and count(*) = 3 and bool_and(op.source = 'LEBLOND')
  from public.outdoor_problems op join public.outdoor_areas a on a.id = op.area_id
  where a.gym_id = 'f6000000-0000-0000-0000-000000000001'), 'circuit boulders point to their circuit, off-circuit ones do not');
select pg_temp.expect((select count(*) = 1 from public.outdoor_data_imports where source = 'LEBLOND' and problems = 3 and skipped = 2),
  'the import is recorded');
-- Remember the ids the climber will rely on.
create temp table topo_ids as select pg_temp.topo_id('orange:1') as orange1, pg_temp.topo_id('hc:lagrotte') as grotte;
grant select on topo_ids to authenticated;

-- ── A climber sees the topo and logs a boulder from it ────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000b","email":"tp-climber@topo.test","role":"authenticated"}', false);
select pg_temp.expect(pg_temp.topo_id('orange:1') is not null and pg_temp.topo_id('orange:2') is not null, 'an active climber reads the team topo');
insert into public.problems (id, gym_id, native_grade, native_grade_system, outdoor_problem_id)
  values ('f6000000-0000-0000-0000-0000000000c1', 'f6000000-0000-0000-0000-000000000001', '3a', 'FONT', pg_temp.topo_id('orange:1'));
insert into public.problems (id, gym_id, native_grade, native_grade_system, outdoor_problem_id)
  values ('f6000000-0000-0000-0000-0000000000c2', 'f6000000-0000-0000-0000-000000000001', '7A', 'FONT', pg_temp.topo_id('hc:lagrotte'));
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system, outdoor_problem_id)
  values ('f6000000-0000-0000-0000-000000000002', '4c', 'FONT', pg_temp.topo_id('orange:2'))$$, 'a team-topo boulder belongs to its own site');
-- Climbers cannot import, write the topo or draw ids.
select pg_temp.expect_error($$select public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001', '{"problems": []}')$$, 'a climber cannot import a topo');
select pg_temp.expect_error($$update public.outdoor_problems set name = 'Pirate' where source = 'LEBLOND'$$, 'a climber cannot edit the topo');
select pg_temp.expect_error($$select nextval('public.outdoor_leblond_id_seq')$$, 'a climber cannot draw topo ids');
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001', '{"problems": []}')$$, 'an anonymous visitor cannot import a topo');
select pg_temp.expect_error($$select count(*) from public.outdoor_problems where source = 'LEBLOND'$$, 'an anonymous visitor cannot read the topo');
reset role;

-- ── Re-import: renamed boulder keeps its id, removed one goes, new one comes ─
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000a","email":"tp-admin@topo.test","role":"authenticated"}', false);
select pg_temp.expect(public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001', $j${
  "credit": "Topo test v2",
  "circuits": [{"color": "orange", "average_grade": "3c"}, {"color": "red", "average_grade": "5c"}],
  "problems": [
    {"key": "orange:1", "name": "Premier pas", "name_searchable": "premierpas", "grade": "3c", "circuit_color": "orange", "circuit_number": "1", "latitude": 48.70, "longitude": 2.00},
    {"key": "red:1", "name": "Le Toit", "name_searchable": "letoit", "grade": "5c", "circuit_color": "red", "circuit_number": "1", "latitude": 48.73, "longitude": 2.03},
    {"key": "hc:lagrotte", "name": "La Grotte", "name_searchable": "lagrotte", "grade": "7A", "latitude": 48.72, "longitude": 2.02}
  ]}$j$::jsonb) - 'area_id'
  = '{"circuits": 2, "problems": 3, "added": 1, "updated": 2, "removed": 1, "unlinked": 0}'::jsonb,
  'a re-import updates, adds and removes');
reset role;
select pg_temp.expect((select pg_temp.topo_id('orange:1') = orange1 and pg_temp.topo_id('hc:lagrotte') = grotte from topo_ids),
  'boulders keep their id across imports');
select pg_temp.expect((select name = 'Premier pas' and grade = '3c' from public.outdoor_problems where id = pg_temp.topo_id('orange:1')),
  'a re-import updates name and grade');
select pg_temp.expect(pg_temp.topo_id('orange:2') is null and pg_temp.topo_id('red:1') is not null, 'removed boulders go, new ones come');
select pg_temp.expect((select outdoor_problem_id = (select orange1 from topo_ids) from public.problems where id = 'f6000000-0000-0000-0000-0000000000c1'),
  'the climber''s logged boulder is still linked');
select pg_temp.expect((select credit = 'Topo test v2' and problems_count = 3 from public.outdoor_areas
  where gym_id = 'f6000000-0000-0000-0000-000000000001'), 'the area follows the new import');

-- ── A boulder the climber logged leaves the topo: attempts kept, link cleared ─
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f6000000-0000-0000-0000-00000000000a","email":"tp-admin@topo.test","role":"authenticated"}', false);
select pg_temp.expect((public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001', $j${
  "circuits": [],
  "problems": [
    {"key": "hc:lagrotte", "name": "La Grotte", "name_searchable": "lagrotte", "grade": "7A", "latitude": 48.72, "longitude": 2.02}
  ]}$j$::jsonb) ->> 'unlinked')::int = 1, 'the admin is told how many logged boulders lose their link');
-- Refusals: a Boolder area, a broken topo.
select pg_temp.expect_error($$select public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000002',
  '{"problems": [{"key": "hc:x", "name": "X", "grade": "5a", "latitude": 48.4, "longitude": 2.6}]}')$$, 'a Boolder area cannot take a team topo');
select pg_temp.expect_error($$select public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001', '{"problems": []}')$$, 'an empty topo is refused');
select pg_temp.expect_error($$select public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001',
  '{"problems": [{"key": "hc:x", "name": "X", "grade": "5a", "latitude": 48.4, "longitude": 2.6},
                 {"key": "hc:x", "name": "X bis", "grade": "5b", "latitude": 48.4, "longitude": 2.6}]}')$$, 'duplicate keys are refused');
select pg_temp.expect_error($$select public.admin_import_leblond_topo('f6000000-0000-0000-0000-000000000001',
  '{"problems": [{"key": "hc:x", "name": "X", "grade": "4+", "latitude": 48.4, "longitude": 2.6}]}')$$, 'grades off the Font scale are refused');
reset role;
select pg_temp.expect((select outdoor_problem_id is null from public.problems where id = 'f6000000-0000-0000-0000-0000000000c1'),
  'the removed boulder''s link is cleared');
select pg_temp.expect((select count(*) = 2 from public.problems where id in ('f6000000-0000-0000-0000-0000000000c1', 'f6000000-0000-0000-0000-0000000000c2')),
  'the climber''s problems are kept');
select pg_temp.expect(pg_temp.topo_id('hc:lagrotte') = (select grotte from topo_ids)
  and (select count(*) = 0 from public.outdoor_circuits c join public.outdoor_areas a on a.id = c.area_id
       where a.gym_id = 'f6000000-0000-0000-0000-000000000001'), 'refused imports changed nothing; unused circuits are gone');
select pg_temp.expect((select count(*) = 1 from public.outdoor_problems where id = 990100), 'team imports never touch Boolder rows');

-- ── The Boolder import (catalogue-sql.ts) never removes team topos ────────
begin;
delete from public.outdoor_problems where source = 'BOOLDER' and not (id = any ('{990100}'::integer[]));
delete from public.outdoor_circuits where source = 'BOOLDER' and not (id = any ('{}'::integer[]));
delete from public.outdoor_areas where source = 'BOOLDER' and not (id = any ('{990001}'::integer[]));
select pg_temp.expect(pg_temp.topo_id('hc:lagrotte') is not null, 'a Boolder clean-up leaves team topos alone');
select pg_temp.expect((select count(*) = 1 from public.outdoor_problems where source = 'BOOLDER'), 'and still cleans Boolder rows');
rollback;

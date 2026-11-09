-- Team topos: the admin corrects, adds and deletes one boulder at a time.
-- Self-contained: @topoed.test accounts, f7… ids, its own sites.
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
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

insert into public.beta_users (email, display_name, role) values
  ('te-admin@topoed.test', 'TE Admin', 'admin'),
  ('te-climber@topoed.test', 'TE Climber', 'beta_tester');
insert into auth.users (id, email) values
  ('f7000000-0000-0000-0000-00000000000a', 'te-admin@topoed.test'),
  ('f7000000-0000-0000-0000-00000000000b', 'te-climber@topoed.test');
insert into public.gyms (id, name, brand, city, country, grading_system, external_provider, external_id) values
  ('f7000000-0000-0000-0000-000000000001', 'Site Editeur Test', 'OUTDOOR', 'Nulle part', 'FR', 'FONT', 'LEBLOND', 'topo-editor-site'),
  ('f7000000-0000-0000-0000-000000000002', 'Zone Boolder Editeur', 'OUTDOOR', 'Fontainebleau', 'FR', 'FONT', 'BOOLDER', '990002'),
  ('f7000000-0000-0000-0000-000000000003', 'Site Sans Topo', 'OUTDOOR', 'Nulle part', 'FR', 'FONT', 'LEBLOND', 'topo-editor-empty');
insert into public.outdoor_areas (id, gym_id, name, name_searchable, problems_count) values
  (990002, 'f7000000-0000-0000-0000-000000000002', 'Zone Boolder Editeur', 'zoneboolderediteur', 1);
insert into public.outdoor_problems (id, area_id, name, name_searchable, grade, steepness, latitude, longitude) values
  (990200, 990002, 'Bloc Boolder Editeur', 'blocboolderediteur', '5a', 'wall', 48.4, 2.6);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000a","email":"te-admin@topoed.test","role":"authenticated"}', false);
select public.admin_import_leblond_topo('f7000000-0000-0000-0000-000000000001', $j${
  "circuits": [{"color": "orange", "average_grade": "3a"}],
  "problems": [
    {"key": "orange:1", "name": "Premier", "name_searchable": "premier", "grade": "3a", "circuit_color": "orange", "circuit_number": "1", "latitude": 48.70, "longitude": 2.00},
    {"key": "hc:lagrotte", "name": "La Grotte", "name_searchable": "lagrotte", "grade": "7A", "latitude": 48.72, "longitude": 2.02}
  ]}$j$::jsonb);
create temp table ids as
  select op.source_key, op.id from public.outdoor_problems op join public.outdoor_areas a on a.id = op.area_id
  where a.gym_id = 'f7000000-0000-0000-0000-000000000001';
grant select on ids to authenticated;

-- Correct a boulder: new grade and number, same id; its key follows.
select pg_temp.expect(public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000001', (select id from ids where source_key = 'orange:1'),
  '{"key": "orange:1b", "name": "Premier bis", "name_searchable": "premierbis", "grade": "3b", "circuit_color": "orange", "circuit_number": "1b", "sit_start": true, "steepness": "slab", "latitude": 48.70, "longitude": 2.00}'::jsonb)
  = (select id from ids where source_key = 'orange:1'), 'an update keeps the id');
select pg_temp.expect((select source_key = 'orange:1b' and name = 'Premier bis' and grade = '3b' and circuit_number = '1b' and sit_start and steepness = 'slab'
  from public.outdoor_problems where id = (select id from ids where source_key = 'orange:1')), 'the fields and key are updated');

-- Add a boulder on a new circuit, without a position: listed, not mapped; the circuit is created.
select pg_temp.expect(public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000001', null,
  '{"key": "blue:4", "name": "Nouveau", "name_searchable": "nouveau", "grade": "5b", "circuit_color": "blue", "circuit_number": "4"}'::jsonb) >= 1000000000,
  'a new boulder gets a team-topo id');
select pg_temp.expect((select latitude is null and longitude is null and circuit_id is not null from public.outdoor_problems where source_key = 'blue:4'),
  'added without a position, on its circuit');
select pg_temp.expect((select problems_count = 3 from public.outdoor_areas where gym_id = 'f7000000-0000-0000-0000-000000000001'), 'the count follows');

-- Keys stay unique; half a position or a Boolder site are refused.
select pg_temp.expect_error($$select public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000001', null,
  '{"key": "hc:lagrotte", "name": "La Grotte", "name_searchable": "lagrotte", "grade": "6A"}'::jsonb)$$, 'duplicate key');
select pg_temp.expect_error($$select public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000001', null,
  '{"key": "hc:x", "name": "X", "grade": "6A", "latitude": 48.7}'::jsonb)$$, 'half a position');
select pg_temp.expect_error($$select public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000002', null,
  '{"key": "hc:z", "name": "Z", "grade": "6A"}'::jsonb)$$, 'Boolder site refused');
select pg_temp.expect_error($$select public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000003', null,
  '{"key": "hc:z", "name": "Z", "grade": "6A"}'::jsonb)$$, 'a site without a team topo');
select pg_temp.expect_error($$select public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000001', 990200,
  '{"key": "hc:z", "name": "Z", "grade": "6A"}'::jsonb)$$, 'a Boolder boulder cannot be edited through a team site');

-- A climber logs La Grotte, then the admin deletes it: the log keeps its tries, the link is cleared.
select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000b","email":"te-climber@topoed.test","role":"authenticated"}', false);
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system, outdoor_problem_id)
values ('f7100000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-00000000000b', '7A', 'FONT',
  (select id from ids where source_key = 'hc:lagrotte'));
select pg_temp.expect_error($$select public.admin_save_topo_problem('f7000000-0000-0000-0000-000000000001', null,
  '{"key": "hc:w", "name": "W", "grade": "6A"}'::jsonb)$$, 'a climber cannot add');
select pg_temp.expect_error($$select public.admin_delete_topo_problem('f7000000-0000-0000-0000-000000000001', (select id from ids where source_key = 'hc:lagrotte'))$$,
  'a climber cannot delete');
select pg_temp.expect_error($$select * from public.admin_topo_link_counts('f7000000-0000-0000-0000-000000000001')$$, 'a climber cannot read link counts');

select set_config('request.jwt.claims', '{"sub":"f7000000-0000-0000-0000-00000000000a","email":"te-admin@topoed.test","role":"authenticated"}', false);
select pg_temp.expect((select logged = 1 from public.admin_topo_link_counts('f7000000-0000-0000-0000-000000000001')
  where outdoor_problem_id = (select id from ids where source_key = 'hc:lagrotte')), 'the admin sees one log (count only)');
select pg_temp.expect(public.admin_delete_topo_problem('f7000000-0000-0000-0000-000000000001', (select id from ids where source_key = 'hc:lagrotte'))
  = '{"unlinked": 1}'::jsonb, 'deleted, one log unlinked');
select pg_temp.expect_error($$select public.admin_delete_topo_problem('f7000000-0000-0000-0000-000000000001', 990200)$$, 'a Boolder boulder cannot be deleted');
reset role;
select pg_temp.expect((select outdoor_problem_id is null from public.problems where id = 'f7100000-0000-0000-0000-000000000001'), 'the climber''s boulder stays, unlinked');
select pg_temp.expect((select count(*) = 1 from public.outdoor_problems where id = 990200), 'Boolder untouched');
select pg_temp.expect((select problems_count = 2 from public.outdoor_areas where gym_id = 'f7000000-0000-0000-0000-000000000001'), 'the count follows a deletion');
select pg_temp.expect(not has_function_privilege('anon', 'public.admin_save_topo_problem(uuid, integer, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.admin_delete_topo_problem(uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.leblond_area_refresh(integer)', 'execute'),
  'helpers closed to clients');
\echo 'topo_editor.test.sql: all assertions passed'

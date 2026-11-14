-- Outdoor projects: route projects at an outdoor site carry sector, angle, beta and topo;
-- boulder projects on a climber's own outdoor boulder. Owner-only (self-contained).
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

insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes, created_by)
values ('0d100000-0000-0000-0000-000000000001', 'Outdoor Projects Crag', 'OUTDOOR', 'FONT', true, true, null);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);

-- Route project with every outdoor detail.
insert into public.route_projects (id, user_id, gym_id, route_name, route_key, grade, sector, wall_angle, beta, topo_ref, topo_url)
values ('0d200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '0d100000-0000-0000-0000-000000000001',
        'La Fissure', 'la fissure', '6b+', 'Secteur Est', 'VERTICAL', 'Repos au 3e point', 'Topo test, p. 12 n° 4', 'https://example.test/topo');
select pg_temp.expect((select sector = 'Secteur Est' and wall_angle = 'VERTICAL' and grade = '6b+'
  from public.route_projects where id = '0d200000-0000-0000-0000-000000000001'), 'outdoor route project keeps its details');
update public.route_projects set sector = 'Secteur Ouest', wall_angle = 'OVERHANG', beta = 'Talon à gauche',
  topo_ref = 'p. 13', topo_url = null where id = '0d200000-0000-0000-0000-000000000001';
select pg_temp.expect((select sector = 'Secteur Ouest' and topo_url is null from public.route_projects
  where id = '0d200000-0000-0000-0000-000000000001'), 'owner edits the outdoor details');
select pg_temp.expect_error($$update public.route_projects set topo_url = 'http://example.test' where id = '0d200000-0000-0000-0000-000000000001'$$,
  'topo link must be https');
select pg_temp.expect_error($$update public.route_projects set sector = repeat('x', 121) where id = '0d200000-0000-0000-0000-000000000001'$$,
  'sector length bounded');
select pg_temp.expect_error($$update public.route_projects set grade = '6B+' where id = '0d200000-0000-0000-0000-000000000001'$$,
  'route grades stay French lowercase');

-- Boulder project on an outdoor boulder with topo details (no session needed).
insert into public.problems (id, gym_id, created_by, name, native_grade, native_grade_system, wall_zone, beta, topo_ref, topo_url)
values ('0d300000-0000-0000-0000-000000000001', '0d100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
        'Le Toit', '7A', 'FONT', 'Secteur Est', 'Jeté final', 'Topo test, n° 8', 'https://example.test/bloc');
insert into public.projects (id, user_id, problem_id, notes)
values ('0d400000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '0d300000-0000-0000-0000-000000000001', 'Objectif printemps');

-- Another climber sees and changes nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.route_projects where id = '0d200000-0000-0000-0000-000000000001'), 'route project private');
select pg_temp.expect((select count(*) = 0 from public.projects where id = '0d400000-0000-0000-0000-000000000001'), 'boulder project private');
update public.route_projects set sector = 'Pirate' where id = '0d200000-0000-0000-0000-000000000001';
update public.problems set beta = 'Pirate' where id = '0d300000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$insert into public.route_projects (user_id, gym_id, route_name, route_key, grade)
  values ('00000000-0000-0000-0000-00000000000a', '0d100000-0000-0000-0000-000000000001', 'Squat', 'squat', '6a')$$,
  'cannot create a route project for someone else');
reset role;
select pg_temp.expect((select sector = 'Secteur Ouest' from public.route_projects where id = '0d200000-0000-0000-0000-000000000001'),
  'another climber cannot edit the route project');
select pg_temp.expect((select beta = 'Jeté final' from public.problems where id = '0d300000-0000-0000-0000-000000000001'),
  'another climber cannot edit the boulder details');

delete from public.projects where id = '0d400000-0000-0000-0000-000000000001';
delete from public.problems where id = '0d300000-0000-0000-0000-000000000001';
delete from public.route_projects where id = '0d200000-0000-0000-0000-000000000001';
delete from public.gyms where id = '0d100000-0000-0000-0000-000000000001';

-- Boolder catalogue + lettered Font scale: RLS and integrity assertions.
-- Run by scripts/test-db.sh on top of supabase-emulation.sql + migrations.
-- Uses its own @outdoor.test accounts so it is independent of rls.test.sql.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok (expected failure) %: [%] %', label, sqlstate, sqlerrm;
    return;
  end;
  raise exception 'EXPECTED FAILURE did not happen: %', label;
end $$;

create or replace function pg_temp.expect(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'ASSERTION FAILED: %', label;
  end if;
end $$;

-- ── Importer (service role / superuser) loads a tiny catalogue ─────────────
insert into public.beta_users (email, display_name, role) values
  ('anna@outdoor.test', 'Anna', 'beta_tester'),
  ('bruno@outdoor.test', 'Bruno', 'beta_tester'),
  ('gone@outdoor.test', 'Gone', 'beta_tester');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'anna@outdoor.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'bruno@outdoor.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'gone@outdoor.test');
update public.beta_users set active = false where email = 'gone@outdoor.test';

insert into public.gyms (id, name, brand, city, country, grading_system, external_provider, external_id, created_by) values
  ('50000000-0000-0000-0000-000000000001', 'Zone Alpha', 'OUTDOOR', 'Fontainebleau', 'FR', 'FONT', 'BOOLDER', '1', null),
  ('50000000-0000-0000-0000-000000000002', 'Zone Beta', 'OUTDOOR', 'Fontainebleau', 'FR', 'FONT', 'BOOLDER', '2', null);
select pg_temp.expect_error($$insert into public.gyms (name, brand, grading_system, external_provider, external_id) values ('Zone Alpha bis', 'OUTDOOR', 'FONT', 'BOOLDER', '1')$$, 'one gym per catalogue area');

insert into public.outdoor_areas (id, gym_id, name, name_searchable, cluster_name, tags, warning_fr, warning_en, problems_count) values
  (1, '50000000-0000-0000-0000-000000000001', 'Zone Alpha', 'zonealpha', 'Massif', '{popular}', 'Secteur fermé.', 'Area closed.', 2),
  (2, '50000000-0000-0000-0000-000000000002', 'Zone Beta', 'zonebeta', 'Massif', '{}', null, null, 1);
insert into public.outdoor_circuits (id, color, average_grade, beginner_friendly) values (10, 'blue', '4b', false);
insert into public.outdoor_problems (id, area_id, name, name_searchable, grade, circuit_id, circuit_number, circuit_color, steepness, wall_angle, sit_start, latitude, longitude, bleau_info_id) values
  (100, 1, 'Bloc Un', 'blocun', '4c', 10, '1', 'blue', 'slab', 'SLAB', false, 48.4, 2.6, '123'),
  (101, 1, 'Bloc Deux', 'blocdeux', '6A+', null, null, null, 'overhang', 'OVERHANG', true, 48.4, 2.6, null),
  (200, 2, 'Bloc Trois', 'bloctrois', '7A', null, null, null, 'wall', 'VERTICAL', false, 48.4, 2.6, null);
insert into public.outdoor_data_imports (source, source_version, areas, circuits, problems, skipped) values ('BOOLDER', 'abc123', 2, 1, 3, 0);

-- Lettered Font scale: Boolder's spelling is the stored spelling.
select pg_temp.expect_error($$insert into public.outdoor_problems (id, area_id, name, grade, steepness, latitude, longitude) values (102, 1, 'Bad', '6a', 'wall', 48.4, 2.6)$$, 'catalogue grade must be on the lettered Font scale (6A, not 6a)');
select pg_temp.expect_error($$insert into public.outdoor_problems (id, area_id, name, grade, steepness, latitude, longitude) values (103, 1, 'Bad', '4+', 'wall', 48.4, 2.6)$$, 'old 4+ notation is not on the scale');
select pg_temp.expect(public.is_valid_native_grade('FONT', '5c') and public.is_valid_native_grade('FONT', '1a') and public.is_valid_native_grade('FONT', '9A'), 'lettered grades are valid');
select pg_temp.expect(not public.is_valid_native_grade('FONT', '5+'), '5+ is no longer valid');
select pg_temp.expect(array_length(public.font_grades(), 1) = 34, 'Font scale has 34 steps');

grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

-- ── Anna (active beta tester) ──────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"anna@outdoor.test","role":"authenticated"}', false);

select pg_temp.expect((select count(*) from public.outdoor_areas where id in (1, 2)) = 2, 'beta tester reads areas');
select pg_temp.expect((select count(*) from public.outdoor_problems where id in (100, 101, 200)) = 3, 'beta tester reads problems');
select pg_temp.expect((select count(*) from public.outdoor_circuits where id = 10) = 1, 'beta tester reads circuits');
select pg_temp.expect((select count(*) from public.outdoor_data_imports where source_version = 'abc123') = 1, 'beta tester reads import status');

select pg_temp.expect_error($$insert into public.outdoor_areas (id, gym_id, name) values (3, '50000000-0000-0000-0000-000000000001', 'Fake')$$, 'client cannot add areas');
select pg_temp.expect_error($$update public.outdoor_problems set grade = '9A' where id = 100$$, 'client cannot regrade catalogue');
select pg_temp.expect_error($$delete from public.outdoor_problems where id = 100$$, 'client cannot delete catalogue');
select pg_temp.expect_error($$insert into public.outdoor_data_imports (source, areas, circuits, problems) values ('BOOLDER', 0, 0, 0)$$, 'client cannot fake an import');
select pg_temp.expect_error($$insert into public.gyms (name, brand, grading_system, external_provider, external_id) values ('Squat', 'OUTDOOR', 'FONT', 'BOOLDER', '99')$$, 'client cannot create catalogue gyms');

-- A climber's own outdoor spot may share a catalogue area's name.
insert into public.gyms (id, name, brand, grading_system) values ('50000000-0000-0000-0000-0000000000a1', 'Zone Alpha', 'OUTDOOR', 'FONT');
select pg_temp.expect_error($$update public.gyms set external_provider = 'BOOLDER', external_id = '77' where id = '50000000-0000-0000-0000-0000000000a1'$$, 'client cannot turn a gym into a catalogue gym');

-- Linking a personal problem to a catalogue problem.
insert into public.problems (id, gym_id, native_grade, native_grade_system, wall_angle, outdoor_problem_id)
  values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '4c', 'FONT', 'SLAB', 100);
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system, outdoor_problem_id) values ('50000000-0000-0000-0000-000000000001', '4c', 'FONT', 100)$$, 'one personal problem per catalogue problem');
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system, outdoor_problem_id) values ('50000000-0000-0000-0000-000000000002', '6A+', 'FONT', 101)$$, 'catalogue problem must be in the session area');
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system) values ('50000000-0000-0000-0000-000000000001', '5+', 'FONT')$$, 'old 5+ notation rejected for personal problems');

insert into public.sessions (id, gym_id) values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001');
select public.log_attempt('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'ATTEMPT');
select public.log_attempt('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'TOP');

-- ── Bruno: his own link to the same boulder, and no view of Anna's ─────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","email":"bruno@outdoor.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) from public.problems where outdoor_problem_id = 100) = 0, 'Anna''s linked problem is private');
insert into public.problems (gym_id, native_grade, native_grade_system, outdoor_problem_id)
  values ('50000000-0000-0000-0000-000000000001', '4c', 'FONT', 100);

-- ── Deactivated tester and anonymous visitors see nothing ──────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","email":"gone@outdoor.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) from public.outdoor_problems) = 0, 'deactivated tester cannot read the catalogue');
reset role;

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select count(*) from public.outdoor_problems$$, 'anon cannot read the catalogue');
reset role;

-- ── Re-import removes a problem upstream: personal history is kept ─────────
delete from public.outdoor_problems where id = 100;
select pg_temp.expect((select outdoor_problem_id from public.problems where id = '60000000-0000-0000-0000-000000000001') is null, 'link cleared when catalogue problem disappears');
select pg_temp.expect((select count(*) from public.attempts where problem_id = '60000000-0000-0000-0000-000000000001') = 2, 'attempts kept');

\echo 'outdoor.test.sql: all assertions passed'

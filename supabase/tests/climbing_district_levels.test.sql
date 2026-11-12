-- Climbing District levels 1–12 next to its former colours (self-contained).
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

-- ── Catalogue and validity ──────────────────────────────────────────────────
select pg_temp.expect((select count(*) > 0
    and bool_and(grading_system = 'CLIMBING_DISTRICT_LEVEL'
                 and former_grading_systems = array['CLIMBING_DISTRICT_COLOR']::public.grade_system[]
                 and grading_system_since is null)
  from public.gyms where brand = 'CLIMBING_DISTRICT' and route_grading = 'FRENCH'),
  'Climbing District venues: levels now, colours as former scale, no unverified transition date');
select pg_temp.expect((select bool_and(cardinality(former_grading_systems) = 0) from public.gyms where brand <> 'CLIMBING_DISTRICT'),
  'other gyms keep their single scale');
select pg_temp.expect((select bool_and(grading_system = 'ARKOSE_COLOR') from public.gyms where brand = 'ARKOSE'),
  'Arkose unchanged');
select pg_temp.expect(public.is_valid_native_grade('CLIMBING_DISTRICT_LEVEL', '1') and public.is_valid_native_grade('CLIMBING_DISTRICT_LEVEL', '12'),
  'levels 1 and 12 valid');
select pg_temp.expect(not public.is_valid_native_grade('CLIMBING_DISTRICT_LEVEL', '0') and not public.is_valid_native_grade('CLIMBING_DISTRICT_LEVEL', '13')
  and not public.is_valid_native_grade('CLIMBING_DISTRICT_LEVEL', 'BLUE') and not public.is_valid_native_grade('CLIMBING_DISTRICT_LEVEL', '6A'),
  'only 1–12 are levels');
select pg_temp.expect(public.is_valid_native_grade('CLIMBING_DISTRICT_COLOR', 'PINK') and not public.is_valid_native_grade('CLIMBING_DISTRICT_COLOR', '7'),
  'colours unchanged, and a level is not a colour');
select pg_temp.expect_error($$insert into public.gyms (name, brand, grading_system) values ('Arkose Levels?', 'ARKOSE', 'CLIMBING_DISTRICT_LEVEL')$$,
  'only Climbing District uses its levels');
select pg_temp.expect_error($$insert into public.gyms (name, brand, grading_system, former_grading_systems)
  values ('CD Twice', 'CLIMBING_DISTRICT', 'CLIMBING_DISTRICT_LEVEL', '{CLIMBING_DISTRICT_LEVEL}')$$,
  'the current scale is not also a former one');
select pg_temp.expect((select count(*) = 0 from public.sessions where discipline = 'BOULDER' and grade_system is null),
  'every boulder session records its scale');

-- ── A climber at a Climbing District gym, before and after the switch ───────
insert into public.beta_users (email, display_name) values ('cdl-a@cdl.test', 'A'), ('cdl-b@cdl.test', 'B');
insert into auth.users (id, email) values
  ('1d000000-0000-0000-0000-00000000000a', 'cdl-a@cdl.test'),
  ('1d000000-0000-0000-0000-00000000000b', 'cdl-b@cdl.test');
-- The gym as it was before: colours only.
insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('1d100000-0000-0000-0000-000000000001', 'CD Levels Test Gym', 'CLIMBING_DISTRICT', 'CLIMBING_DISTRICT_COLOR', true, true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"1d000000-0000-0000-0000-00000000000a","email":"cdl-a@cdl.test","role":"authenticated"}', false);
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('1d200000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-00000000000a', '1d100000-0000-0000-0000-000000000001',
  '2026-09-10 16:00+00', '2026-09-10 18:00+00', 120);
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_COLOR' from public.sessions where id = '1d200000-0000-0000-0000-000000000001'),
  'a session takes its gym''s scale');
select public.log_boulder_batch('1d200000-0000-0000-0000-000000000001', 'BLUE', 1, 2, 'TOP', null);
select public.log_boulder_batch('1d200000-0000-0000-0000-000000000001', 'PINK', 1, 1, 'TOP', null);
reset role;

-- The network moves to levels (as migration 20261119000001 does for the catalogue).
update public.gyms set former_grading_systems = '{CLIMBING_DISTRICT_COLOR}', grading_system = 'CLIMBING_DISTRICT_LEVEL'
  where id = '1d100000-0000-0000-0000-000000000001';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"1d000000-0000-0000-0000-00000000000a","email":"cdl-a@cdl.test","role":"authenticated"}', false);
-- History untouched: same session scale, same colour boulders and tops.
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_COLOR' from public.sessions where id = '1d200000-0000-0000-0000-000000000001'),
  'the old session stays a colour session');
select pg_temp.expect((select count(*) = 2 and bool_and(native_grade_system = 'CLIMBING_DISTRICT_COLOR')
    and array_agg(native_grade order by native_grade) = array['BLUE', 'PINK']
  from public.problems where gym_id = '1d100000-0000-0000-0000-000000000001'), 'colour boulders unchanged');
select pg_temp.expect((select count(*) filter (where result = 'TOP') = 2 from public.attempts where session_id = '1d200000-0000-0000-0000-000000000001'),
  'colour tops unchanged');
-- Completing the old session: still colours, no level slipped in.
select public.log_boulder_batch('1d200000-0000-0000-0000-000000000001', 'RED', 1, 1, 'ATTEMPT', null);
select pg_temp.expect((select native_grade_system = 'CLIMBING_DISTRICT_COLOR' from public.problems
  where gym_id = '1d100000-0000-0000-0000-000000000001' and native_grade = 'RED'), 'editing an old session logs colours');
select pg_temp.expect_error($$select public.log_boulder_batch('1d200000-0000-0000-0000-000000000001', '7', 1, 1, 'TOP', null)$$,
  'no level in a colour session');

-- A new session: levels 1–12.
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('1d200000-0000-0000-0000-000000000002', '1d000000-0000-0000-0000-00000000000a', '1d100000-0000-0000-0000-000000000001',
  '2026-11-10 16:00+00', '2026-11-10 18:00+00', 120);
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_LEVEL' from public.sessions where id = '1d200000-0000-0000-0000-000000000002'),
  'a new Climbing District session defaults to levels');
select public.log_boulder_batch('1d200000-0000-0000-0000-000000000002', '4', 1, 1, 'TOP', null);
select public.log_boulder_batch('1d200000-0000-0000-0000-000000000002', '11', 1, 3, 'PROJECT', null);
select pg_temp.expect((select count(*) = 2 and bool_and(native_grade_system = 'CLIMBING_DISTRICT_LEVEL') from public.problems
  where gym_id = '1d100000-0000-0000-0000-000000000001' and native_grade in ('4', '11')), 'levels stored as levels');
select pg_temp.expect((select count(*) filter (where result = 'TOP') = 0 from public.attempts a join public.problems p on p.id = a.problem_id
  where p.native_grade = '11' and p.gym_id = '1d100000-0000-0000-0000-000000000001'), 'a project''s tries are not tops');
select pg_temp.expect_error($$select public.log_boulder_batch('1d200000-0000-0000-0000-000000000002', 'BLUE', 1, 1, 'TOP', null)$$,
  'no colour in a levels session');
select pg_temp.expect_error($$select public.log_boulder_batch('1d200000-0000-0000-0000-000000000002', '13', 1, 1, 'TOP', null)$$,
  'no level 13');

-- Switching a session's scale: only to one of the gym's scales; logged boulders keep theirs.
update public.sessions set grade_system = 'CLIMBING_DISTRICT_COLOR' where id = '1d200000-0000-0000-0000-000000000002';
select public.log_boulder_batch('1d200000-0000-0000-0000-000000000002', 'YELLOW', 1, 1, 'FLASH', null);
select pg_temp.expect((select native_grade_system = 'CLIMBING_DISTRICT_LEVEL' from public.problems
  where gym_id = '1d100000-0000-0000-0000-000000000001' and native_grade = '4'), 'switching never converts what was logged');
select pg_temp.expect_error($$update public.sessions set grade_system = 'ARKOSE_COLOR' where id = '1d200000-0000-0000-0000-000000000002'$$,
  'a scale the gym does not use is refused');
update public.sessions set grade_system = null where id = '1d200000-0000-0000-0000-000000000002';
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_LEVEL' from public.sessions where id = '1d200000-0000-0000-0000-000000000002'),
  'clearing the scale falls back to the gym''s default');

-- Boulders inserted directly: any of the gym's scales, nothing else.
insert into public.problems (gym_id, native_grade, native_grade_system) values ('1d100000-0000-0000-0000-000000000001', 'PURPLE', 'CLIMBING_DISTRICT_COLOR');
insert into public.problems (gym_id, native_grade, native_grade_system) values ('1d100000-0000-0000-0000-000000000001', '12', 'CLIMBING_DISTRICT_LEVEL');
select pg_temp.expect_error($$insert into public.problems (gym_id, native_grade, native_grade_system)
  values ('1d100000-0000-0000-0000-000000000001', 'RED', 'ARKOSE_COLOR')$$, 'another network''s colours are refused');
select pg_temp.expect(public.gym_accepts_grade_system('1d100000-0000-0000-0000-000000000001', 'CLIMBING_DISTRICT_COLOR')
  and not public.gym_accepts_grade_system('1d100000-0000-0000-0000-000000000001', 'FONT'), 'gym_accepts_grade_system');

-- Routes stay on the French scale: a route session has no boulder scale.
insert into public.sessions (id, user_id, gym_id, discipline, started_at, ended_at)
values ('1d200000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000a', '1d100000-0000-0000-0000-000000000001',
  'ROUTE', '2026-11-11 16:00+00', '2026-11-11 18:00+00');
update public.sessions set grade_system = 'CLIMBING_DISTRICT_LEVEL' where id = '1d200000-0000-0000-0000-000000000003';
select pg_temp.expect((select grade_system is null from public.sessions where id = '1d200000-0000-0000-0000-000000000003'),
  'route sessions carry no boulder scale');

-- Another climber cannot change this climber's session scale (RLS: no row matched).
select set_config('request.jwt.claims', '{"sub":"1d000000-0000-0000-0000-00000000000b","email":"cdl-b@cdl.test","role":"authenticated"}', false);
update public.sessions set grade_system = 'CLIMBING_DISTRICT_COLOR' where id = '1d200000-0000-0000-0000-000000000002';
reset role;
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_LEVEL' from public.sessions where id = '1d200000-0000-0000-0000-000000000002'),
  'another climber cannot switch the scale');

-- ── A VERIFIED transition date picks the former scale for earlier sessions ──
insert into public.gyms (id, name, brand, grading_system, former_grading_systems, grading_system_since, has_bouldering)
values ('1d100000-0000-0000-0000-000000000002', 'CD Dated Test Gym', 'CLIMBING_DISTRICT', 'CLIMBING_DISTRICT_LEVEL',
  '{CLIMBING_DISTRICT_COLOR}', '2026-09-01', true);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"1d000000-0000-0000-0000-00000000000a","email":"cdl-a@cdl.test","role":"authenticated"}', false);
insert into public.sessions (id, user_id, gym_id, started_at, ended_at) values
  ('1d200000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-00000000000a', '1d100000-0000-0000-0000-000000000002',
   '2026-08-20 16:00+00', '2026-08-20 18:00+00'),
  ('1d200000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000000a', '1d100000-0000-0000-0000-000000000002',
   '2026-09-15 16:00+00', '2026-09-15 18:00+00');
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_COLOR' from public.sessions where id = '1d200000-0000-0000-0000-000000000004'),
  'before a verified transition date: former scale');
select pg_temp.expect((select grade_system = 'CLIMBING_DISTRICT_LEVEL' from public.sessions where id = '1d200000-0000-0000-0000-000000000005'),
  'after it: current scale');
reset role;
\echo 'climbing_district_levels.test.sql: all assertions passed'

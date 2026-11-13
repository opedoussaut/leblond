-- Structure v2: board séances, rival settings and the followed programme (self-contained).
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

-- Own climbers, so this file does not depend on the order test files run in.
insert into public.beta_users (email, display_name) values ('v2-a@v2.test', 'A'), ('v2-b@v2.test', 'B');
insert into auth.users (id, email) values
  ('c7000000-0000-0000-0000-00000000000a', 'v2-a@v2.test'),
  ('c7000000-0000-0000-0000-00000000000b', 'v2-b@v2.test');

-- The migration is additive: nothing existing became a board séance, and the home venue exists once.
select pg_temp.expect((select count(*) = 0 from public.sessions where discipline = 'BOARD'), 'no existing séance became a board séance');
select pg_temp.expect((select count(*) = 1 from public.gyms where external_provider = 'leblond-board' and external_id = 'home'), 'one home venue');

-- ── Board séances ────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-0000-0000-00000000000a","email":"v2-a@v2.test","role":"authenticated"}', false);

select pg_temp.expect_error($$insert into public.sessions (gym_id, discipline)
  select id, 'BOARD' from public.gyms where external_id = 'home' and external_provider = 'leblond-board'$$, 'a board séance needs its board');
select pg_temp.expect_error($$insert into public.sessions (gym_id, discipline, board)
  select id, 'BOULDER', 'KILTER' from public.gyms where external_id = 'home' and external_provider = 'leblond-board'$$, 'a board on a bouldering séance');
select pg_temp.expect_error($$insert into public.sessions (gym_id, discipline, board)
  select id, 'BOARD', 'WOODY' from public.gyms where external_id = 'home' and external_provider = 'leblond-board'$$, 'an unknown board');

-- The other Aurora boards a BoardLib logbook can come from are accepted.
insert into public.sessions (id, gym_id, discipline, board, board_angle)
select 'c7100000-0000-0000-0000-00000000000d', id, 'BOARD', 'DECOY', 40
from public.gyms where external_id = 'home' and external_provider = 'leblond-board';
insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
values ('c7100000-0000-0000-0000-00000000000d', gen_random_uuid(), 'DECOY', 'Bleu', 'bleu', 40, '6A', 'FONT', 'ATTEMPT');
insert into public.board_projects (board, climb_name, climb_key, angle, grade, grade_scale)
values ('TOUCHSTONE', 'Arête', 'arete', 30, 'V4', 'V');
select pg_temp.expect((select count(*) = 1 from public.board_ascents where board = 'DECOY'), 'a Decoy board climb is stored');
delete from public.board_projects where board = 'TOUCHSTONE';
delete from public.sessions where id = 'c7100000-0000-0000-0000-00000000000d';

insert into public.sessions (id, gym_id, discipline, board, board_layout, board_angle)
select 'c7100000-0000-0000-0000-00000000000a', id, 'BOARD', 'KILTER', 'Original', 40
from public.gyms where external_id = 'home' and external_provider = 'leblond-board';
select pg_temp.expect((select grade_system is null from public.sessions where id = 'c7100000-0000-0000-0000-00000000000a'),
  'a board séance has no gym grade system');

insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, tries, result, is_benchmark)
values ('c7100000-0000-0000-0000-00000000000a', 'c7200000-0000-0000-0000-000000000001', 'KILTER', 'Arête du lundi', 'arete du lundi', 40, '6B+', 'FONT', 3, 'SENT', true);
select pg_temp.expect((select user_id = 'c7000000-0000-0000-0000-00000000000a' from public.board_ascents where client_id = 'c7200000-0000-0000-0000-000000000001'),
  'owner defaults to the signed-in climber');

select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
  values ('c7100000-0000-0000-0000-00000000000a', 'c7200000-0000-0000-0000-000000000001', 'KILTER', 'X', 'x', 40, '6A', 'FONT', 'SENT')$$,
  'a retried tap (same client_id) cannot duplicate a climb');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, tries, result)
  values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'KILTER', 'X', 'x', 40, '6A', 'FONT', 2, 'FLASH')$$, 'a flash after two tries');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
  values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'KILTER', 'X', 'x', 95, '6A', 'FONT', 'SENT')$$, 'an impossible angle');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
  values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'KILTER', 'X', 'x', 40, '6A', 'YDS', 'SENT')$$, 'an unknown grade scale');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
  values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'TENSION', 'X', 'x', 40, '6A', 'FONT', 'SENT')$$,
  'a climb logged on another board than the séance''s');
select pg_temp.expect_error($$update public.board_ascents set session_id = session_id where client_id = 'c7200000-0000-0000-0000-000000000001'$$,
  'a climb cannot be moved to another séance');
select pg_temp.expect_error($$update public.board_ascents set source = 'BOARDLIB' where client_id = 'c7200000-0000-0000-0000-000000000001'$$,
  'the origin of a climb cannot be rewritten');
update public.board_ascents set tries = 4, notes = 'Mieux en statique' where client_id = 'c7200000-0000-0000-0000-000000000001';
select pg_temp.expect((select tries = 4 from public.board_ascents where client_id = 'c7200000-0000-0000-0000-000000000001'), 'owner can correct the tries');

-- An imported line is stored once.
insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result, source, external_ref)
values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'KILTER', 'Réglette 40', 'reglette 40', 40, '6C', 'FONT', 'ATTEMPT', 'BOARDLIB', 'kilter|abc|2026-03-28T18:42:11');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result, source, external_ref)
  values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'KILTER', 'Réglette 40', 'reglette 40', 40, '6C', 'FONT', 'ATTEMPT', 'BOARDLIB', 'kilter|abc|2026-03-28T18:42:11')$$,
  'importing the same line twice');

-- Board climbs only attach to board séances.
update public.sessions set ended_at = now() where id = 'c7100000-0000-0000-0000-00000000000a';
insert into public.gyms (id, name, brand, grading_system) values ('c7300000-0000-0000-0000-000000000001', 'V2 Test Gym', 'INDEPENDENT', 'FONT');
insert into public.sessions (id, gym_id) values ('c7100000-0000-0000-0000-00000000000b', 'c7300000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
  values ('c7100000-0000-0000-0000-00000000000b', gen_random_uuid(), 'KILTER', 'X', 'x', 40, '6A', 'FONT', 'SENT')$$, 'a board climb in a bouldering séance');
update public.sessions set ended_at = now() where id = 'c7100000-0000-0000-0000-00000000000b';

-- Board projects: the same board, name and angle make the same climb.
insert into public.board_projects (id, board, climb_name, climb_key, angle, grade, grade_scale)
values ('c7400000-0000-0000-0000-00000000000a', 'KILTER', 'Réglette 40', 'reglette 40', 40, '6C', 'FONT');
select pg_temp.expect_error($$insert into public.board_projects (board, climb_name, climb_key, angle, grade, grade_scale)
  values ('KILTER', 'réglette 40', 'reglette 40', 40, '6C', 'FONT')$$, 'the same climb as a second project');
insert into public.board_projects (board, climb_name, climb_key, angle, grade, grade_scale)
values ('KILTER', 'Réglette 40', 'reglette 40', 45, '6C+', 'FONT');
select pg_temp.expect_error($$update public.board_projects set status = 'SENT' where id = 'c7400000-0000-0000-0000-00000000000a'$$, 'sent without a date');
update public.board_projects set status = 'SENT', sent_at = now() where id = 'c7400000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$update public.board_projects set angle = 50 where id = 'c7400000-0000-0000-0000-00000000000a'$$, 'a project cannot change climb');

-- ── Followed programme ──────────────────────────────────────────────────────
insert into public.training_plans (id, user_id, name, weeks, sessions) values
  ('c7500000-0000-0000-0000-00000000000a', 'c7000000-0000-0000-0000-00000000000a', 'Fait main', 6, '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]'),
  ('c7500000-0000-0000-0000-00000000000c', 'c7000000-0000-0000-0000-00000000000a', 'Autre', 4, '[{"day":3,"methodId":"technique","minutes":45,"notes":""}]');
select pg_temp.expect((select count(*) = 0 from public.training_plans where followed_since is not null), 'a new programme is not followed by default');
update public.training_plans set followed_since = '2026-11-16' where id = 'c7500000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$update public.training_plans set followed_since = '2026-11-16' where id = 'c7500000-0000-0000-0000-00000000000c'$$,
  'two followed programmes');
update public.training_plans set followed_since = null where id = 'c7500000-0000-0000-0000-00000000000a';
update public.training_plans set followed_since = '2026-11-17' where id = 'c7500000-0000-0000-0000-00000000000c';

-- ── Rival settings ──────────────────────────────────────────────────────────
insert into public.alter_ego_pacts (id, display_name, plan_name, plan_snapshot, progression, start_date, horizon_weeks)
values ('c7600000-0000-0000-0000-00000000000a', 'Max', 'Autre', '[{"day":3,"methodId":"technique","minutes":45,"notes":""}]', '{"version":1}', '2026-11-16', 4);
select pg_temp.expect((select portrait = 'p1' and tone = 'PIQUANT' and level = 'REACH' and chase_projects from public.alter_ego_pacts
  where id = 'c7600000-0000-0000-0000-00000000000a'), 'the approved defaults: sharp, within reach, may chase projects');
update public.alter_ego_pacts set tone = 'SYMPA', portrait = 'p4', chase_projects = false where id = 'c7600000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$update public.alter_ego_pacts set tone = 'MECHANT' where id = 'c7600000-0000-0000-0000-00000000000a'$$, 'an unknown tone');
select pg_temp.expect_error($$update public.alter_ego_pacts set level = 'GOAL' where id = 'c7600000-0000-0000-0000-00000000000a'$$, 'the goal level without a date');
update public.alter_ego_pacts set level = 'GOAL', goal_date = '2027-03-01' where id = 'c7600000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$update public.alter_ego_pacts set display_name = 'Autre' where id = 'c7600000-0000-0000-0000-00000000000a'$$, 'the signed name stays');
select pg_temp.expect_error($$update public.alter_ego_pacts set horizon_weeks = 2 where id = 'c7600000-0000-0000-0000-00000000000a'$$, 'the signed duration stays');

-- ── Another climber sees and touches nothing ───────────────────────────────
select set_config('request.jwt.claims', '{"sub":"c7000000-0000-0000-0000-00000000000b","email":"v2-b@v2.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.board_ascents), 'another climber sees no board climb');
select pg_temp.expect((select count(*) = 0 from public.board_projects), 'another climber sees no board project');
select pg_temp.expect((select count(*) = 0 from public.training_plans where followed_since is not null), 'another climber sees no followed programme');
select pg_temp.expect_error($$insert into public.board_ascents (session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, result)
  values ('c7100000-0000-0000-0000-00000000000a', gen_random_uuid(), 'KILTER', 'Vol', 'vol', 40, '6A', 'FONT', 'SENT')$$, 'logging in another climber''s séance');
select pg_temp.expect_error($$insert into public.board_projects (user_id, board, climb_name, climb_key, angle, grade, grade_scale)
  values ('c7000000-0000-0000-0000-00000000000a', 'KILTER', 'Vol', 'vol', 40, '6A', 'FONT')$$, 'a project for another climber');
update public.board_ascents set notes = 'piraté';
delete from public.board_ascents;
delete from public.board_projects;
update public.alter_ego_pacts set tone = 'SANS_PITIE';
update public.training_plans set followed_since = null;

select set_config('request.jwt.claims', '{"sub":"c7000000-0000-0000-0000-00000000000a","email":"v2-a@v2.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 2 from public.board_ascents where notes <> 'piraté'), 'the climbs survived the other climber');
select pg_temp.expect((select count(*) = 2 from public.board_projects), 'the projects survived the other climber');
select pg_temp.expect((select tone = 'SYMPA' from public.alter_ego_pacts where id = 'c7600000-0000-0000-0000-00000000000a'), 'the rival settings survived the other climber');
select pg_temp.expect((select followed_since = '2026-11-17' from public.training_plans where id = 'c7500000-0000-0000-0000-00000000000c'),
  'the followed programme survived the other climber');

-- Deleting a séance removes its climbs.
delete from public.sessions where id = 'c7100000-0000-0000-0000-00000000000a';
select pg_temp.expect((select count(*) = 0 from public.board_ascents), 'climbs go with their séance');
reset role;

-- Anonymous visitors have no access at all.
set role anon;
select pg_temp.expect_error($$select count(*) from public.board_ascents$$, 'anon cannot read board climbs');
select pg_temp.expect_error($$select count(*) from public.board_projects$$, 'anon cannot read board projects');
reset role;

\echo 'structure_v2.test.sql: all assertions passed'

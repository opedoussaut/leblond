-- Batch bouldering entry, session names, route tries (self-contained).
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
insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-00000000000a', 'batch-a@example.test'),
  ('f0000000-0000-0000-0000-00000000000b', 'batch-b@example.test');
insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('e1000000-0000-0000-0000-000000000001', 'Batch Test Gym', 'ARKOSE', 'ARKOSE_COLOR', true, true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000a","email":"batch-a@example.test","role":"authenticated"}', false);
update public.sessions set ended_at = now() where ended_at is null;

insert into public.sessions (id, user_id, gym_id, title, started_at, ended_at, duration_minutes)
values ('e2000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001',
  'Sortie avec Thomas', '2026-09-20 16:00+00', '2026-09-20 18:00+00', 120);
select pg_temp.expect((select title = 'Sortie avec Thomas' from public.sessions where id = 'e2000000-0000-0000-0000-000000000001'), 'sessions can be named');

-- 3 red problems, 2 tries each, topped on the 2nd.
select pg_temp.expect(array_length(public.log_boulder_batch('e2000000-0000-0000-0000-000000000001', 'RED', 3, 2, 'TOP', 'arête gauche'), 1) = 3,
  'batch creates three problems');
select pg_temp.expect((select count(*) = 6 and count(*) filter (where result = 'TOP') = 3 and count(*) filter (where result = 'ATTEMPT') = 3
  from public.attempts where session_id = 'e2000000-0000-0000-0000-000000000001'), 'two tries each, the second one a top');
select pg_temp.expect((select bool_and(created_at between '2026-09-20 16:00+00' and '2026-09-20 18:00+00')
  from public.attempts where session_id = 'e2000000-0000-0000-0000-000000000001'), 'batch attempts dated inside the past session');
select pg_temp.expect((select count(*) = 3 from public.problems where notes = 'arête gauche' and gym_id = 'e1000000-0000-0000-0000-000000000001'),
  'the comment is stored on each problem');
-- A project: 4 tries, not sent, project opened.
select public.log_boulder_batch('e2000000-0000-0000-0000-000000000001', 'BLACK', 1, 4, 'PROJECT', null);
select pg_temp.expect((select count(*) = 1 from public.projects pr join public.problems p on p.id = pr.problem_id
  where p.native_grade = 'BLACK' and p.gym_id = 'e1000000-0000-0000-0000-000000000001' and pr.status = 'ACTIVE'), 'project opened');
select pg_temp.expect_error($$select public.log_boulder_batch('e2000000-0000-0000-0000-000000000001', 'BLUE', 1, 2, 'FLASH', null)$$, 'a flash is one try');
select pg_temp.expect_error($$select public.log_boulder_batch('e2000000-0000-0000-0000-000000000001', '6A', 1, 1, 'TOP', null)$$, 'grade must be the gym''s scale');
select pg_temp.expect_error($$select public.log_boulder_batch('e2000000-0000-0000-0000-000000000001', 'RED', 31, 1, 'TOP', null)$$, 'at most 30 problems at once');

-- Route lines carry tries; onsight stays single-try.
insert into public.sessions (id, user_id, gym_id, discipline, started_at, ended_at)
values ('e2000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001',
  'ROUTE', '2026-09-21 16:00+00', '2026-09-21 18:00+00');
insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, tries, notes)
values ('f0000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000002', gen_random_uuid(), '6b', 'LEAD', 'REDPOINT', 3, 'enfin');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, tries)
  values ('f0000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-000000000002', gen_random_uuid(), '6a', 'LEAD', 'ONSIGHT', 2)$$,
  'an onsight takes one try');

-- Another climber cannot batch-log into this session.
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-0000-0000-00000000000b","email":"batch-b@example.test","role":"authenticated"}', false);
select pg_temp.expect_error($$select public.log_boulder_batch('e2000000-0000-0000-0000-000000000001', 'RED', 1, 1, 'TOP', null)$$,
  'cannot batch-log into another climber''s session');
reset role;
\echo 'logging_ux.test.sql: all assertions passed'

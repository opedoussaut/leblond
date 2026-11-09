-- A boulder project remembers the session it was opened in (self-contained).
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

insert into public.beta_users (email, display_name) values ('ps-a@ps.test', 'PS A'), ('ps-b@ps.test', 'PS B')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('b1000000-0000-0000-0000-00000000000a', 'ps-a@ps.test'),
  ('b1000000-0000-0000-0000-00000000000b', 'ps-b@ps.test');
insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes) values
  ('b2000000-0000-0000-0000-000000000001', 'PS Crag', 'OUTDOOR', 'FONT', true, false);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-00000000000b","email":"ps-b@ps.test","role":"authenticated"}', false);
insert into public.sessions (id, user_id, gym_id, started_at) values
  ('b3000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-00000000000b', 'b2000000-0000-0000-0000-000000000001', now());

select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-00000000000a","email":"ps-a@ps.test","role":"authenticated"}', false);
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes) values
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 60);
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system) values
  ('b4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', '6A', 'FONT'),
  ('b4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', '6B', 'FONT');

-- "Make it a project" before any try: linked to the session.
insert into public.projects (user_id, problem_id, session_id)
values ('b1000000-0000-0000-0000-00000000000a', 'b4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001');
select pg_temp.expect((select session_id = 'b3000000-0000-0000-0000-000000000001' from public.projects
  where problem_id = 'b4000000-0000-0000-0000-000000000001'), 'a project opened in a session is linked to it');
select pg_temp.expect_error($$insert into public.projects (user_id, problem_id, session_id)
  values ('b1000000-0000-0000-0000-00000000000a', 'b4000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-00000000000b')$$,
  'not to another climber''s session');

-- Topo quick-add with "project": linked; an existing project keeps its session.
select count(*) from public.log_problem_tries('b3000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000002', 2, 'PROJECT');
select pg_temp.expect((select session_id = 'b3000000-0000-0000-0000-000000000001' from public.projects
  where problem_id = 'b4000000-0000-0000-0000-000000000002'), 'quick-add project linked to its session');
insert into public.sessions (id, user_id, gym_id, started_at) values
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', now());
select count(*) from public.log_problem_tries('b3000000-0000-0000-0000-000000000002', 'b4000000-0000-0000-0000-000000000002', 1, 'PROJECT');
select pg_temp.expect((select session_id = 'b3000000-0000-0000-0000-000000000001' from public.projects
  where problem_id = 'b4000000-0000-0000-0000-000000000002'), 'a later session does not take the project over');

-- Several projects at once (quick entry): all linked.
select array_length(public.log_boulder_batch('b3000000-0000-0000-0000-000000000002', '6C', 2, 3, 'PROJECT'), 1);
select pg_temp.expect((select count(*) = 2 from public.projects pr join public.problems p on p.id = pr.problem_id
  where p.native_grade = '6C' and pr.session_id = 'b3000000-0000-0000-0000-000000000002'), 'batch projects linked to the session');

-- Deleting the session keeps the project, unlinked.
reset role;
delete from public.attempts where session_id = 'b3000000-0000-0000-0000-000000000001';
delete from public.sessions where id = 'b3000000-0000-0000-0000-000000000001';
select pg_temp.expect((select session_id is null from public.projects where problem_id = 'b4000000-0000-0000-0000-000000000001'),
  'a deleted session leaves the project, unlinked');
\echo 'project_session.test.sql: all assertions passed'

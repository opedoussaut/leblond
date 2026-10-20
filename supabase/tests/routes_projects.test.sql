-- RLS and integrity assertions for route projects (self-contained).
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
  if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('c1000000-0000-0000-0000-000000000001', 'Project Test Gym', 'INDEPENDENT', 'FONT', false, true);

-- ── Olivier ────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);
update public.sessions set ended_at = now() where ended_at is null;

insert into public.route_projects (id, user_id, gym_id, route_name, route_key, grade)
values ('c2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000001', 'Le Dièdre', 'le diedre', '7a');
select pg_temp.expect_error($$insert into public.route_projects (user_id, gym_id, route_name, route_key, grade)
  values ('00000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000001', 'le diedre', 'le diedre', '7a')$$,
  'one project per route and venue');
select pg_temp.expect_error($$insert into public.route_projects (user_id, gym_id, route_name, route_key, grade)
  values ('00000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000001', 'X', 'x', '7A')$$,
  'route projects use French sport grades only');
select pg_temp.expect_error($$update public.route_projects set status = 'SENT' where id = 'c2000000-0000-0000-0000-000000000001'$$,
  'a sent project needs a send date');

insert into public.sessions (id, user_id, gym_id, discipline)
values ('c3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'c1000000-0000-0000-0000-000000000001', 'ROUTE');
insert into public.route_ascents (user_id, session_id, client_id, route_name, grade, style, result, falls, route_project_id)
values ('00000000-0000-0000-0000-00000000000a', 'c3000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001',
  'Le Dièdre', '7a', 'LEAD', 'TOP_WITH_REST', 3, 'c2000000-0000-0000-0000-000000000001');
update public.route_projects set status = 'SENT', sent_at = now() where id = 'c2000000-0000-0000-0000-000000000001';
select pg_temp.expect((select status from public.route_projects where id = 'c2000000-0000-0000-0000-000000000001') = 'SENT', 'owner marks a project sent');

insert into public.coach_conversations (user_id, title, route_project_id)
values ('00000000-0000-0000-0000-00000000000a', 'Mon projet', 'c2000000-0000-0000-0000-000000000001');
update public.sessions set ended_at = now() where id = 'c3000000-0000-0000-0000-000000000001';

-- ── Thomas ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);
update public.sessions set ended_at = now() where ended_at is null;
select pg_temp.expect((select count(*) from public.route_projects) = 0, 'route projects are private');
insert into public.sessions (id, user_id, gym_id, discipline)
values ('c3000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'c1000000-0000-0000-0000-000000000001', 'ROUTE');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, route_project_id)
  values ('00000000-0000-0000-0000-00000000000b', 'c3000000-0000-0000-0000-000000000002', gen_random_uuid(), '7a', 'LEAD', 'ATTEMPT',
  'c2000000-0000-0000-0000-000000000001')$$, 'cannot log goes on another climber''s project');
update public.route_projects set notes = 'hijack';
delete from public.route_projects;
update public.sessions set ended_at = now() where id = 'c3000000-0000-0000-0000-000000000002';

reset role;
select pg_temp.expect((select notes from public.route_projects where id = 'c2000000-0000-0000-0000-000000000001') = '',
  'other climbers cannot edit or delete a project');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select count(*) from public.route_projects$$, 'anon cannot read route projects');
reset role;

-- Deleting a project keeps its ascents (unlinked) and the conversation.
delete from public.route_projects where id = 'c2000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) from public.route_ascents where client_id = 'c4000000-0000-0000-0000-000000000001' and route_project_id is null) = 1,
  'ascents survive project deletion');
select pg_temp.expect((select count(*) from public.coach_conversations where title = 'Mon projet' and route_project_id is null) = 1,
  'Patrick conversations survive project deletion');

\echo 'routes_projects.test.sql: all assertions passed'

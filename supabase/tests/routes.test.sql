-- RLS and integrity assertions for route logging.
-- Runs after rls.test.sql in the same database (users ...0a Olivier and ...0b Thomas exist).
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

-- Existing sessions stay bouldering sessions (additive change).
select pg_temp.expect((select count(*) from public.sessions s join public.gyms g on g.id = s.gym_id
  where s.discipline <> 'BOULDER' and g.name not like '%Test Gym') = 0,
  'pre-existing sessions default to BOULDER');

insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('b1000000-0000-0000-0000-000000000001', 'Route Test Gym', 'INDEPENDENT', 'FONT', true, true);

-- ── Olivier ────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);
-- Close any live session left by earlier tests (one live session per climber).
update public.sessions set ended_at = now() where ended_at is null;

insert into public.sessions (id, user_id, gym_id, discipline)
values ('b2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', 'ROUTE');
insert into public.route_ascents (user_id, session_id, client_id, route_name, grade, style, result)
values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'Le dièdre', '6b', 'LEAD', 'ONSIGHT');
insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, falls)
values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000002', '6c', 'TOPROPE', 'TOP_WITH_REST', 2);

select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result)
  values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', '6a', 'LEAD', 'REDPOINT')$$,
  'a retried tap (same client_id) cannot duplicate an ascent');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result)
  values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', gen_random_uuid(), '7A', 'LEAD', 'REDPOINT')$$,
  'Font boulder grades are rejected for routes');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result, falls)
  values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', gen_random_uuid(), '6a', 'LEAD', 'REDPOINT', 1)$$,
  'a clean ascent cannot have falls');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result)
  values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000001', gen_random_uuid(), '6a', 'SOLO', 'REDPOINT')$$,
  'unknown style rejected');
select pg_temp.expect_error($$update public.route_ascents set session_id = session_id
  where client_id = 'b3000000-0000-0000-0000-000000000001'$$, 'an ascent cannot be moved to another session');
update public.route_ascents set grade = '6b+' where client_id = 'b3000000-0000-0000-0000-000000000001';
select pg_temp.expect((select grade from public.route_ascents where client_id = 'b3000000-0000-0000-0000-000000000001') = '6b+',
  'owner can correct the grade');

-- Route ascents only attach to ROUTE sessions.
update public.sessions set ended_at = now() where id = 'b2000000-0000-0000-0000-000000000001';
insert into public.sessions (id, user_id, gym_id) values
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result)
  values ('00000000-0000-0000-0000-00000000000a', 'b2000000-0000-0000-0000-000000000002', gen_random_uuid(), '6a', 'LEAD', 'REDPOINT')$$,
  'route ascents cannot be logged in a bouldering session');
select pg_temp.expect_error($$insert into public.sessions (user_id, gym_id, discipline) values
  ('00000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', 'TRAD')$$, 'unknown discipline rejected');
update public.sessions set ended_at = now() where id = 'b2000000-0000-0000-0000-000000000002';

-- ── Thomas ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) from public.route_ascents) = 0, 'route ascents are private');
select pg_temp.expect_error($$insert into public.route_ascents (user_id, session_id, client_id, grade, style, result)
  values ('00000000-0000-0000-0000-00000000000b', 'b2000000-0000-0000-0000-000000000001', gen_random_uuid(), '6a', 'LEAD', 'REDPOINT')$$,
  'cannot log into another climber''s session');
update public.route_ascents set grade = '9c';
delete from public.route_ascents;

reset role;
select pg_temp.expect((select count(*) from public.route_ascents where session_id = 'b2000000-0000-0000-0000-000000000001') = 2
  and not exists (select 1 from public.route_ascents where grade = '9c'), 'other climbers cannot edit or delete ascents');

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select count(*) from public.route_ascents$$, 'anon cannot read route ascents');
reset role;

delete from public.sessions where id = 'b2000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) from public.route_ascents where session_id = 'b2000000-0000-0000-0000-000000000001') = 0,
  'deleting a session removes its ascents');

\echo 'routes.test.sql: all assertions passed'

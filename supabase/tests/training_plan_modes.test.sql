-- Training plan modes, durations and phases (self-contained).
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

insert into public.beta_users (email, display_name) values ('modes-a@modes.test', 'A'), ('modes-b@modes.test', 'B');
insert into auth.users (id, email) values
  ('f8000000-0000-0000-0000-00000000000a', 'modes-a@modes.test'),
  ('f8000000-0000-0000-0000-00000000000b', 'modes-b@modes.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000a","email":"modes-a@modes.test","role":"authenticated"}', false);

-- A plan saved the old way gets the defaults: manual, its weeks as the duration, no phases.
insert into public.training_plans (id, user_id, name, weeks, sessions)
values ('e8000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-00000000000a', 'Ancien', 4,
  '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]');
select pg_temp.expect((select mode = 'MANUAL' and duration_unit = 'WEEKS' and phases = '[]'::jsonb
  from public.training_plans where id = 'e8000000-0000-0000-0000-000000000001'), 'old-style insert gets the defaults');

-- A year-long plan proposed by Patrick, in phases.
insert into public.training_plans (id, user_id, name, weeks, sessions, mode, duration_value, duration_unit, phases)
values ('e8000000-0000-0000-0000-000000000002', 'f8000000-0000-0000-0000-00000000000a', 'Un an', 52,
  '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]', 'PATRICK', 1, 'YEARS',
  '[{"name":"Base","weeks":26,"sessions":[{"day":1,"methodId":"technique","minutes":60,"notes":""}]},
    {"name":"Force","weeks":26,"sessions":[{"day":2,"methodId":"strength-conditioning","minutes":45,"notes":""}]}]');
select pg_temp.expect((select jsonb_array_length(phases) = 2 from public.training_plans where id = 'e8000000-0000-0000-0000-000000000002'),
  'phases are stored');

select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, mode)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]', 'MAGIC')$$, 'unknown mode');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, duration_value, duration_unit)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]', 6, 'YEARS')$$, 'more than 5 years');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, duration_value, duration_unit)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]', 61, 'MONTHS')$$, 'more than 60 months');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, duration_value, duration_unit)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]', 0, 'WEEKS')$$, 'zero weeks');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, duration_value, duration_unit)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]', 4, 'DAYS')$$, 'unknown unit');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 261, '[{"day":1}]')$$, 'more than 260 weeks');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, phases)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]', '{"name":"not an array"}')$$, 'phases must be an array');
select pg_temp.expect_error($$insert into public.training_plans (user_id, name, weeks, sessions, phases)
  values ('f8000000-0000-0000-0000-00000000000a', 'X', 4, '[{"day":1}]',
    (select jsonb_agg(jsonb_build_object('name', 'P' || i, 'weeks', 1, 'sessions', '[]'::jsonb)) from generate_series(1, 13) i))$$,
  'at most 12 phases');

-- Still private: the other climber sees and changes nothing.
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000b","email":"modes-b@modes.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.training_plans where user_id = 'f8000000-0000-0000-0000-00000000000a'),
  'another climber cannot read the plans');
update public.training_plans set mode = 'ASSISTED' where id = 'e8000000-0000-0000-0000-000000000002';
reset role;
select pg_temp.expect((select mode = 'PATRICK' from public.training_plans where id = 'e8000000-0000-0000-0000-000000000002'),
  'another climber cannot change the mode');

set role anon;
select pg_temp.expect_error($$select count(*) from public.training_plans$$, 'anon cannot read plans');
reset role;

\echo 'training_plan_modes.test.sql: all assertions passed'

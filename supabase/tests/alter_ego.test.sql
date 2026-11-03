-- Alter ego pacts: private to their climber, one open at a time, signed terms frozen (self-contained).
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
insert into public.beta_users (email, display_name) values ('ego-a@ego.test', 'A'), ('ego-b@ego.test', 'B');
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-00000000000a', 'ego-a@ego.test'),
  ('f1000000-0000-0000-0000-00000000000b', 'ego-b@ego.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-00000000000b","email":"ego-b@ego.test","role":"authenticated"}', false);
insert into public.training_plans (id, user_id, name, weeks, sessions)
values ('e3000000-0000-0000-0000-00000000000b', 'f1000000-0000-0000-0000-00000000000b', 'Plan de B', 4, '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]');

select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-00000000000a","email":"ego-a@ego.test","role":"authenticated"}', false);
insert into public.training_plans (id, user_id, name, weeks, sessions)
values ('e3000000-0000-0000-0000-00000000000a', 'f1000000-0000-0000-0000-00000000000a', 'Plan de A', 4, '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]');

insert into public.alter_ego_pacts (id, display_name, plan_id, plan_name, plan_snapshot, progression, start_date, horizon_weeks, start_boulder_grade, target_boulder_grade)
values ('e4000000-0000-0000-0000-00000000000a', 'Double de A', 'e3000000-0000-0000-0000-00000000000a', 'Plan de A',
  '[{"day":1,"methodId":"technique","minutes":60,"notes":""}]', '{"version":1}', '2026-11-02', 12, '6A', '7A');
select pg_temp.expect((select user_id = 'f1000000-0000-0000-0000-00000000000a' from public.alter_ego_pacts where id = 'e4000000-0000-0000-0000-00000000000a'),
  'owner defaults to the signed-in climber');

-- One open pact per climber.
select pg_temp.expect_error($$insert into public.alter_ego_pacts (display_name, plan_name, plan_snapshot, progression, start_date, horizon_weeks)
  values ('Second', 'Plan', '[{"day":1}]', '{}', '2026-11-02', 4)$$, 'a second open pact');

-- A climber cannot sign someone else's plan, or sign for someone else.
update public.alter_ego_pacts set status = 'ABANDONED' where id = 'e4000000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$insert into public.alter_ego_pacts (display_name, plan_id, plan_name, plan_snapshot, progression, start_date, horizon_weeks)
  values ('Vol', 'e3000000-0000-0000-0000-00000000000b', 'Plan', '[{"day":1}]', '{}', '2026-11-02', 4)$$, 'signing another climber''s plan');
select pg_temp.expect_error($$insert into public.alter_ego_pacts (user_id, display_name, plan_name, plan_snapshot, progression, start_date, horizon_weeks)
  values ('f1000000-0000-0000-0000-00000000000b', 'Vol', 'Plan', '[{"day":1}]', '{}', '2026-11-02', 4)$$, 'signing for another climber');

-- A closed pact frees the slot, so a new one can be signed.
insert into public.alter_ego_pacts (id, display_name, plan_name, plan_snapshot, progression, start_date, horizon_weeks)
values ('e4000000-0000-0000-0000-00000000000c', 'Nouveau', 'Plan', '[{"day":1}]', '{}', '2026-11-02', 4);

-- Pausing and resuming are allowed, and the pause state must stay consistent.
update public.alter_ego_pacts set status = 'PAUSED', paused_since = '2026-11-10' where id = 'e4000000-0000-0000-0000-00000000000c';
select pg_temp.expect_error($$update public.alter_ego_pacts set paused_since = null where id = 'e4000000-0000-0000-0000-00000000000c'$$, 'paused without a date');
update public.alter_ego_pacts set status = 'ACTIVE', paused_since = null, paused_days = 3 where id = 'e4000000-0000-0000-0000-00000000000c';
select pg_temp.expect((select paused_days = 3 and status = 'ACTIVE' from public.alter_ego_pacts where id = 'e4000000-0000-0000-0000-00000000000c'), 'resume records the pause');

-- Signed terms are frozen.
select pg_temp.expect_error($$update public.alter_ego_pacts set plan_snapshot = '[]' where id = 'e4000000-0000-0000-0000-00000000000c'$$, 'rewriting the plan');
select pg_temp.expect_error($$update public.alter_ego_pacts set start_date = '2026-01-01' where id = 'e4000000-0000-0000-0000-00000000000c'$$, 'moving the start date');
select pg_temp.expect_error($$update public.alter_ego_pacts set progression = '{}' where id = 'e4000000-0000-0000-0000-00000000000c'$$, 'changing the progression');
select pg_temp.expect_error($$update public.alter_ego_pacts set user_id = 'f1000000-0000-0000-0000-00000000000b' where id = 'e4000000-0000-0000-0000-00000000000c'$$, 'changing the owner');

-- Other climbers see and touch nothing.
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-00000000000b","email":"ego-b@ego.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.alter_ego_pacts), 'another climber sees no pact');
update public.alter_ego_pacts set status = 'ABANDONED' where id = 'e4000000-0000-0000-0000-00000000000c';
delete from public.alter_ego_pacts where id = 'e4000000-0000-0000-0000-00000000000c';

select set_config('request.jwt.claims', '{"sub":"f1000000-0000-0000-0000-00000000000a","email":"ego-a@ego.test","role":"authenticated"}', false);
select pg_temp.expect((select status = 'ACTIVE' from public.alter_ego_pacts where id = 'e4000000-0000-0000-0000-00000000000c'), 'the pact survived the other climber');

-- Deleting the plan keeps the pact and its snapshot.
delete from public.training_plans where id = 'e3000000-0000-0000-0000-00000000000a';
select pg_temp.expect((select plan_id is null and jsonb_array_length(plan_snapshot) = 1 from public.alter_ego_pacts where id = 'e4000000-0000-0000-0000-00000000000a'),
  'the snapshot outlives the plan');
reset role;

-- Anonymous visitors have no access at all.
set role anon;
select pg_temp.expect_error($$select count(*) from public.alter_ego_pacts$$, 'anon cannot read pacts');
reset role;

\echo 'alter_ego.test.sql: all assertions passed'

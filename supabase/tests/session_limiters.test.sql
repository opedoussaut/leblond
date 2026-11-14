-- Session limiters: fixed set only, owner-only through the sessions RLS (self-contained).
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

insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('e7100000-0000-0000-0000-000000000001', 'Limiters Test Gym', 'CLIMBING_DISTRICT', 'CLIMBING_DISTRICT_COLOR', true, true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);
update public.sessions set ended_at = now() where ended_at is null;
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('e7200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'e7100000-0000-0000-0000-000000000001',
        now() - interval '2 hours', now() - interval '1 hour', 60);
reset role;

select pg_temp.expect((select limiters = '{}' from public.sessions where id = 'e7200000-0000-0000-0000-000000000001'), 'empty by default');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
update public.sessions set limiters = array['ENDURANCE', 'PAIN'] where id = 'e7200000-0000-0000-0000-000000000001';
select pg_temp.expect((select limiters = array['ENDURANCE', 'PAIN'] from public.sessions where id = 'e7200000-0000-0000-0000-000000000001'), 'owner can tick limiters');
select pg_temp.expect_error($$update public.sessions set limiters = array['LAZY'] where id = 'e7200000-0000-0000-0000-000000000001'$$, 'unknown limiter refused');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.sessions where id = 'e7200000-0000-0000-0000-000000000001'), 'another climber cannot see them');
update public.sessions set limiters = array['FATIGUE'] where id = 'e7200000-0000-0000-0000-000000000001';
reset role;
select pg_temp.expect((select limiters = array['ENDURANCE', 'PAIN'] from public.sessions where id = 'e7200000-0000-0000-0000-000000000001'), 'another climber cannot change them');

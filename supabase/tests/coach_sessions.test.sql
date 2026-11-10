-- Coach sessions and personal coach keys (self-contained).
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

insert into public.beta_users (email, display_name) values ('coach-a@coach.test', 'A'), ('coach-b@coach.test', 'B');
insert into auth.users (id, email) values
  ('f9000000-0000-0000-0000-00000000000a', 'coach-a@coach.test'),
  ('f9000000-0000-0000-0000-00000000000b', 'coach-b@coach.test');

-- A creates a key; the clear key only exists in the function's result.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","email":"coach-a@coach.test","role":"authenticated"}', false);
select public.create_coach_key('Claude') as key_a \gset
select pg_temp.expect(:'key_a' ~ '^lbk_[0-9a-f]{48}$', 'key format');
select pg_temp.expect((select count(*) = 1 and bool_and(prefix = left(:'key_a', 12)) from public.coach_keys), 'A sees their key, by prefix');
select pg_temp.expect_error($$select key_hash from public.coach_keys$$, 'the hash is not readable');
select pg_temp.expect_error($$insert into public.coach_sessions (user_id, slug, title, minutes, content)
  values ('f9000000-0000-0000-0000-00000000000a', 'x', 'X', 60, '{"exercises":[{}]}')$$, 'no direct insert');
select pg_temp.expect_error($$select public.coach_key_owner('lbk_000000000000000000000000000000000000000000000000')$$, 'internal resolver not callable');
reset role;

-- The key alone (no user session) adds, replaces, lists and removes A's coach sessions.
set role anon;
select set_config('request.jwt.claims', '', false);
select public.coach_key_put_session(:'key_a', 'upper-lower-90', 'Haut et bas · 90 min', 'Genou prudent', 90, 'HOME',
  '{"exercises":[{"block":"MAIN","name":"Tractions"}],"sources":[],"notes":""}') as first_id \gset
select public.coach_key_put_session(:'key_a', 'upper-lower-90', 'Haut et bas · 90 min (v2)', '', 85, 'HOME',
  '{"exercises":[{"block":"MAIN","name":"Tractions"},{"block":"COOLDOWN","name":"Étirements"}]}') as second_id \gset
select pg_temp.expect(:'first_id' = :'second_id', 'same slug replaces the session');
select pg_temp.expect((select count(*) = 1 and bool_and(title like '%(v2)' and minutes = 85) from public.coach_key_list_sessions(:'key_a')), 'list shows the revision');
select pg_temp.expect_error($$select count(*) from public.coach_sessions$$, 'anon cannot read the table');
select pg_temp.expect_error($$select public.coach_key_list_sessions('lbk_000000000000000000000000000000000000000000000000')$$, 'unknown key');
select pg_temp.expect_error($$select public.coach_key_list_sessions('not a key')$$, 'malformed key');
select pg_temp.expect_error(format($$select public.coach_key_put_session(%L, 'Bad Slug', 'X', '', 60, null, '{"exercises":[{}]}')$$, :'key_a'), 'bad slug');
select pg_temp.expect_error(format($$select public.coach_key_put_session(%L, 'empty', 'X', '', 60, null, '{"exercises":[]}')$$, :'key_a'), 'no exercises');
select pg_temp.expect_error(format($$select public.coach_key_put_session(%L, 'long', 'X', '', 600, null, '{"exercises":[{}]}')$$, :'key_a'), 'too long');
select public.coach_key_put_session(:'key_a', 'to-remove', 'X', '', 30, null, '{"exercises":[{}]}');
select pg_temp.expect(public.coach_key_delete_session(:'key_a', 'to-remove'), 'removed');
select pg_temp.expect(not public.coach_key_delete_session(:'key_a', 'to-remove'), 'already gone');
reset role;
select pg_temp.expect((select user_id = 'f9000000-0000-0000-0000-00000000000a' and author = 'CLAUDE'
  from public.coach_sessions where slug = 'upper-lower-90'), 'written for the key owner');
select pg_temp.expect((select calls_count = 6 and last_used_at is not null from public.coach_keys), 'calls are counted');

-- A reads and removes in the app; B sees nothing and cannot revoke A's key.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000b","email":"coach-b@coach.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.coach_sessions), 'B cannot read A''s coach sessions');
select pg_temp.expect((select count(*) = 0 from public.coach_keys), 'B cannot see A''s keys');
select pg_temp.expect(not public.revoke_coach_key((select id from public.coach_keys limit 1)), 'B cannot revoke');
delete from public.coach_sessions;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","email":"coach-a@coach.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 1 from public.coach_sessions), 'A still has the session after B''s delete');
select pg_temp.expect_error($$update public.coach_sessions set title = 'hacked'$$, 'no direct update');
reset role;

-- The daily limit.
update public.coach_keys set calls_day = current_date, calls_count = 300;
set role anon;
select pg_temp.expect_error(format($$select public.coach_key_list_sessions(%L)$$, :'key_a'), 'rate limited');
reset role;
update public.coach_keys set calls_count = 0;

-- Off the whitelist: the key stops working at once.
update public.beta_users set active = false where email = 'coach-a@coach.test';
set role anon;
select pg_temp.expect_error(format($$select public.coach_key_list_sessions(%L)$$, :'key_a'), 'inactive climber');
reset role;
update public.beta_users set active = true where email = 'coach-a@coach.test';

-- Revoked: the key stops working; at most 3 active keys.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","email":"coach-a@coach.test","role":"authenticated"}', false);
select pg_temp.expect(public.revoke_coach_key((select id from public.coach_keys where prefix = left(:'key_a', 12))), 'revoked');
select public.create_coach_key('k1');
select public.create_coach_key('k2');
select public.create_coach_key('k3');
select pg_temp.expect_error($$select public.create_coach_key('k4')$$, 'at most 3 active keys');
reset role;
set role anon;
select pg_temp.expect_error(format($$select public.coach_key_list_sessions(%L)$$, :'key_a'), 'revoked key');
select pg_temp.expect_error($$select public.create_coach_key('anon')$$, 'anon cannot create a key');
reset role;

\echo 'coach_sessions.test.sql: all assertions passed'

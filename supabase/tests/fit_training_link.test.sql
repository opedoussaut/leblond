-- Watch activities filed as training séances (one-step FIT import), self-contained.
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

insert into public.beta_users (email, display_name) values
  ('fit-train-a@fit.test', 'Fit Train A'),
  ('fit-train-b@fit.test', 'Fit Train B')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('f17a0000-0000-0000-0000-00000000000a', 'fit-train-a@fit.test'),
  ('f17a0000-0000-0000-0000-00000000000b', 'fit-train-b@fit.test');
insert into public.gyms (id, name, brand, grading_system, has_bouldering, has_routes)
values ('f17b0000-0000-0000-0000-000000000001', 'FIT Training Test Gym', 'ARKOSE', 'ARKOSE_COLOR', true, true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f17a0000-0000-0000-0000-00000000000a","email":"fit-train-a@fit.test","role":"authenticated"}', false);

insert into public.training_sessions (id, user_id, title, status, started_at, completed_at, actual_minutes)
values ('f17c0000-0000-0000-0000-000000000001', 'f17a0000-0000-0000-0000-00000000000a', 'Renfo', 'COMPLETED',
  '2026-10-01 17:00+00', '2026-10-01 18:00+00', 60);
insert into public.sessions (id, user_id, gym_id, started_at, ended_at, duration_minutes)
values ('f17d0000-0000-0000-0000-000000000001', 'f17a0000-0000-0000-0000-00000000000a', 'f17b0000-0000-0000-0000-000000000001',
  '2026-10-02 16:00+00', '2026-10-02 18:00+00', 120);
insert into public.wearable_activities (id, user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key) values
  ('f17e0000-0000-0000-0000-000000000001', 'f17a0000-0000-0000-0000-00000000000a', 'FIT_IMPORT', 'fit:t1', '2026-10-01 17:00+00', 3600, 't1'),
  ('f17e0000-0000-0000-0000-000000000002', 'f17a0000-0000-0000-0000-00000000000a', 'FIT_IMPORT', 'fit:t2', '2026-10-01 17:01+00', 3500, 't2');

-- 1. Filing an activity as a training séance.
select public.link_training_activity('f17e0000-0000-0000-0000-000000000001', 'f17c0000-0000-0000-0000-000000000001');
select pg_temp.expect((select training_session_id = 'f17c0000-0000-0000-0000-000000000001' and session_id is null
  from public.wearable_activities where id = 'f17e0000-0000-0000-0000-000000000001'), 'the activity is filed as the training séance');

-- 2. One activity per training séance: a second one replaces the first.
select public.link_training_activity('f17e0000-0000-0000-0000-000000000002', 'f17c0000-0000-0000-0000-000000000001');
select pg_temp.expect((select training_session_id is null from public.wearable_activities where id = 'f17e0000-0000-0000-0000-000000000001'),
  'the previous activity leaves the training séance');
select pg_temp.expect((select count(*) = 1 from public.wearable_activities where training_session_id = 'f17c0000-0000-0000-0000-000000000001'),
  'a training séance has at most one activity');
select pg_temp.expect_error($$update public.wearable_activities set training_session_id = 'f17c0000-0000-0000-0000-000000000001'
  where id = 'f17e0000-0000-0000-0000-000000000001'$$, 'a direct second link to the same training séance is refused');

-- 3. Climbing or training, never both.
select pg_temp.expect_error($$update public.wearable_activities set session_id = 'f17d0000-0000-0000-0000-000000000001'
  where id = 'f17e0000-0000-0000-0000-000000000002'$$, 'an activity cannot be climbing and training at once');

-- 4. Moving to a climbing séance takes it off the training séance, and the watch times apply.
select public.link_wearable_activity('f17e0000-0000-0000-0000-000000000002', 'f17d0000-0000-0000-0000-000000000001');
select pg_temp.expect((select session_id = 'f17d0000-0000-0000-0000-000000000001' and training_session_id is null
  from public.wearable_activities where id = 'f17e0000-0000-0000-0000-000000000002'), 'moved to the climbing séance');
select pg_temp.expect((select wearable_activity_id = 'f17e0000-0000-0000-0000-000000000002' and timing_source = 'ACTIVITY'
  and started_at = '2026-10-01 17:01+00' from public.sessions where id = 'f17d0000-0000-0000-0000-000000000001'),
  'the climbing séance takes the watch''s times');

-- 5. And back: the climbing séance keeps its times, now manual, and loses the activity.
select public.link_training_activity('f17e0000-0000-0000-0000-000000000002', 'f17c0000-0000-0000-0000-000000000001');
select pg_temp.expect((select session_id is null and training_session_id = 'f17c0000-0000-0000-0000-000000000001'
  from public.wearable_activities where id = 'f17e0000-0000-0000-0000-000000000002'), 'moved back to the training séance');
select pg_temp.expect((select wearable_activity_id is null and timing_source = 'MANUAL' and started_at = '2026-10-01 17:01+00'
  from public.sessions where id = 'f17d0000-0000-0000-0000-000000000001'), 'the climbing séance keeps its times as manual ones');

-- 6. Unfiling, then deleting the training séance keeps the activity.
select public.link_training_activity('f17e0000-0000-0000-0000-000000000001', 'f17c0000-0000-0000-0000-000000000001');
select public.link_training_activity('f17e0000-0000-0000-0000-000000000001', null);
select pg_temp.expect((select count(*) = 0 from public.wearable_activities where training_session_id = 'f17c0000-0000-0000-0000-000000000001'),
  'unfiling leaves the training séance without activity');
select public.link_training_activity('f17e0000-0000-0000-0000-000000000002', 'f17c0000-0000-0000-0000-000000000001');
delete from public.training_sessions where id = 'f17c0000-0000-0000-0000-000000000001';
select pg_temp.expect((select training_session_id is null from public.wearable_activities where id = 'f17e0000-0000-0000-0000-000000000002'),
  'deleting the training séance keeps the activity, unfiled');

-- 7. Another climber.
insert into public.training_sessions (id, user_id, title, status, started_at, completed_at, actual_minutes)
values ('f17c0000-0000-0000-0000-000000000002', 'f17a0000-0000-0000-0000-00000000000a', 'Yoga', 'COMPLETED',
  '2026-10-03 07:00+00', '2026-10-03 07:30+00', 30);
select set_config('request.jwt.claims', '{"sub":"f17a0000-0000-0000-0000-00000000000b","email":"fit-train-b@fit.test","role":"authenticated"}', false);
insert into public.wearable_activities (id, user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key)
values ('f17e0000-0000-0000-0000-000000000003', 'f17a0000-0000-0000-0000-00000000000b', 'FIT_IMPORT', 'fit:t3', '2026-10-03 07:00+00', 1800, 't3');
select pg_temp.expect_error($$select public.link_training_activity('f17e0000-0000-0000-0000-000000000003', 'f17c0000-0000-0000-0000-000000000002')$$,
  'cannot file an activity as another climber''s training séance');
select pg_temp.expect_error($$update public.wearable_activities set training_session_id = 'f17c0000-0000-0000-0000-000000000002'
  where id = 'f17e0000-0000-0000-0000-000000000003'$$, 'RLS refuses pointing at another climber''s training séance');
select pg_temp.expect_error($$insert into public.wearable_activities (user_id, provider, provider_activity_id, started_at, duration_seconds, dedup_key, training_session_id)
  values ('f17a0000-0000-0000-0000-00000000000b', 'FIT_IMPORT', 'fit:t4', '2026-10-03 07:00+00', 1800, 't4', 'f17c0000-0000-0000-0000-000000000002')$$,
  'RLS refuses inserting an activity on another climber''s training séance');
select pg_temp.expect_error($$select public.link_training_activity('f17e0000-0000-0000-0000-000000000001', null)$$,
  'cannot unfile another climber''s activity');
select pg_temp.expect((select training_session_id is null from public.wearable_activities where id = 'f17e0000-0000-0000-0000-000000000003'),
  'the other climber''s activity stays unfiled');
reset role;
select pg_temp.expect((select count(*) = 0 from public.wearable_activities where training_session_id = 'f17c0000-0000-0000-0000-000000000002'),
  'nothing got filed on the first climber''s yoga séance');
\echo 'fit_training_link.test.sql: all assertions passed'

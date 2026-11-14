-- Board level goals and board problem projects: owner-only, native scale, one goal per board/angle.
-- (Named rls_* to run after rls.test.sql, which creates the test climbers.)
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

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","email":"olivier@example.test","role":"authenticated"}', false);

insert into public.board_goals (id, user_id, board, angle, grade, grade_scale)
values ('0e100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'KILTER', 40, '7A', 'FONT');
insert into public.board_goals (id, user_id, board, angle, grade, grade_scale)
values ('0e100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'KILTER', null, 'V6', 'V');
select pg_temp.expect_error($$insert into public.board_goals (user_id, board, angle, grade, grade_scale)
  values ('00000000-0000-0000-0000-00000000000a', 'KILTER', 40, '7B', 'FONT')$$, 'one goal per board and angle');
select pg_temp.expect_error($$insert into public.board_goals (user_id, board, angle, grade, grade_scale)
  values ('00000000-0000-0000-0000-00000000000a', 'KILTER', null, '7B', 'FONT')$$, 'one any-angle goal per board');
select pg_temp.expect_error($$insert into public.board_goals (user_id, board, grade, grade_scale)
  values ('00000000-0000-0000-0000-00000000000a', 'WOODY', '7A', 'FONT')$$, 'known boards only');
select pg_temp.expect_error($$insert into public.board_goals (user_id, board, grade, grade_scale)
  values ('00000000-0000-0000-0000-00000000000a', 'MOON', '7A', 'YDS')$$, 'Font or V only');
update public.board_goals set grade = '7A+', notes = 'Avant l''été' where id = '0e100000-0000-0000-0000-000000000001';
select pg_temp.expect((select grade = '7A+' from public.board_goals where id = '0e100000-0000-0000-0000-000000000001'), 'owner edits the goal');
select pg_temp.expect_error($$update public.board_goals set board = 'MOON' where id = '0e100000-0000-0000-0000-000000000001'$$,
  'board of a goal is fixed');

insert into public.board_projects (id, user_id, board, climb_name, climb_key, angle, grade, grade_scale)
values ('0e200000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'MOON', 'Test Benchmark', 'test benchmark', 40, '7A', 'FONT');
update public.board_projects set notes = 'Pied gauche haut' where id = '0e200000-0000-0000-0000-000000000001';
select pg_temp.expect((select notes = 'Pied gauche haut' from public.board_projects where id = '0e200000-0000-0000-0000-000000000001'),
  'owner edits board project notes');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","email":"thomas@example.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.board_goals where user_id = '00000000-0000-0000-0000-00000000000a'), 'goals are private');
update public.board_goals set grade = '4a' where id = '0e100000-0000-0000-0000-000000000001';
update public.board_projects set notes = 'Pirate' where id = '0e200000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$insert into public.board_goals (user_id, board, grade, grade_scale)
  values ('00000000-0000-0000-0000-00000000000a', 'TENSION', '7A', 'FONT')$$, 'cannot create a goal for someone else');
reset role;
select pg_temp.expect((select grade = '7A+' from public.board_goals where id = '0e100000-0000-0000-0000-000000000001'), 'another climber cannot edit');
select pg_temp.expect((select notes = 'Pied gauche haut' from public.board_projects where id = '0e200000-0000-0000-0000-000000000001'),
  'another climber cannot edit board projects');

delete from public.board_goals where id in ('0e100000-0000-0000-0000-000000000001', '0e100000-0000-0000-0000-000000000002');
delete from public.board_projects where id = '0e200000-0000-0000-0000-000000000001';

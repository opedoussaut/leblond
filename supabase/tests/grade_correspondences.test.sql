-- The climber's own grade correspondences: owner-only, valid grades, Font order.
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
  ('grade-corr-a@corr.test', 'Corr A'),
  ('grade-corr-b@corr.test', 'Corr B')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('6c0a0000-0000-0000-0000-00000000000a', 'grade-corr-a@corr.test'),
  ('6c0a0000-0000-0000-0000-00000000000b', 'grade-corr-b@corr.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"6c0a0000-0000-0000-0000-00000000000a","email":"grade-corr-a@corr.test","role":"authenticated"}', false);

-- 1. The owner writes, reads and changes their own lines.
insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to) values
  ('CLIMB_WORLD_LEVEL', '4', '6A', '6A+'),
  ('ARKOSE_COLOR', 'RED', '6A+', '6B+');
select pg_temp.expect((select count(*) = 2 from public.grade_correspondences), 'the owner sees their two lines');
select pg_temp.expect((select user_id = '6c0a0000-0000-0000-0000-00000000000a' from public.grade_correspondences where native_grade = '4'),
  'user_id defaults to the caller');
update public.grade_correspondences set font_from = '5c', font_to = '6A' where grade_system = 'CLIMB_WORLD_LEVEL' and native_grade = '4';
select pg_temp.expect((select font_from = '5c' from public.grade_correspondences where native_grade = '4'), 'the owner changes a line');

-- 2. Validation: real native grade, real Font grades, from <= to, no line for Font or custom colours.
select pg_temp.expect_error($$insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to)
  values ('CLIMB_WORLD_LEVEL', '9', '6A', '6A')$$, 'a grade the scale does not have is refused');
select pg_temp.expect_error($$insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to)
  values ('BLOCKOUT_LEVEL', 'B3', '5B', '5c')$$, 'a non-Font grade (wrong casing) is refused');
select pg_temp.expect_error($$insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to)
  values ('BLOCKOUT_LEVEL', 'B3', '6A', '5c')$$, 'from above to is refused');
select pg_temp.expect_error($$insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to)
  values ('FONT', '6A', '6A', '6A')$$, 'Font has no correspondence');
select pg_temp.expect_error($$insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to)
  values ('CUSTOM_COLOR', 'RED', '6A', '6A')$$, 'custom colours have no correspondence');
select pg_temp.expect_error($$insert into public.grade_correspondences (user_id, grade_system, native_grade, font_from, font_to)
  values ('6c0a0000-0000-0000-0000-00000000000b', 'ARKOSE_COLOR', 'BLUE', '5c', '6A')$$, 'a line for someone else is refused');

-- 3. Another climber sees and changes nothing of it.
select set_config('request.jwt.claims', '{"sub":"6c0a0000-0000-0000-0000-00000000000b","email":"grade-corr-b@corr.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.grade_correspondences), 'B sees none of the lines of A');
update public.grade_correspondences set font_from = '3a' where true;
delete from public.grade_correspondences where true;
insert into public.grade_correspondences (grade_system, native_grade, font_from, font_to) values ('CLIMB_WORLD_LEVEL', '4', '6B', '6B');
select pg_temp.expect((select count(*) = 1 from public.grade_correspondences), 'B keeps their own line for the same grade');

-- 4. Anonymous visitors read nothing.
reset role;
set role anon;
select pg_temp.expect_error($$select 1 from public.grade_correspondences$$, 'anon cannot read the table');

reset role;
select pg_temp.expect((select count(*) = 2 from public.grade_correspondences where user_id = '6c0a0000-0000-0000-0000-00000000000a'),
  'the lines of A survived the update and delete of B');
select pg_temp.expect((select font_from = '5c' from public.grade_correspondences
  where user_id = '6c0a0000-0000-0000-0000-00000000000a' and native_grade = '4'), 'the line of A is unchanged');
delete from public.grade_correspondences where user_id::text like '6c0a0000-%';
delete from auth.users where id::text like '6c0a0000-%';

-- Real grading of the catalogue networks (self-contained, read-only).
\set ON_ERROR_STOP 1
create or replace function pg_temp.expect(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if;
end $$;

select pg_temp.expect((select bool_and(grading_system = 'BLOCKOUT_LEVEL') from public.gyms where brand = 'BLOCKOUT' and external_provider is null),
  'Block''Out gyms grade boulders B1–B14');
select pg_temp.expect((select bool_and(grading_system = 'CLIMB_UP_COLOR') from public.gyms where brand = 'CLIMB_UP' and external_provider is null),
  'Climb Up gyms use their own colours');
select pg_temp.expect((select bool_and(grading_system = 'VERTICAL_ART_COLOR') from public.gyms where brand = 'VERTICAL_ART' and external_provider is null),
  'Vertical''Art gyms use their own colours');
select pg_temp.expect((select bool_and(route_grading = 'FRENCH') from public.gyms where has_routes),
  'every catalogue route gym grades routes in French grades');
select pg_temp.expect(public.is_valid_native_grade('BLOCKOUT_LEVEL', 'B14') and not public.is_valid_native_grade('BLOCKOUT_LEVEL', 'B15'),
  'B-levels validated');
select pg_temp.expect(public.is_valid_native_grade('CLIMB_UP_COLOR', 'WHITE') and not public.is_valid_native_grade('CLIMB_UP_COLOR', 'ORANGE'),
  'Climb Up colours validated');
select pg_temp.expect(public.is_valid_native_grade('VERTICAL_ART_COLOR', 'ORANGE') and not public.is_valid_native_grade('VERTICAL_ART_COLOR', 'YELLOW'),
  'Vertical''Art colours validated');
select pg_temp.expect(public.is_valid_native_grade('ARKOSE_COLOR', 'PURPLE') and public.is_valid_native_grade('FONT', '6A'),
  'existing scales unchanged');

\echo 'gym_grading.test.sql: all assertions passed'

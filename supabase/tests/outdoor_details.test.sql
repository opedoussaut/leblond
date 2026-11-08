-- Outdoor details on boulders and routes, route media ownership (self-contained).
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

-- Invited, so the file also passes with sign-up closed to the whitelist.
insert into public.beta_users (email, display_name) values
  ('crag-a@crag.test', 'Crag A'),
  ('crag-b@crag.test', 'Crag B')
on conflict (email) do nothing;
insert into auth.users (id, email) values
  ('f2000000-0000-0000-0000-00000000000a', 'crag-a@crag.test'),
  ('f2000000-0000-0000-0000-00000000000b', 'crag-b@crag.test');

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2000000-0000-0000-0000-00000000000a","email":"crag-a@crag.test","role":"authenticated"}', false);

-- A climber adds a crag (boulders + routes) with a link to its guide page.
insert into public.gyms (id, name, brand, city, country, grading_system, has_bouldering, has_routes, source_url, created_by)
values ('e9000000-0000-0000-0000-000000000001', 'Falaise Test Gym', 'OUTDOOR', 'Saffres', 'FR', 'FONT', true, true,
  'https://example.org/topo/saffres', 'f2000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$insert into public.gyms (name, brand, country, grading_system, source_url, created_by)
  values ('Lien douteux', 'OUTDOOR', 'FR', 'FONT', 'javascript:alert(1)', 'f2000000-0000-0000-0000-00000000000a')$$,
  'a site link must be a web address');

-- Boulder outside the topo: sector (wall_zone), beta, topo reference and link.
insert into public.problems (id, gym_id, created_by, native_grade, native_grade_system, name, wall_zone, beta, topo_ref, topo_url)
values ('ea000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a',
  '6B', 'FONT', 'La Fissure', 'Secteur Nord', 'Talon gauche puis jeté', 'Topo 2019 p. 34 n° 12', 'https://example.org/p/12');
select pg_temp.expect((select beta = 'Talon gauche puis jeté' and wall_zone = 'Secteur Nord' from public.problems
  where id = 'ea000000-0000-0000-0000-000000000001'), 'boulder details stored');
select pg_temp.expect_error($$update public.problems set topo_url = 'http://example.org' where id = 'ea000000-0000-0000-0000-000000000001'$$,
  'topo link must be https');
select pg_temp.expect_error($$update public.problems set beta = repeat('x', 2001) where id = 'ea000000-0000-0000-0000-000000000001'$$,
  'beta is at most 2000 characters');
update public.problems set native_grade = '6B+' where id = 'ea000000-0000-0000-0000-000000000001';

-- Route ascent with every detail, editable afterwards; notes up to 2000 characters.
insert into public.sessions (id, user_id, gym_id, discipline, started_at, ended_at, duration_minutes)
values ('eb000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a', 'e9000000-0000-0000-0000-000000000001',
  'ROUTE', '2026-10-10 09:00+00', '2026-10-10 13:00+00', 240);
insert into public.route_ascents (id, user_id, session_id, client_id, route_name, grade, style, result, tries, notes)
values ('ec000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a', 'eb000000-0000-0000-0000-000000000001',
  gen_random_uuid(), 'Le Pilier', '6b', 'LEAD', 'REDPOINT', 3, repeat('n', 1500));
update public.route_ascents set sector = 'Grande face', beta = 'Repos au 3e point', topo_ref = 'Topo p. 80',
  topo_url = 'https://example.org/r/80', grade = '6b+', route_name = 'Le Pilier direct', notes = repeat('m', 2000)
  where id = 'ec000000-0000-0000-0000-000000000001';
select pg_temp.expect((select sector = 'Grande face' and grade = '6b+' and char_length(notes) = 2000 from public.route_ascents
  where id = 'ec000000-0000-0000-0000-000000000001'), 'route details edited afterwards');
select pg_temp.expect_error($$update public.route_ascents set notes = repeat('m', 2001) where id = 'ec000000-0000-0000-0000-000000000001'$$,
  'route notes are at most 2000 characters');
select pg_temp.expect_error($$update public.route_ascents set topo_url = 'ftp://example.org' where id = 'ec000000-0000-0000-0000-000000000001'$$,
  'route topo link must be https');

-- Photos and videos on the climber's own route ascent.
insert into public.media (user_id, route_ascent_id, session_id, media_type, storage_path, mime_type, size_bytes)
values ('f2000000-0000-0000-0000-00000000000a', 'ec000000-0000-0000-0000-000000000001', 'eb000000-0000-0000-0000-000000000001',
  'SEND_VIDEO', 'f2000000-0000-0000-0000-00000000000a/ec000000-0000-0000-0000-000000000001/v.mp4', 'video/mp4', 1000);
select pg_temp.expect((select count(*) = 1 from public.media where route_ascent_id = 'ec000000-0000-0000-0000-000000000001'),
  'route media stored');

-- Another climber cannot attach media to them, nor see them.
select set_config('request.jwt.claims', '{"sub":"f2000000-0000-0000-0000-00000000000b","email":"crag-b@crag.test","role":"authenticated"}', false);
select pg_temp.expect_error($$insert into public.media (user_id, route_ascent_id, media_type, storage_path, mime_type, size_bytes)
  values ('f2000000-0000-0000-0000-00000000000b', 'ec000000-0000-0000-0000-000000000001', 'ATTEMPT_VIDEO',
  'f2000000-0000-0000-0000-00000000000b/ec000000-0000-0000-0000-000000000001/x.mp4', 'video/mp4', 10)$$,
  'cannot attach media to another climber''s route ascent');
select pg_temp.expect_error($$insert into public.media (user_id, problem_id, media_type, storage_path, mime_type, size_bytes)
  values ('f2000000-0000-0000-0000-00000000000b', 'ea000000-0000-0000-0000-000000000001', 'PROBLEM_PHOTO',
  'f2000000-0000-0000-0000-00000000000b/ea000000-0000-0000-0000-000000000001/x.jpg', 'image/jpeg', 10)$$,
  'cannot attach media to another climber''s problem');
select pg_temp.expect((select count(*) = 0 from public.media where route_ascent_id = 'ec000000-0000-0000-0000-000000000001'),
  'route media are private');
select pg_temp.expect((select count(*) = 0 from public.route_ascents where id = 'ec000000-0000-0000-0000-000000000001'),
  'route ascents are private');
-- The crag itself is shared, like gyms.
select pg_temp.expect((select count(*) = 1 from public.gyms where id = 'e9000000-0000-0000-0000-000000000001'),
  'climber-added crags are visible to other testers');

-- Deleting the ascent removes its media rows.
select set_config('request.jwt.claims', '{"sub":"f2000000-0000-0000-0000-00000000000a","email":"crag-a@crag.test","role":"authenticated"}', false);
delete from public.route_ascents where id = 'ec000000-0000-0000-0000-000000000001';
select pg_temp.expect((select count(*) = 0 from public.media where route_ascent_id = 'ec000000-0000-0000-0000-000000000001'),
  'media follow their route ascent');
reset role;
\echo 'outdoor_details.test.sql: all assertions passed'

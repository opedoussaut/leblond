-- Richer outdoor logging (boulders and routes), editable afterwards.
--  * Boulders: problems keep using wall_zone for the sector; they gain beta and
--    an optional topo reference (free text) and link to the original source.
--  * Routes: route_ascents gain sector, beta, topo reference and link; notes
--    grow to 2000 characters like problems; every descriptive field is editable.
--  * Media (photos / videos) can belong to a route ascent, owned by the climber.
-- No new table: the topo reference is a citation (e.g. "Topo Dampierre 2019, p. 34 n° 12"),
-- never a copy of a guidebook illustration.

alter table public.problems
  add column beta text check (beta is null or char_length(beta) <= 2000),
  add column topo_ref text check (topo_ref is null or char_length(topo_ref) <= 160),
  add column topo_url text check (topo_url is null or (char_length(topo_url) <= 500 and topo_url ~ '^https://'));

alter table public.route_ascents
  add column sector text check (sector is null or char_length(sector) <= 120),
  add column beta text check (beta is null or char_length(beta) <= 2000),
  add column topo_ref text check (topo_ref is null or char_length(topo_ref) <= 160),
  add column topo_url text check (topo_url is null or (char_length(topo_url) <= 500 and topo_url ~ '^https://'));

-- Notes: 500 → 2000 characters (the inline check has a generated name).
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    where con.conrelid = 'public.route_ascents'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%char_length(notes)%'
  loop
    execute format('alter table public.route_ascents drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.route_ascents add constraint route_ascents_notes_length check (char_length(notes) <= 2000);

grant update (sector, beta, topo_ref, topo_url) on public.route_ascents to authenticated;

-- Outdoor site guide link entered by climbers: a web address (new rows only).
alter table public.gyms
  add constraint gyms_source_url_https check (source_url is null or source_url ~ '^https?://') not valid;

-- Media on route ascents.
alter table public.media
  add column route_ascent_id uuid references public.route_ascents (id) on delete cascade;
create index media_route_ascent_idx on public.media (route_ascent_id);
alter table public.media drop constraint media_has_subject;
alter table public.media add constraint media_has_subject
  check (session_id is not null or problem_id is not null or route_ascent_id is not null);

-- A climber attaches media only to their own route ascents and problems.
drop policy media_all on public.media;
create policy media_all on public.media for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (route_ascent_id is null or exists (
      select 1 from public.route_ascents r where r.id = route_ascent_id and r.user_id = auth.uid()))
    and (problem_id is null or exists (
      select 1 from public.problems p where p.id = problem_id and p.created_by = auth.uid()))
  );

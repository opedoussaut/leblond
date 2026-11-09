-- LEBLOND: a team topo can hold boulders without a map position.
-- The written list of a site (circuits, numbers, names, grades) is the
-- reference; the Google My Maps pins only give positions. A boulder of the
-- list that has no pin yet is listed in the picker but not drawn on the map.
-- Boolder rows always have a position.
alter table public.outdoor_problems alter column latitude drop not null;
alter table public.outdoor_problems alter column longitude drop not null;
alter table public.outdoor_problems add constraint outdoor_problems_position_known
  check (source = 'LEBLOND' or (latitude is not null and longitude is not null));
alter table public.outdoor_problems add constraint outdoor_problems_position_pair
  check ((latitude is null) = (longitude is null));

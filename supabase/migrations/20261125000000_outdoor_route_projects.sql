-- Route projects outdoors: the same details as an outdoor boulder project.
-- Purely additive: nullable columns (wall_angle has a default), extra column grants.
--  * sector: the crag's sector / wall ("Secteur des Dalles").
--  * wall_angle: slab / vertical / overhang… (same enum as boulders).
--  * beta: how the route goes, as the climber wants to remember it.
--  * topo_ref / topo_url: a citation of the guidebook and a link to the source page,
--    never a copy of a guidebook illustration (same rules as problems / route_ascents).
-- RLS is unchanged: route_projects stay owner-only (policies of 20261022000000).

alter table public.route_projects
  add column sector text check (sector is null or char_length(sector) <= 120),
  add column wall_angle public.wall_angle not null default 'UNKNOWN',
  add column beta text check (beta is null or char_length(beta) <= 2000),
  add column topo_ref text check (topo_ref is null or char_length(topo_ref) <= 160),
  add column topo_url text check (topo_url is null or (char_length(topo_url) <= 500 and topo_url ~ '^https://'));

grant update (sector, wall_angle, beta, topo_ref, topo_url) on public.route_projects to authenticated;

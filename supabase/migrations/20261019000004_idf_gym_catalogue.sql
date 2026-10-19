-- Île-de-France official climbing venue catalogue (reviewed 2026-10-19).
-- Sources:
-- https://arkose.com/ou-grimper
-- https://www.blockout.fr/ou-grimper/
-- https://www.vertical-art.fr/escalade-paris/
-- https://www.climb-up.fr/les-salles/
-- https://climbingdistrict.com/nos-salles/
-- These flags describe actual venue activities, not the user's preferred
-- disciplines. Older gym rows remain accessible, defaulting to boulder-only.
-- grade_system continues to describe the existing BOULDER problem logging
-- interface. Route grade logging is a separate future feature.
alter type public.gym_brand add value if not exists 'CLIMB_UP';
alter type public.gym_brand add value if not exists 'VERTICAL_ART';

alter table public.gyms
  add column if not exists has_bouldering boolean not null default true,
  add column if not exists has_routes boolean not null default false,
  add column if not exists source_url text;

alter table public.gyms add constraint gyms_has_discipline
  check (has_bouldering or has_routes);

comment on column public.gyms.has_bouldering is 'This facility offers bouldering.';
comment on column public.gyms.has_routes is 'This facility offers roped climbing or automatic belay routes.';
comment on column public.gyms.source_url is 'Official network directory used to verify the venue and disciplines.';

-- The official venue rows are inserted by 20261019000005, after the
-- enum changes in this migration have committed. PostgreSQL does not allow
-- newly added enum labels to be used in the same transaction.

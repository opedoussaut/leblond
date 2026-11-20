-- Climb World (Paris 14e, Les Ateliers Gaîté, 80 avenue du Maine), a bouldering
-- gym opened in 2026, so climbers can log sessions there. Catalogue data only.
-- Its site (checked 2026-11-20) lists bouldering only, no roped routes, and
-- publishes no grade scale: boulders are logged with the generic colours
-- (CUSTOM_COLOR) until its own scale is known. Same upsert as the venue
-- directory, which keeps an existing row's UUID.
insert into public.gyms (name, brand, city, country, grading_system, has_bouldering, has_routes, source_url)
values ('Climb World', 'INDEPENDENT'::public.gym_brand, 'Paris 14e', 'FR', 'CUSTOM_COLOR'::public.grade_system, true, false, 'https://climb-world.fr/la-salle')
on conflict (brand, lower(name)) where external_provider is null do update set
  city = excluded.city,
  grading_system = excluded.grading_system,
  has_bouldering = excluded.has_bouldering,
  has_routes = excluded.has_routes,
  source_url = excluded.source_url,
  active = true;

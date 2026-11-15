-- Arkose Toulouse (bouldering, Arkose colours), so climbers can log or import
-- sessions there. Catalogue data only; same upsert as the venue directory,
-- which keeps an existing row's UUID.
insert into public.gyms (name, brand, city, country, grading_system, has_bouldering, has_routes, source_url)
values ('Arkose Toulouse', 'ARKOSE'::public.gym_brand, 'Toulouse', 'FR', 'ARKOSE_COLOR'::public.grade_system, true, false, 'https://arkose.com/ou-grimper')
on conflict (brand, lower(name)) where external_provider is null do update set
  city = excluded.city,
  has_bouldering = excluded.has_bouldering,
  has_routes = excluded.has_routes,
  source_url = excluded.source_url,
  active = true;

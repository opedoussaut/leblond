-- Outdoor sites beyond Boolder's Fontainebleau catalogue. One row per site and no
-- topo: the climber logs by Font grade, and source_url links to the reference page.
-- external_provider keeps them out of the gym list. Data only.
insert into public.gyms (name, brand, city, country, grading_system, has_bouldering, has_routes, source_url, external_provider, external_id)
values
  ('Dampierre Maincourt', 'OUTDOOR'::public.gym_brand, 'Dampierre-en-Yvelines', 'FR', 'FONT'::public.grade_system, true, false,
   'https://bleau.info/maincourt', 'LEBLOND', 'dampierre-maincourt')
on conflict (external_provider, external_id) do update set
  name = excluded.name,
  city = excluded.city,
  source_url = excluded.source_url;

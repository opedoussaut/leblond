-- Le Labo (Grenoble) and MROC Laennec (Lyon), each with its own colour scale,
-- easiest first as their statistics pages list them:
--   Le Labo       vert clair, vert foncé, jaune, orange, rouge, violet, bleu, noir
--   MROC Laennec  jaune, vert, bleu, violet, rouge, noir
-- Never converted to another gym's colours.

create or replace function public.is_valid_native_grade(p_system public.grade_system, p_grade text) returns boolean
language sql immutable as $$
  select case p_system
    when 'ARKOSE_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'CLIMBING_DISTRICT_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE','PINK'])
    when 'CLIMBING_DISTRICT_LEVEL' then p_grade = any (array['1','2','3','4','5','6','7','8','9','10','11','12'])
    when 'FONT' then p_grade = any (public.font_grades())
    when 'CUSTOM_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','PINK','PURPLE','BLACK','GREY','BROWN'])
    when 'UNKNOWN' then p_grade = 'UNKNOWN'
    when 'BLOCKOUT_LEVEL' then p_grade = any (array['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14'])
    when 'CLIMB_UP_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','PURPLE','RED','WHITE','BLACK'])
    when 'VERTICAL_ART_COLOR' then p_grade = any (array['WHITE','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'LELABO_COLOR' then p_grade = any (array['LIGHT_GREEN','DARK_GREEN','YELLOW','ORANGE','RED','PURPLE','BLUE','BLACK'])
    when 'MROC_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','PURPLE','RED','BLACK'])
  end
$$;

alter table public.gyms drop constraint gyms_brand_system;
alter table public.gyms add constraint gyms_brand_system check (
  (brand = 'ARKOSE' and grading_system = 'ARKOSE_COLOR')
  or (brand = 'CLIMBING_DISTRICT' and grading_system in ('CLIMBING_DISTRICT_LEVEL', 'CLIMBING_DISTRICT_COLOR'))
  or (brand = 'BLOCKOUT' and grading_system in ('BLOCKOUT_LEVEL', 'FONT'))
  or (brand = 'CLIMB_UP' and grading_system in ('CLIMB_UP_COLOR', 'FONT'))
  or (brand = 'VERTICAL_ART' and grading_system in ('VERTICAL_ART_COLOR', 'FONT'))
  or (brand = 'INDEPENDENT' and grading_system in ('LELABO_COLOR', 'MROC_COLOR'))
  or (brand not in ('ARKOSE', 'CLIMBING_DISTRICT', 'BLOCKOUT', 'CLIMB_UP', 'VERTICAL_ART')
      and grading_system in ('FONT', 'CUSTOM_COLOR', 'UNKNOWN'))
);

insert into public.gyms (name, brand, city, country, grading_system, has_bouldering, has_routes, source_url)
values
  ('Le Labo Grenoble', 'INDEPENDENT'::public.gym_brand, 'Grenoble', 'FR', 'LELABO_COLOR'::public.grade_system, true, false, 'https://arkose.com/labo'),
  ('MROC Laennec', 'INDEPENDENT'::public.gym_brand, 'Lyon', 'FR', 'MROC_COLOR'::public.grade_system, true, false, null)
on conflict (brand, lower(name)) where external_provider is null do update set
  city = excluded.city,
  grading_system = excluded.grading_system,
  has_bouldering = excluded.has_bouldering,
  has_routes = excluded.has_routes,
  source_url = coalesce(excluded.source_url, public.gyms.source_url),
  active = true;

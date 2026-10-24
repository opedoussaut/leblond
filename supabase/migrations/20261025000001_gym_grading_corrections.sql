-- Correct each network's real grading, and separate route grading from bouldering grading.
--
--   Arkose            bloc: 6 colours            voie: French grades
--   Climbing District bloc: 8 colours + pink     voie: French grades
--   Block'Out         bloc: levels B1 → B14
--   Climb Up          bloc: 7 colours (jaune, vert, bleu, violet, rouge, blanc, noir)   voie: French grades 3 → 9c
--   Vertical'Art      bloc: 7 colours (blanc, orange, vert, bleu, rouge, noir, violet)
--
-- Existing problems keep the grade and system they were logged with: only the
-- gyms' current scale changes, so history is never rewritten.

create or replace function public.is_valid_native_grade(p_system public.grade_system, p_grade text) returns boolean
language sql immutable as $$
  select case p_system
    when 'ARKOSE_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'CLIMBING_DISTRICT_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE','PINK'])
    when 'FONT' then p_grade = any (public.font_grades())
    when 'CUSTOM_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','PINK','PURPLE','BLACK','GREY','BROWN'])
    when 'UNKNOWN' then p_grade = 'UNKNOWN'
    when 'BLOCKOUT_LEVEL' then p_grade = any (array['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14'])
    when 'CLIMB_UP_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','PURPLE','RED','WHITE','BLACK'])
    when 'VERTICAL_ART_COLOR' then p_grade = any (array['WHITE','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE'])
  end
$$;

-- How a gym grades its ROUTES. Every route gym in the catalogue uses French grades.
alter table public.gyms
  add column route_grading text not null default 'FRENCH' check (route_grading in ('FRENCH','GYM_COLOR'));
comment on column public.gyms.route_grading is
  'FRENCH: routes graded 3a–9c. GYM_COLOR: routes graded with the gym colours (grading_system), French grade kept as the climber''s equivalent.';

update public.gyms set grading_system = 'BLOCKOUT_LEVEL'
  where brand = 'BLOCKOUT' and external_provider is null and grading_system = 'FONT';
update public.gyms set grading_system = 'CLIMB_UP_COLOR'
  where brand = 'CLIMB_UP' and external_provider is null and grading_system = 'FONT';
update public.gyms set grading_system = 'VERTICAL_ART_COLOR'
  where brand = 'VERTICAL_ART' and external_provider is null and grading_system = 'FONT';

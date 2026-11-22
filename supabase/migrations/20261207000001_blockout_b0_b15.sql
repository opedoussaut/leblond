-- Block'Out levels B0 and B15 (2026-11-22): Kaskad's observed Block'Out table (kaskadcoaching.com,
-- not an official norm) runs B0 → B15, one level below and one above the B1 → B14 the gym's
-- site lists. Accepting both lets a climber log them; existing grades are untouched.
-- Mirrors lib/grading/systems.ts (BLOCKOUT_GRADES). Additive only.

create or replace function public.is_valid_native_grade(p_system public.grade_system, p_grade text) returns boolean
language sql immutable as $$
  select case p_system
    when 'ARKOSE_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'CLIMBING_DISTRICT_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE','PINK'])
    when 'CLIMBING_DISTRICT_LEVEL' then p_grade = any (array['1','2','3','4','5','6','7','8','9','10','11','12'])
    when 'FONT' then p_grade = any (public.font_grades())
    when 'CUSTOM_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','PINK','PURPLE','BLACK','GREY','BROWN'])
    when 'UNKNOWN' then p_grade = 'UNKNOWN'
    when 'BLOCKOUT_LEVEL' then p_grade = any (array['B0','B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12','B13','B14','B15'])
    when 'CLIMB_UP_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','PURPLE','RED','WHITE','BLACK'])
    when 'VERTICAL_ART_COLOR' then p_grade = any (array['WHITE','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'LELABO_COLOR' then p_grade = any (array['LIGHT_GREEN','DARK_GREEN','YELLOW','ORANGE','RED','PURPLE','BLUE','BLACK'])
    when 'MROC_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','PURPLE','RED','BLACK'])
    when 'CLIMB_WORLD_LEVEL' then p_grade = any (array['1','2','3','4','5','6','7'])
  end
$$;

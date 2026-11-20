-- Climb World's own bouldering scale (value only; used by the next migration):
-- levels 1 (Débutant) to 7 (Élite), as the gym names them.
alter type public.grade_system add value if not exists 'CLIMB_WORLD_LEVEL';

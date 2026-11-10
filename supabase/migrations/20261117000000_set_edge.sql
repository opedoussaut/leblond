-- The edge a hang or no-hang set was done on (mm), e.g. 12 or 20, so finger
-- work stays comparable from one session to the next. Optional, per set.
alter table public.training_exercise_sets
  add column edge_mm smallint check (edge_mm is null or edge_mm between 3 and 60);
grant update (edge_mm) on public.training_exercise_sets to authenticated;

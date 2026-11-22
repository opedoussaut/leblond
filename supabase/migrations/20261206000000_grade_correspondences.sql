-- The climber's own grade correspondences (asked 2026-11-22): Progrès reads every
-- boulder on the Font scale through a conversion table (lib/grading/harmonise.ts).
-- The defaults live in code; a row here replaces the default line for one native
-- grade of one scale, for this climber only.
--
-- Native grades are never touched: problems.native_grade stays what was logged.
-- A row only says "for me, this colour / level reads as font_from–font_to".
-- Font itself, custom colours (their order differs per gym) and UNKNOWN have no
-- line. Additive only.

create table public.grade_correspondences (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  grade_system public.grade_system not null,
  native_grade text not null,
  font_from text not null,
  font_to text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, grade_system, native_grade),
  constraint grade_correspondences_system check (grade_system not in ('FONT', 'CUSTOM_COLOR', 'UNKNOWN')),
  constraint grade_correspondences_native check (public.is_valid_native_grade(grade_system, native_grade)),
  constraint grade_correspondences_font check (font_from = any (public.font_grades()) and font_to = any (public.font_grades())),
  constraint grade_correspondences_order check (
    array_position(public.font_grades(), font_from) <= array_position(public.font_grades(), font_to))
);

comment on table public.grade_correspondences is
  'Per-climber override of the default native grade → Font correspondence (an estimate for Progrès). Never written over native grades.';

alter table public.grade_correspondences enable row level security;
revoke all on public.grade_correspondences from anon, authenticated;
grant select, insert, delete on public.grade_correspondences to authenticated;
grant update (font_from, font_to, updated_at) on public.grade_correspondences to authenticated;

create policy grade_correspondences_select on public.grade_correspondences for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy grade_correspondences_insert on public.grade_correspondences for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy grade_correspondences_update on public.grade_correspondences for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy grade_correspondences_delete on public.grade_correspondences for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

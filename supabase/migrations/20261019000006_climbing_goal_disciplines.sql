-- Independent climbing targets. Existing target_grade / target_grade_system
-- remain the bouldering target for the established bouldering analytics.
-- Routes never reuse or infer a bouldering grade.
alter table public.profiles
  add column target_discipline text not null default 'BOULDER',
  add column target_route_grade text;

alter table public.profiles
  add constraint profiles_target_discipline_valid
  check (target_discipline in ('BOULDER','ROUTE','BOTH'));

alter table public.profiles
  add constraint profiles_target_route_grade_valid
  check (
    target_route_grade is null
    or target_route_grade = any (array[
      '3a','3b','3c','4a','4b','4c',
      '5a','5a+','5b','5b+','5c','5c+',
      '6a','6a+','6b','6b+','6c','6c+',
      '7a','7a+','7b','7b+','7c','7c+',
      '8a','8a+','8b','8b+','8c','8c+',
      '9a','9a+','9b','9b+','9c'
    ])
  );

alter table public.profiles
  add constraint profiles_active_route_goal_required
  check (target_discipline = 'BOULDER' or target_route_grade is not null);

comment on column public.profiles.target_discipline is
  'Chosen objective: bouldering, routes, or both. All pre-existing targets remain bouldering.';
comment on column public.profiles.target_route_grade is
  'Independent French sport-climbing target, with no boulder-grade conversion.';

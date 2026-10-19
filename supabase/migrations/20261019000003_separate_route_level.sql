-- Store a climber's route self-assessment independently from bouldering.
-- Existing self_reported_level and self_reported_level_system continue to
-- represent the bouldering level, preserving all existing analytics.
alter table public.profiles
  add column self_reported_route_grade text;

alter table public.profiles
  add constraint profiles_route_level_valid
  check (
    self_reported_route_grade is null
    or self_reported_route_grade = any (array[
      '3a','3b','3c','4a','4b','4c',
      '5a','5a+','5b','5b+','5c','5c+',
      '6a','6a+','6b','6b+','6c','6c+',
      '7a','7a+','7b','7b+','7c','7c+',
      '8a','8a+','8b','8b+','8c','8c+',
      '9a','9a+','9b','9b+','9c'
    ])
  );

comment on column public.profiles.self_reported_route_grade is
  'Optional current lead/top-rope grade in French sport scale; independent from Font bouldering level. No automatic grade conversions.';

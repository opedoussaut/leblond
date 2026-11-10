-- Training plans: three ways to build one, durations in weeks, months or years,
-- and phases for long plans. Purely additive: existing plans keep their weekly
-- template (`sessions`) and become one phase of `weeks` weeks.
--
--   mode            MANUAL (the climber builds it), ASSISTED (app hints while
--                   building), PATRICK (Patrick proposed it, the climber reviewed it)
--   duration_value  the duration as the climber entered it ("6" months)
--   duration_unit   WEEKS | MONTHS | YEARS
--   phases          [{name, weeks, sessions:[…]}] in order; empty = one phase
--                   made of `sessions` for `weeks` weeks (plans saved before this)
--   sessions        stays the FIRST phase's weekly template, so every existing
--                   reader (programme, scheduling, alter ego) keeps working
--   weeks           total length in weeks, now up to 5 years

alter table public.training_plans
  add column mode text not null default 'MANUAL' check (mode in ('MANUAL', 'ASSISTED', 'PATRICK')),
  add column duration_value integer not null default 4,
  add column duration_unit text not null default 'WEEKS' check (duration_unit in ('WEEKS', 'MONTHS', 'YEARS')),
  add column phases jsonb not null default '[]'::jsonb
    check (jsonb_typeof(phases) = 'array' and jsonb_array_length(phases) <= 12);

-- Existing plans: their duration is their number of weeks. Not a user edit, so
-- updated_at (the order plans are listed in) is left alone.
alter table public.training_plans disable trigger training_plans_updated_at;
update public.training_plans set duration_value = weeks;
alter table public.training_plans enable trigger training_plans_updated_at;

alter table public.training_plans
  add constraint training_plans_duration_range check (
    (duration_unit = 'WEEKS' and duration_value between 1 and 260)
    or (duration_unit = 'MONTHS' and duration_value between 1 and 60)
    or (duration_unit = 'YEARS' and duration_value between 1 and 5)
  );

alter table public.training_plans drop constraint training_plans_weeks_check;
alter table public.training_plans add constraint training_plans_weeks_check check (weeks between 1 and 260);

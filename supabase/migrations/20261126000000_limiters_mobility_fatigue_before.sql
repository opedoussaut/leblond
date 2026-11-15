-- Session summary: two more limiters (flexibility, mobility) and a fatigue
-- scale before the session; the existing `fatigue` column is the one felt after.
-- Additive only; the existing sessions RLS policy covers both columns.

alter table public.sessions drop constraint sessions_limiters_check;
alter table public.sessions add constraint sessions_limiters_check
  check (limiters <@ array['STRENGTH', 'ENDURANCE', 'TECHNIQUE', 'FLEXIBILITY', 'MOBILITY', 'ENGAGEMENT', 'PAIN', 'FATIGUE']::text[]
         and cardinality(limiters) <= 8);

alter table public.sessions add column fatigue_before smallint check (fatigue_before between 1 and 5);
comment on column public.sessions.fatigue is 'Fatigue felt after the session, 1 = low … 5 = high (self-reported).';
comment on column public.sessions.fatigue_before is 'Fatigue felt before the session, 1 = low … 5 = high (self-reported).';

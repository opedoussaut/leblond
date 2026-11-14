-- What held the climber back in a climbing session, ticked in its summary
-- (strength, endurance, technique, engagement, pain, fatigue). Self-reported,
-- a short list from a fixed set; the existing sessions RLS policy covers it.

alter table public.sessions add column limiters text[] not null default '{}';
alter table public.sessions add constraint sessions_limiters_check
  check (limiters <@ array['STRENGTH', 'ENDURANCE', 'TECHNIQUE', 'ENGAGEMENT', 'PAIN', 'FATIGUE']::text[]
         and cardinality(limiters) <= 6);

-- Any programme can be the one in progress.
--
-- Until now the "programme en cours" was always the one built by the latest full
-- assessment. A climber now chooses which programme they follow; followed_since
-- is the day they started it (week 1). One followed programme per climber; hip
-- mobility keeps running alongside (it is an enrolment, not a training_plans row).
-- Additive: programmes already in progress are marked as followed, from the same date.

alter table public.training_plans add column followed_since date;
create unique index training_plans_one_followed on public.training_plans (user_id) where followed_since is not null;
comment on column public.training_plans.followed_since is
  'Set on the one programme the climber follows: the local day it started. Null on every other programme.';

-- Keep what is in progress today: the programme of each climber's latest full assessment.
with latest as (
  select distinct on (user_id) id, user_id, created_at
  from public.training_assessments
  order by user_id, created_at desc
), chosen as (
  select distinct on (p.user_id) p.id, (l.created_at at time zone 'Europe/Paris')::date as since
  from latest l
  join public.training_plans p on p.assessment_id = l.id and p.user_id = l.user_id
  order by p.user_id, p.updated_at desc
)
update public.training_plans p set followed_since = c.since from chosen c where p.id = c.id;

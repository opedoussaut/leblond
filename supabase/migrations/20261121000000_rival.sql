-- The rival: the alter ego gets a face, a voice and a level.
--
-- * portrait: one of LEBLOND's own drawn portraits.
-- * tone: how it talks (friendly, sharp, merciless). It never comments on a body or an injury.
-- * level: REACH never gets more than one séance and 10 % ahead of the climber;
--   RELENTLESS follows the signed programme exactly (the behaviour until now);
--   GOAL keeps the grade pace that reaches the goal on goal_date.
-- * chase_projects: whether it may "send" the climber's open projects in its feed.
-- Its séances, messages and weekly duels are still derived from the pact and the
-- date: nothing is stored and nothing runs in the background. Additive only.

alter table public.alter_ego_pacts
  add column portrait text not null default 'p1' check (portrait in ('p1', 'p2', 'p3', 'p4', 'p5', 'p6')),
  add column tone text not null default 'PIQUANT' check (tone in ('SYMPA', 'PIQUANT', 'SANS_PITIE')),
  add column level text not null default 'REACH' check (level in ('REACH', 'RELENTLESS', 'GOAL')),
  add column chase_projects boolean not null default true,
  add column goal_date date,
  add constraint alter_ego_pacts_goal_has_date check (level <> 'GOAL' or goal_date is not null);

-- The signed terms stay frozen; these five are settings the climber may change at any time.
grant update (portrait, tone, level, chase_projects, goal_date) on public.alter_ego_pacts to authenticated;

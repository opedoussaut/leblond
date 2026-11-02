-- The alter ego pact: a private, signed copy of a training plan that a fictional
-- partner follows. Everything the ego does is derived from this row and the date,
-- so no background job writes to it. One open pact per climber. Additive only.

create table public.alter_ego_pacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  -- The plan the pact was signed from; the snapshot keeps it stable if the plan is edited or deleted.
  plan_id uuid references public.training_plans(id) on delete set null,
  plan_name text not null check (char_length(btrim(plan_name)) between 1 and 100),
  plan_snapshot jsonb not null
    check (jsonb_typeof(plan_snapshot) = 'array' and jsonb_array_length(plan_snapshot) between 1 and 14),
  progression jsonb not null check (jsonb_typeof(progression) = 'object'),
  start_date date not null,
  horizon_weeks smallint not null check (horizon_weeks between 1 and 52),
  -- Native scales, never converted into each other.
  start_boulder_grade text check (char_length(start_boulder_grade) <= 12),
  target_boulder_grade text check (char_length(target_boulder_grade) <= 12),
  start_route_grade text check (char_length(start_route_grade) <= 12),
  target_route_grade text check (char_length(target_route_grade) <= 12),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'FINISHED', 'ABANDONED')),
  paused_since date,
  paused_days integer not null default 0 check (paused_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alter_ego_pacts_pause_state check ((status = 'PAUSED') = (paused_since is not null))
);

create unique index alter_ego_pacts_one_open on public.alter_ego_pacts (user_id) where status in ('ACTIVE', 'PAUSED');
create index alter_ego_pacts_owner on public.alter_ego_pacts (user_id, created_at desc);
create trigger alter_ego_pacts_updated_at before update on public.alter_ego_pacts
  for each row execute function public.set_updated_at();

alter table public.alter_ego_pacts enable row level security;
-- Supabase default privileges grant ALL to anon and authenticated; start from nothing so
-- only the grants below apply.
revoke all on public.alter_ego_pacts from anon, authenticated;
grant select, insert, delete on public.alter_ego_pacts to authenticated;
-- The signed terms are never updatable: a climber can only pause, resume or close a pact.
grant update (status, paused_since, paused_days) on public.alter_ego_pacts to authenticated;

create policy alter_ego_pacts_select on public.alter_ego_pacts for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy alter_ego_pacts_insert on public.alter_ego_pacts for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and (plan_id is null or exists (select 1 from public.training_plans p where p.id = plan_id and p.user_id = auth.uid())));
create policy alter_ego_pacts_update on public.alter_ego_pacts for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy alter_ego_pacts_delete on public.alter_ego_pacts for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

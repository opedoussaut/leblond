-- Private training plans for the public Training Lab.
-- Publishing the reference atlas does NOT publish any user's saved plan.
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  goal text not null default '' check (char_length(goal) <= 300),
  weeks integer not null default 4 check (weeks between 1 and 52),
  sessions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sessions) = 'array' and jsonb_array_length(sessions) between 1 and 14),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_plans_owner_updated on public.training_plans (user_id, updated_at desc);
create trigger training_plans_updated_at before update on public.training_plans
  for each row execute function public.set_updated_at();

alter table public.training_plans enable row level security;
revoke all on public.training_plans from anon;
grant select, insert, update, delete on public.training_plans to authenticated;

create policy training_plans_select on public.training_plans
  for select to authenticated using (user_id = auth.uid() and public.is_active_beta_user());
create policy training_plans_insert on public.training_plans
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_beta_user());
create policy training_plans_update on public.training_plans
  for update to authenticated using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy training_plans_delete on public.training_plans
  for delete to authenticated using (user_id = auth.uid() and public.is_active_beta_user());

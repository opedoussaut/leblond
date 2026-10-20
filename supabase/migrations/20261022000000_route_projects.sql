-- Route projects (sport / roped climbing), separate from boulder projects.
-- Purely additive: new table, two nullable link columns, one policy refined.

create table public.route_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  gym_id uuid not null references public.gyms(id) on delete restrict,
  route_name text not null check (char_length(btrim(route_name)) between 1 and 120),
  -- Accent/case-insensitive key computed by the app (lib/climbing/routes.ts routeKey).
  route_key text not null check (char_length(route_key) between 1 and 120),
  grade text not null check (grade = any (array[
    '3a','3b','3c','4a','4b','4c',
    '5a','5a+','5b','5b+','5c','5c+',
    '6a','6a+','6b','6b+','6c','6c+',
    '7a','7a+','7b','7b+','7c','7c+',
    '8a','8a+','8b','8b+','8c','8c+',
    '9a','9a+','9b','9b+','9c'])),
  -- The style that counts as "sent" for this project (lead by default).
  goal_style text not null default 'LEAD' check (goal_style in ('LEAD','TOPROPE','AUTOBELAY')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SENT','ABANDONED')),
  notes text not null default '' check (char_length(notes) <= 2000),
  started_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gym_id, route_key),
  constraint route_projects_sent_has_date check (status <> 'SENT' or sent_at is not null)
);
create index route_projects_owner on public.route_projects (user_id, status, started_at desc);
create trigger route_projects_updated_at before update on public.route_projects
  for each row execute function public.set_updated_at();

alter table public.route_projects enable row level security;
revoke all on public.route_projects from anon, authenticated;
grant select, insert, delete on public.route_projects to authenticated;
grant update (route_name, route_key, grade, goal_style, status, notes, sent_at) on public.route_projects to authenticated;

create policy route_projects_select on public.route_projects for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy route_projects_insert on public.route_projects for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy route_projects_update on public.route_projects for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy route_projects_delete on public.route_projects for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

-- Ascents can belong to a project (set when logging, or when a project is created
-- from earlier ascents of the same named route). Deleting a project keeps the ascents.
alter table public.route_ascents
  add column route_project_id uuid references public.route_projects(id) on delete set null;
create index route_ascents_project on public.route_ascents (route_project_id) where route_project_id is not null;
grant update (route_project_id) on public.route_ascents to authenticated;

drop policy route_ascents_insert on public.route_ascents;
create policy route_ascents_insert on public.route_ascents for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and exists (select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid() and s.discipline = 'ROUTE')
    and (route_project_id is null or exists (select 1 from public.route_projects p
      where p.id = route_project_id and p.user_id = auth.uid())));
drop policy route_ascents_update on public.route_ascents;
create policy route_ascents_update on public.route_ascents for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and (route_project_id is null or exists (select 1 from public.route_projects p
      where p.id = route_project_id and p.user_id = auth.uid())));

-- Patrick conversations may be started from a route project.
alter table public.coach_conversations
  add column route_project_id uuid references public.route_projects(id) on delete set null;

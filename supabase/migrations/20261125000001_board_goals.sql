-- Board level goals: "reach 7A on the Kilter at 40°". One goal per board and
-- angle (angle null = any angle of that board), in the board's own scale (Font
-- or V, never converted). Progress is computed from board_ascents by the app;
-- nothing here is derived. Purely additive: new owner-only table.
-- Board problem projects (a precise climb) stay in board_projects; their notes
-- become editable from /projects.

create table public.board_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  board text not null check (board in ('KILTER', 'TENSION', 'MOON', 'DECOY', 'GRASSHOPPER', 'TOUCHSTONE', 'SOILL', 'AURORA')),
  angle smallint check (angle is null or angle between 0 and 90),
  grade text not null check (char_length(grade) between 1 and 8),
  grade_scale text not null check (grade_scale in ('FONT', 'V')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ABANDONED')),
  notes text not null default '' check (char_length(notes) <= 2000),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One goal per board and angle ("any angle" counts as its own slot).
create unique index board_goals_one_per_board_angle on public.board_goals (user_id, board, coalesce(angle, -1));
create index board_goals_owner on public.board_goals (user_id, status, started_at desc);
create trigger board_goals_updated_at before update on public.board_goals
  for each row execute function public.set_updated_at();

alter table public.board_goals enable row level security;
revoke all on public.board_goals from anon, authenticated;
grant select, insert, delete on public.board_goals to authenticated;
grant update (grade, grade_scale, status, notes) on public.board_goals to authenticated;

create policy board_goals_select on public.board_goals for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy board_goals_insert on public.board_goals for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy board_goals_update on public.board_goals for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy board_goals_delete on public.board_goals for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

grant update (notes) on public.board_projects to authenticated;

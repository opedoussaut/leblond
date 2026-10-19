-- Personal climbing diary calendar: dated plans live alongside actual sessions.
-- Dates/times are intentionally LOCAL wall-clock values; never auto-convert
-- them to UTC. The climber specifies their local date and optional time.
create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null check (event_date between '2020-01-01' and '2100-12-31'),
  start_time time(0),
  title text not null check (char_length(trim(title)) between 1 and 120),
  kind text not null check (kind in ('CLIMB','TRAIN','REST','ASSESS','OTHER')),
  discipline text not null check (discipline in ('BOULDER','ROUTE','BOTH','NONE')),
  duration_minutes integer check (duration_minutes between 10 and 480),
  method_id text check (method_id is null or char_length(method_id) between 1 and 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'PLANNED' check (status in ('PLANNED','DONE','SKIPPED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_entries_owner_date on public.calendar_entries (user_id, event_date, start_time);
alter table public.calendar_entries enable row level security;
revoke all on public.calendar_entries from anon;
grant select, insert, delete on public.calendar_entries to authenticated;
grant update (event_date, start_time, title, kind, discipline, duration_minutes, method_id, notes, status) on public.calendar_entries to authenticated;
create policy calendar_select on public.calendar_entries for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy calendar_insert on public.calendar_entries for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy calendar_update on public.calendar_entries for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy calendar_delete on public.calendar_entries for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

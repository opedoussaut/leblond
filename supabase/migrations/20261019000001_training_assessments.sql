-- Baseline self-assessment + method scenario and dated, user-owned check-ins.
-- Scores are ordinal self-reports, not clinically validated or objective grades.
create table public.training_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method_id text not null check (char_length(method_id) between 1 and 100),
  goal text not null default '' check (char_length(goal) <= 300),
  ratings jsonb not null check (jsonb_typeof(ratings) = 'object'),
  horizon_weeks integer not null check (horizon_weeks between 4 and 24),
  sessions_per_week integer not null check (sessions_per_week between 1 and 5),
  forecast_version integer not null default 1 check (forecast_version = 1),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create index assessments_owner_date on public.training_assessments (user_id, created_at desc);

create table public.training_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null,
  week integer not null check (week between 1 and 24),
  ratings jsonb not null check (jsonb_typeof(ratings) = 'object'),
  notes text not null default '' check (char_length(notes) <= 800),
  created_at timestamptz not null default now(),
  unique (assessment_id, week),
  foreign key (user_id, assessment_id) references public.training_assessments(user_id, id) on delete cascade
);
create index training_checkins_owner on public.training_checkins (user_id, assessment_id, week);

alter table public.training_assessments enable row level security;
alter table public.training_checkins enable row level security;
revoke all on public.training_assessments, public.training_checkins from anon;
grant select, insert, delete on public.training_assessments to authenticated;
grant select, insert, update, delete on public.training_checkins to authenticated;

create policy assessments_select on public.training_assessments for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy assessments_insert on public.training_assessments for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user());
create policy assessments_delete on public.training_assessments for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

create policy checkins_select on public.training_checkins for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy checkins_insert on public.training_checkins for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and exists (select 1 from public.training_assessments a
      where a.id = assessment_id and a.user_id = auth.uid()));
create policy checkins_update on public.training_checkins for update to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user())
  with check (user_id = auth.uid() and public.is_active_beta_user()
    and exists (select 1 from public.training_assessments a
      where a.id = assessment_id and a.user_id = auth.uid()));
create policy checkins_delete on public.training_checkins for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
-- A client's user identity must never be changed, even on upsert.
revoke update on public.training_checkins from authenticated;
grant update (ratings, notes) on public.training_checkins to authenticated;

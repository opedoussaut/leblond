-- ═══════════════════════════════════════════════════════════════════════════
-- LEBLOND V1 schema
-- Every table holding personal data has Row Level Security enabled and is
-- scoped to auth.uid(). Raw climbing facts live here; derived analytics are
-- computed in application code (lib/analytics), never stored as truth.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── Enums ──────────────────────────────────────────────────────────────────
create type public.grade_system as enum ('ARKOSE_COLOR', 'CLIMBING_DISTRICT_COLOR', 'FONT', 'CUSTOM_COLOR', 'UNKNOWN');
create type public.gym_brand as enum ('ARKOSE', 'CLIMBING_DISTRICT', 'BLOCKOUT', 'INDEPENDENT', 'OUTDOOR', 'OTHER');
create type public.wall_angle as enum ('SLAB', 'VERTICAL', 'SLIGHT_OVERHANG', 'OVERHANG', 'STEEP', 'ROOF', 'UNKNOWN');
create type public.attempt_result as enum ('ATTEMPT', 'TOP', 'FLASH');
create type public.session_source as enum ('MANUAL', 'ARKOSE', 'CLIMBING_DISTRICT', 'COROS', 'SUUNTO', 'GARMIN', 'STRAVA', 'IMPORT');
create type public.session_type as enum ('BOULDERING', 'TRAINING', 'PROJECTING', 'TECHNIQUE', 'OTHER');
create type public.project_status as enum ('ACTIVE', 'SENT', 'ABANDONED', 'RETIRED');
create type public.media_type as enum ('PROBLEM_PHOTO', 'ATTEMPT_VIDEO', 'SEND_VIDEO');
create type public.normalization_source as enum ('FONT_NATIVE', 'USER_ESTIMATE', 'GYM_PUBLISHED');
create type public.beta_role as enum ('admin', 'beta_tester');
create type public.discipline as enum ('bouldering', 'sport');
create type public.wearable_provider as enum ('COROS', 'SUUNTO', 'GARMIN', 'STRAVA', 'FIT_IMPORT');
-- Persisted per-user connection state. Availability ("requires provider
-- approval", "development/testing", …) is derived from server configuration.
create type public.connection_status as enum ('CONNECTED', 'DISCONNECTED', 'ERROR');
create type public.coach_role as enum ('user', 'assistant');

-- ── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.font_grades() returns text[]
language sql immutable as $$
  select array['3','4','4+','5','5+','6A','6A+','6B','6B+','6C','6C+','7A','7A+','7B','7B+','7C','7C+','8A','8A+','8B','8B+','8C','8C+','9A']
$$;

-- Mirrors lib/grading/systems.ts. Keep in sync.
create or replace function public.is_valid_native_grade(p_system public.grade_system, p_grade text) returns boolean
language sql immutable as $$
  select case p_system
    when 'ARKOSE_COLOR' then p_grade = any (array['YELLOW','GREEN','BLUE','RED','BLACK','PURPLE'])
    when 'CLIMBING_DISTRICT_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','BLACK','PURPLE','PINK'])
    when 'FONT' then p_grade = any (public.font_grades())
    when 'CUSTOM_COLOR' then p_grade = any (array['WHITE','YELLOW','ORANGE','GREEN','BLUE','RED','PINK','PURPLE','BLACK','GREY','BROWN'])
    when 'UNKNOWN' then p_grade = 'UNKNOWN'
  end
$$;

-- ── Closed beta whitelist ──────────────────────────────────────────────────
create table public.beta_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  role public.beta_role not null default 'beta_tester',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beta_users_email_lower check (email = lower(email))
);
create unique index beta_users_email_key on public.beta_users (email);
create trigger beta_users_updated_at before update on public.beta_users
  for each row execute function public.set_updated_at();

create or replace function public.current_email() returns text
language sql stable as $$
  select lower(nullif(auth.jwt() ->> 'email', ''))
$$;

-- SECURITY DEFINER so policies can consult the whitelist without exposing it.
create or replace function public.is_active_beta_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.beta_users b where b.email = public.current_email() and b.active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.beta_users b
    where b.email = public.current_email() and b.active and b.role = 'admin'
  )
$$;

-- Reject sign-ups for emails that are not on the active whitelist. This runs
-- even if someone calls the Supabase Auth API directly, bypassing the app.
create or replace function public.enforce_beta_whitelist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or not exists (
    select 1 from public.beta_users b where b.email = lower(new.email) and b.active
  ) then
    raise exception 'LEBLOND is a closed beta: this email is not invited.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger enforce_beta_whitelist before insert on auth.users
  for each row execute function public.enforce_beta_whitelist();

-- ── Profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  preferred_language text not null default 'fr' check (preferred_language in ('fr', 'en')),
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 25 and 250),
  climbing_since date,
  preferred_discipline public.discipline not null default 'bouldering',
  target_grade text not null default '7A',
  target_grade_system public.grade_system not null default 'FONT',
  self_reported_level text,
  self_reported_level_system public.grade_system,
  bio text check (bio is null or length(bio) <= 1000),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_target_valid check (public.is_valid_native_grade(target_grade_system, target_grade)),
  constraint profiles_level_valid check (
    self_reported_level is null
    or (self_reported_level_system is not null and public.is_valid_native_grade(self_reported_level_system, self_reported_level))
  )
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  select new.id, coalesce((select b.display_name from public.beta_users b where b.email = lower(new.email)), '')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Gyms (shared catalogue, not personal data) ─────────────────────────────
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  brand public.gym_brand not null,
  city text check (city is null or length(city) <= 120),
  country text check (country is null or length(country) <= 2),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  grading_system public.grade_system not null,
  external_provider text,
  external_id text,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Network grading is fixed: an Arkose venue always uses Arkose colours, etc.
  constraint gyms_brand_system check (
    (brand = 'ARKOSE' and grading_system = 'ARKOSE_COLOR')
    or (brand = 'CLIMBING_DISTRICT' and grading_system = 'CLIMBING_DISTRICT_COLOR')
    or (brand not in ('ARKOSE', 'CLIMBING_DISTRICT') and grading_system in ('FONT', 'CUSTOM_COLOR', 'UNKNOWN'))
  )
);
create unique index gyms_brand_name_key on public.gyms (brand, lower(name));
create trigger gyms_updated_at before update on public.gyms
  for each row execute function public.set_updated_at();

create table public.favourite_gyms (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, gym_id)
);

-- ── Problems (private to the climber who logged them) ──────────────────────
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text check (name is null or length(name) <= 120),
  external_problem_id text,
  photo_url text,
  native_grade text not null,
  native_grade_system public.grade_system not null,
  normalized_grade text,
  normalized_grade_system public.grade_system,
  normalization_confidence numeric(3, 2),
  normalization_source public.normalization_source,
  wall_angle public.wall_angle not null default 'UNKNOWN',
  wall_zone text check (wall_zone is null or length(wall_zone) <= 80),
  setter text check (setter is null or length(setter) <= 80),
  opened_at date,
  retired_at date,
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint problems_native_valid check (public.is_valid_native_grade(native_grade_system, native_grade)),
  -- The normalised estimate is optional, separate, and always carries provenance.
  constraint problems_normalized_valid check (
    (normalized_grade is null and normalized_grade_system is null and normalization_confidence is null and normalization_source is null)
    or (
      normalized_grade_system = 'FONT'
      and normalized_grade = any (public.font_grades())
      and normalization_confidence between 0 and 1
      and normalization_source is not null
    )
  )
);
create index problems_owner_idx on public.problems (created_by, created_at desc);
create index problems_gym_idx on public.problems (gym_id);
create trigger problems_updated_at before update on public.problems
  for each row execute function public.set_updated_at();

-- A problem is always graded in its gym's native system.
create or replace function public.problems_match_gym_system() returns trigger
language plpgsql as $$
declare
  v_system public.grade_system;
begin
  select grading_system into v_system from public.gyms where id = new.gym_id;
  if v_system is distinct from new.native_grade_system then
    raise exception 'Problem grade system % does not match gym grading system %', new.native_grade_system, v_system
      using errcode = '23514';
  end if;
  return new;
end $$;
create trigger problems_match_gym_system before insert or update of gym_id, native_grade_system on public.problems
  for each row execute function public.problems_match_gym_system();

-- ── Style tags ─────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_at timestamptz not null default now()
);
insert into public.tags (slug) values
  ('slab'), ('balance'), ('technical'), ('coordination'), ('dynamic'), ('dyno'), ('compression'),
  ('power'), ('power_endurance'), ('crimps'), ('slopers'), ('pinches'), ('pockets'), ('heel_hook'),
  ('toe_hook'), ('mantle'), ('lock_off'), ('undercling'), ('gaston'), ('high_step'), ('flexibility'),
  ('route_reading'), ('footwork'), ('body_positioning');

create table public.problem_tags (
  problem_id uuid not null references public.problems (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (problem_id, tag_id)
);

-- ── Sessions ───────────────────────────────────────────────────────────────
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  gym_id uuid not null references public.gyms (id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 0 and 1440),
  session_type public.session_type not null default 'BOULDERING',
  perceived_energy_before smallint check (perceived_energy_before between 1 and 5),
  perceived_energy_after smallint check (perceived_energy_after between 1 and 5),
  fatigue smallint check (fatigue between 1 and 5),
  motivation smallint check (motivation between 1 and 5),
  notes text check (notes is null or length(notes) <= 4000),
  source public.session_source not null default 'MANUAL',
  wearable_activity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
-- At most one live session per climber.
create unique index sessions_one_active_per_user on public.sessions (user_id) where ended_at is null;
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ── Attempts: the core event ───────────────────────────────────────────────
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  problem_id uuid not null references public.problems (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  attempt_number integer not null check (attempt_number >= 1),
  result public.attempt_result not null,
  started_at timestamptz,
  notes text check (notes is null or length(notes) <= 1000),
  perceived_difficulty smallint check (perceived_difficulty between 1 and 5),
  created_at timestamptz not null default now(),
  -- Flash = successful FIRST attempt.
  constraint attempts_flash_is_first check (result <> 'FLASH' or attempt_number = 1),
  constraint attempts_number_unique unique (user_id, problem_id, attempt_number)
);
create index attempts_session_idx on public.attempts (session_id, created_at);
create index attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index attempts_problem_idx on public.attempts (problem_id, attempt_number);

-- Logs an attempt with the next attempt number for this climber/problem.
-- SECURITY INVOKER: RLS on problems/sessions/attempts still applies.
create or replace function public.log_attempt(
  p_session_id uuid,
  p_problem_id uuid,
  p_result public.attempt_result
) returns public.attempts
language plpgsql security invoker set search_path = public as $$
declare
  v_next integer;
  v_row public.attempts;
begin
  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.user_id = auth.uid()) then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Serialise concurrent taps on the same problem.
  perform 1 from public.problems p where p.id = p_problem_id and p.created_by = auth.uid() for update;
  if not found then
    raise exception 'PROBLEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  select coalesce(max(a.attempt_number), 0) + 1 into v_next
    from public.attempts a where a.problem_id = p_problem_id and a.user_id = auth.uid();
  if p_result = 'FLASH' and v_next > 1 then
    raise exception 'FLASH_NOT_FIRST_ATTEMPT' using errcode = '23514';
  end if;
  insert into public.attempts (session_id, problem_id, user_id, attempt_number, result)
    values (p_session_id, p_problem_id, auth.uid(), v_next, p_result)
    returning * into v_row;
  return v_row;
end $$;

-- ── Media ──────────────────────────────────────────────────────────────────
create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  session_id uuid references public.sessions (id) on delete set null,
  problem_id uuid references public.problems (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete set null,
  media_type public.media_type not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  thumbnail_path text,
  duration_seconds numeric(8, 2),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  -- Objects live under "<user_id>/..." in the private bucket.
  constraint media_path_owned check (split_part(storage_path, '/', 1) = user_id::text),
  constraint media_has_subject check (session_id is not null or problem_id is not null)
);
create index media_problem_idx on public.media (problem_id);
create index media_session_idx on public.media (session_id);

-- ── Projects ───────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  status public.project_status not null default 'ACTIVE',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text check (notes is null or length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index projects_one_per_problem on public.projects (user_id, problem_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ── Patrick: conversations and telemetry ───────────────────────────────────
create table public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null default '' check (length(title) <= 200),
  session_id uuid references public.sessions (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_conversations_user_idx on public.coach_conversations (user_id, updated_at desc);
create trigger coach_conversations_updated_at before update on public.coach_conversations
  for each row execute function public.set_updated_at();

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role public.coach_role not null,
  content text not null check (length(content) <= 20000),
  created_at timestamptz not null default now()
);
create index coach_messages_conversation_idx on public.coach_messages (conversation_id, created_at);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  "timestamp" timestamptz not null default now(),
  model text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  request_type text not null check (length(request_type) <= 60),
  succeeded boolean not null default true
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, "timestamp" desc);

-- ── Wearables ──────────────────────────────────────────────────────────────
create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.wearable_provider not null,
  status public.connection_status not null,
  provider_user_id text,
  scopes text[],
  -- AES-256-GCM ciphertext produced by the server (lib/security/crypto.ts).
  -- Never granted to client roles: see column privileges below.
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create trigger wearable_connections_updated_at before update on public.wearable_connections
  for each row execute function public.set_updated_at();

create table public.wearable_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  provider public.wearable_provider not null,
  provider_activity_id text not null,
  session_id uuid references public.sessions (id) on delete set null,
  activity_type text not null default 'unknown',
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  calories integer check (calories is null or calories >= 0),
  avg_heart_rate smallint check (avg_heart_rate is null or avg_heart_rate between 20 and 260),
  max_heart_rate smallint check (max_heart_rate is null or max_heart_rate between 20 and 260),
  training_load numeric(8, 2),
  recovery_metrics jsonb,
  device_name text,
  device_manufacturer text,
  raw_file_reference text,
  -- Hash of stable metadata used for cross-provider de-duplication.
  dedup_key text not null,
  raw_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_activity_id),
  constraint wearable_file_owned check (raw_file_reference is null or split_part(raw_file_reference, '/', 1) = user_id::text)
);
create index wearable_activities_user_start_idx on public.wearable_activities (user_id, started_at desc);
create index wearable_activities_dedup_idx on public.wearable_activities (user_id, dedup_key);
create index wearable_activities_session_idx on public.wearable_activities (session_id);
create trigger wearable_activities_updated_at before update on public.wearable_activities
  for each row execute function public.set_updated_at();

alter table public.sessions
  add constraint sessions_wearable_activity_fk
  foreign key (wearable_activity_id) references public.wearable_activities (id) on delete set null;

-- Time series kept out of the main activity row.
create table public.wearable_activity_samples (
  activity_id uuid primary key references public.wearable_activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- [[seconds_from_start, bpm], ...], downsampled.
  heart_rate jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Links (or unlinks, with p_session_id null) a wearable activity and a session.
create or replace function public.link_wearable_activity(p_activity_id uuid, p_session_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_previous uuid;
begin
  select session_id into v_previous from public.wearable_activities
    where id = p_activity_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_session_id is not null and not exists (
    select 1 from public.sessions where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.sessions set wearable_activity_id = null
    where id = v_previous and wearable_activity_id = p_activity_id;
  update public.wearable_activities set session_id = p_session_id where id = p_activity_id;
  if p_session_id is not null then
    update public.sessions set wearable_activity_id = p_activity_id where id = p_session_id;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.beta_users enable row level security;
alter table public.profiles enable row level security;
alter table public.gyms enable row level security;
alter table public.favourite_gyms enable row level security;
alter table public.problems enable row level security;
alter table public.tags enable row level security;
alter table public.problem_tags enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.media enable row level security;
alter table public.projects enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.wearable_connections enable row level security;
alter table public.wearable_activities enable row level security;
alter table public.wearable_activity_samples enable row level security;

-- No anonymous access to anything.
revoke all on all tables in schema public from anon;

-- beta_users: you can see your own entry; the admin sees the roster. Writes
-- happen through the service role only (bootstrap script / admin actions).
create policy beta_users_select on public.beta_users for select to authenticated
  using (email = public.current_email() or public.is_admin());
revoke insert, update, delete on public.beta_users from authenticated;

-- profiles: own row only.
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- gyms: shared catalogue readable by active beta users; created/edited by the
-- creator (or the admin). No deletes from the client.
create policy gyms_select on public.gyms for select to authenticated using (public.is_active_beta_user());
create policy gyms_insert on public.gyms for insert to authenticated
  with check (public.is_active_beta_user() and created_by = auth.uid());
create policy gyms_update on public.gyms for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
revoke delete on public.gyms from authenticated;

create policy favourite_gyms_all on public.favourite_gyms for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- problems: private to their creator.
create policy problems_all on public.problems for all to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid() and public.is_active_beta_user());

create policy tags_select on public.tags for select to authenticated using (true);
revoke insert, update, delete on public.tags from authenticated;

create policy problem_tags_all on public.problem_tags for all to authenticated
  using (exists (select 1 from public.problems p where p.id = problem_id and p.created_by = auth.uid()))
  with check (exists (select 1 from public.problems p where p.id = problem_id and p.created_by = auth.uid()));

create policy sessions_all on public.sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_beta_user());

create policy attempts_select on public.attempts for select to authenticated using (user_id = auth.uid());
create policy attempts_insert on public.attempts for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  and exists (select 1 from public.problems p where p.id = problem_id and p.created_by = auth.uid())
);
create policy attempts_update on public.attempts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attempts_delete on public.attempts for delete to authenticated using (user_id = auth.uid());
-- Only the classification/notes of an attempt may be corrected, not its identity.
revoke update on public.attempts from authenticated;
grant update (result, notes, perceived_difficulty, started_at) on public.attempts to authenticated;

create policy media_all on public.media for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy projects_all on public.projects for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.problems p where p.id = problem_id and p.created_by = auth.uid())
  );

create policy coach_conversations_all on public.coach_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_messages_all on public.coach_messages for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.coach_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

-- ai_usage: append-only for the user (deleting rows must not reset the rate limit).
create policy ai_usage_select on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy ai_usage_insert on public.ai_usage for insert to authenticated with check (user_id = auth.uid());
revoke update, delete on public.ai_usage from authenticated;

-- wearable_connections: the climber may READ status columns of their own
-- connections; tokens are never readable by client roles, and all writes go
-- through the server with the service role.
create policy wearable_connections_select on public.wearable_connections for select to authenticated
  using (user_id = auth.uid());
revoke all on public.wearable_connections from authenticated;
grant select (id, user_id, provider, status, provider_user_id, scopes, expires_at, last_sync_at, last_error, created_at, updated_at)
  on public.wearable_connections to authenticated;

create policy wearable_activities_all on public.wearable_activities for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wearable_activity_samples_all on public.wearable_activity_samples for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.unlink_wearable_activity(p_activity_id uuid)
returns void language sql security invoker set search_path = public as $$
  select public.link_wearable_activity(p_activity_id, null)
$$;

-- Function privileges
revoke execute on function public.enforce_beta_whitelist() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_attempt(uuid, uuid, public.attempt_result) from public, anon;
revoke execute on function public.link_wearable_activity(uuid, uuid) from public, anon;
grant execute on function public.log_attempt(uuid, uuid, public.attempt_result) to authenticated;
grant execute on function public.link_wearable_activity(uuid, uuid) to authenticated;
revoke execute on function public.unlink_wearable_activity(uuid) from public, anon;
grant execute on function public.unlink_wearable_activity(uuid) to authenticated;

-- Admin overview: AI usage counts per beta user — no climbing data, no prompts.
create or replace function public.admin_beta_overview()
returns table (email text, display_name text, role public.beta_role, active boolean, has_account boolean, coach_requests_30d bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select b.email, b.display_name, b.role, b.active,
      exists (select 1 from auth.users u where lower(u.email) = b.email),
      (select count(*) from public.ai_usage a join auth.users u on u.id = a.user_id
        where lower(u.email) = b.email and a."timestamp" > now() - interval '30 days')
    from public.beta_users b
    order by (b.role = 'admin') desc, b.display_name;
end $$;
revoke execute on function public.admin_beta_overview() from public, anon;
grant execute on function public.admin_beta_overview() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage: private buckets, objects namespaced by user id
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', false, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('wearable-files', 'wearable-files', false, 4194304,
    array['application/octet-stream', 'application/vnd.ant.fit'])
on conflict (id) do nothing;

create policy "media objects: owner read" on storage.objects for select to authenticated
  using (bucket_id in ('media', 'wearable-files') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media objects: owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('media', 'wearable-files')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_beta_user()
  );
create policy "media objects: owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'wearable-files') and (storage.foldername(name))[1] = auth.uid()::text);

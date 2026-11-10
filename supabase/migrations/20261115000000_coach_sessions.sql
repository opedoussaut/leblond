-- Coach sessions: complete, ready-to-run training sessions written for one
-- climber by their coach (Claude, working with them outside the app, and later
-- Patrick). They appear in the session type list; starting one copies its
-- exercises into a normal training session (training_session_exercises), so
-- the player, history and analytics are unchanged.
--
-- Writing them from outside the app uses a personal coach key:
--   * created by the climber in Settings, shown once, stored only as a SHA-256 hash;
--   * revocable; at most 3 active keys per climber;
--   * its ONLY power is to list, add, replace and remove that climber's coach
--     sessions, through the coach_key_* functions below (nothing else is readable
--     or writable with it);
--   * stops working as soon as the climber is no longer on the active whitelist;
--   * limited to 300 calls a day.
-- The app never uses the service-role key for this.

create table public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- Stable name chosen by the coach, so a session can be revised in place.
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  objective text not null default '' check (char_length(objective) <= 300),
  minutes integer not null check (minutes between 10 and 240),
  place text check (place is null or place in ('BOULDER_GYM', 'ROUTE_GYM', 'CRAG', 'HOME')),
  author text not null default 'CLAUDE' check (author in ('CLAUDE', 'PATRICK')),
  -- {exercises:[…], sources:[…], notes} — validated by the app (lib/training/coach-sessions.ts)
  -- on write and again on read; the database only bounds its shape and size.
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content -> 'exercises') = 'array'
    and jsonb_array_length(content -> 'exercises') between 1 and 40
    and pg_column_size(content) <= 65536
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
create index coach_sessions_owner on public.coach_sessions (user_id, updated_at desc);
create trigger coach_sessions_updated_at before update on public.coach_sessions
  for each row execute function public.set_updated_at();

alter table public.coach_sessions enable row level security;
revoke all on public.coach_sessions from anon, authenticated;
-- The climber reads and removes their coach sessions in the app; writing goes
-- through the coach key functions.
grant select, delete on public.coach_sessions to authenticated;
create policy coach_sessions_select on public.coach_sessions for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());
create policy coach_sessions_delete on public.coach_sessions for delete to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

create table public.coach_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  -- The first characters, to recognise a key in the list. Not enough to use it.
  prefix text not null check (char_length(prefix) = 12),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  calls_day date,
  calls_count integer not null default 0 check (calls_count >= 0)
);
create index coach_keys_owner on public.coach_keys (user_id, created_at desc);

alter table public.coach_keys enable row level security;
revoke all on public.coach_keys from anon, authenticated;
-- The hash is never readable by the client, even by its owner.
grant select (id, label, prefix, created_at, last_used_at, revoked_at) on public.coach_keys to authenticated;
create policy coach_keys_select on public.coach_keys for select to authenticated
  using (user_id = auth.uid() and public.is_active_beta_user());

-- Creates a key for the signed-in climber and returns it. The only time the
-- clear key exists is in this function's result.
create or replace function public.create_coach_key(p_label text) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_key text;
begin
  if auth.uid() is null or not public.is_active_beta_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.coach_keys where user_id = auth.uid() and revoked_at is null) >= 3 then
    raise exception 'too_many_keys' using errcode = 'P0001';
  end if;
  v_key := 'lbk_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.coach_keys (user_id, label, key_hash, prefix)
  values (auth.uid(), btrim(coalesce(p_label, '')), encode(extensions.digest(v_key, 'sha256'), 'hex'), left(v_key, 12));
  return v_key;
end $$;

create or replace function public.revoke_coach_key(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_beta_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.coach_keys set revoked_at = now()
  where id = p_id and user_id = auth.uid() and revoked_at is null;
  return found;
end $$;

-- Resolves a key to its climber: active key, climber still on the active
-- whitelist, daily limit. Counts the call. Internal: not callable directly.
create or replace function public.coach_key_owner(p_key text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_user uuid;
  v_day date;
  v_count integer;
begin
  if p_key is null or p_key !~ '^lbk_[0-9a-f]{48}$' then
    raise exception 'invalid_key' using errcode = '28000';
  end if;
  select k.id, k.user_id, k.calls_day, k.calls_count into v_id, v_user, v_day, v_count
  from public.coach_keys k
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex') and k.revoked_at is null
  for update;
  if v_id is null or not exists (
    select 1 from auth.users u join public.beta_users b on b.email = lower(u.email)
    where u.id = v_user and b.active
  ) then
    raise exception 'invalid_key' using errcode = '28000';
  end if;
  if v_day = current_date and v_count >= 300 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  update public.coach_keys set
    last_used_at = now(),
    calls_day = current_date,
    calls_count = case when v_day = current_date then v_count + 1 else 1 end
  where id = v_id;
  return v_user;
end $$;
revoke all on function public.coach_key_owner(text) from public, anon, authenticated;

-- Adds or replaces (same slug) a coach session. At most 100 per climber.
create or replace function public.coach_key_put_session(
  p_key text, p_slug text, p_title text, p_objective text, p_minutes integer, p_place text, p_content jsonb
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
  v_id uuid;
begin
  if not exists (select 1 from public.coach_sessions where user_id = v_user and slug = p_slug)
     and (select count(*) from public.coach_sessions where user_id = v_user) >= 100 then
    raise exception 'too_many_sessions' using errcode = 'P0001';
  end if;
  insert into public.coach_sessions (user_id, slug, title, objective, minutes, place, author, content)
  values (v_user, p_slug, p_title, coalesce(p_objective, ''), p_minutes, p_place, 'CLAUDE', p_content)
  on conflict (user_id, slug) do update set
    title = excluded.title, objective = excluded.objective, minutes = excluded.minutes,
    place = excluded.place, content = excluded.content
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.coach_key_list_sessions(p_key text)
returns table (slug text, title text, minutes integer, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
begin
  return query select c.slug, c.title, c.minutes, c.updated_at
    from public.coach_sessions c where c.user_id = v_user order by c.updated_at desc;
end $$;

create or replace function public.coach_key_delete_session(p_key text, p_slug text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
begin
  delete from public.coach_sessions where user_id = v_user and slug = p_slug;
  return found;
end $$;

revoke all on function public.create_coach_key(text), public.revoke_coach_key(uuid) from public, anon;
grant execute on function public.create_coach_key(text), public.revoke_coach_key(uuid) to authenticated;
-- The key functions are called by the app's /api/coach-sessions route without a
-- user session: the key IS the authentication.
revoke all on function public.coach_key_put_session(text, text, text, text, integer, text, jsonb),
  public.coach_key_list_sessions(text), public.coach_key_delete_session(text, text) from public;
grant execute on function public.coach_key_put_session(text, text, text, text, integer, text, jsonb),
  public.coach_key_list_sessions(text), public.coach_key_delete_session(text, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- LEBLOND — Fontainebleau outdoor bouldering (Boolder catalogue)
--
-- 1. The Font scale becomes the lettered Fontainebleau scale below 6A
--    (1a … 5c, then 6A … 9A), as published by Boolder.
-- 2. A read-only reference catalogue of Fontainebleau areas, circuits and
--    problems imported from Boolder's open data (CC BY 4.0,
--    https://github.com/boolder-org/boolder-data). Written only by the
--    importer (service role); readable by active beta users.
-- 3. A climber's own problem can point at a catalogue problem, so attempts on
--    the same Fontainebleau boulder accumulate across sessions.
-- Mirrors lib/grading/systems.ts and lib/integrations/outdoor/boolder.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Lettered Font scale ─────────────────────────────────────────────────
create or replace function public.font_grades() returns text[]
language sql immutable as $$
  select array[
    '1a','1b','1c','2a','2b','2c','3a','3b','3c','4a','4b','4c','5a','5b','5c',
    '6A','6A+','6B','6B+','6C','6C+','7A','7A+','7B','7B+','7C','7C+',
    '8A','8A+','8B','8B+','8C','8C+','9A'
  ]
$$;

-- Rows saved with the previous indoor-style notation (before any public
-- release) are moved to the lowest matching letter: 3 → 3a, 4 → 4a, 4+ → 4c,
-- 5 → 5a, 5+ → 5c. See docs/grading.md.
create function public.leblond_legacy_font(g text) returns text
language sql immutable as $$
  select case g when '3' then '3a' when '4' then '4a' when '4+' then '4c' when '5' then '5a' when '5+' then '5c' else g end
$$;

update public.problems set
  native_grade = case when native_grade_system = 'FONT' then public.leblond_legacy_font(native_grade) else native_grade end,
  normalized_grade = public.leblond_legacy_font(normalized_grade)
where (native_grade_system = 'FONT' and native_grade in ('3','4','4+','5','5+'))
   or normalized_grade in ('3','4','4+','5','5+');

update public.profiles set
  target_grade = case when target_grade_system = 'FONT' then public.leblond_legacy_font(target_grade) else target_grade end,
  self_reported_level = case when self_reported_level_system = 'FONT' then public.leblond_legacy_font(self_reported_level) else self_reported_level end
where (target_grade_system = 'FONT' and target_grade in ('3','4','4+','5','5+'))
   or (self_reported_level_system = 'FONT' and self_reported_level in ('3','4','4+','5','5+'));

drop function public.leblond_legacy_font(text);

-- ── 2. Gyms: external catalogue entries ────────────────────────────────────
-- Names stay unique per network for gyms people create; catalogue entries are
-- identified by (external_provider, external_id) instead.
drop index public.gyms_brand_name_key;
create unique index gyms_brand_name_key on public.gyms (brand, lower(name)) where external_provider is null;
-- Not partial (NULLs never collide), so the importer can upsert on it.
create unique index gyms_external_key on public.gyms (external_provider, external_id);

-- Climbers cannot create or re-point catalogue gyms; only the importer can.
drop policy gyms_insert on public.gyms;
create policy gyms_insert on public.gyms for insert to authenticated
  with check (public.is_active_beta_user() and created_by = auth.uid() and external_provider is null and external_id is null);
drop policy gyms_update on public.gyms;
create policy gyms_update on public.gyms for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check ((created_by = auth.uid() and external_provider is null and external_id is null) or public.is_admin());

-- ── 3. Boolder catalogue ───────────────────────────────────────────────────
create table public.outdoor_data_imports (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('BOOLDER')),
  source_version text check (source_version is null or length(source_version) <= 64),
  source_date timestamptz,
  imported_at timestamptz not null default now(),
  areas integer not null check (areas >= 0),
  circuits integer not null check (circuits >= 0),
  problems integer not null check (problems >= 0),
  skipped integer not null default 0 check (skipped >= 0)
);

create table public.outdoor_areas (
  id integer primary key,                                  -- Boolder area id
  gym_id uuid not null unique references public.gyms (id) on delete restrict,
  name text not null check (length(name) between 1 and 120),
  name_searchable text not null default '',
  cluster_name text check (cluster_name is null or length(cluster_name) <= 120),
  priority integer not null default 0,
  tags text[] not null default '{}',
  description_fr text check (description_fr is null or length(description_fr) <= 4000),
  description_en text check (description_en is null or length(description_en) <= 4000),
  warning_fr text check (warning_fr is null or length(warning_fr) <= 1000),
  warning_en text check (warning_en is null or length(warning_en) <= 1000),
  south_west_lat double precision,
  south_west_lon double precision,
  north_east_lat double precision,
  north_east_lon double precision,
  problems_count integer not null default 0 check (problems_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.outdoor_circuits (
  id integer primary key,                                  -- Boolder circuit id
  color text not null check (length(color) <= 20),
  average_grade text check (average_grade is null or average_grade = any (public.font_grades())),
  beginner_friendly boolean not null default false,
  dangerous boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.outdoor_problems (
  id integer primary key,                                  -- Boolder problem id
  area_id integer not null references public.outdoor_areas (id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  name_en text check (name_en is null or length(name_en) <= 160),
  name_searchable text not null default '',
  grade text not null check (grade = any (public.font_grades())),
  circuit_id integer references public.outdoor_circuits (id) on delete set null,
  circuit_number text check (circuit_number is null or length(circuit_number) <= 10),
  circuit_color text check (circuit_color is null or length(circuit_color) <= 20),
  steepness text not null check (length(steepness) <= 20),
  wall_angle public.wall_angle not null default 'UNKNOWN',
  sit_start boolean not null default false,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  popularity integer,
  featured boolean not null default false,
  parent_id integer,                                       -- variant of another Boolder problem (no FK: upstream may be partial)
  bleau_info_id text check (bleau_info_id is null or bleau_info_id ~ '^[0-9]{1,10}$'),
  updated_at timestamptz not null default now()
);
create index outdoor_problems_area_idx on public.outdoor_problems (area_id);

alter table public.outdoor_data_imports enable row level security;
alter table public.outdoor_areas enable row level security;
alter table public.outdoor_circuits enable row level security;
alter table public.outdoor_problems enable row level security;

create policy outdoor_data_imports_select on public.outdoor_data_imports for select to authenticated using (public.is_active_beta_user());
create policy outdoor_areas_select on public.outdoor_areas for select to authenticated using (public.is_active_beta_user());
create policy outdoor_circuits_select on public.outdoor_circuits for select to authenticated using (public.is_active_beta_user());
create policy outdoor_problems_select on public.outdoor_problems for select to authenticated using (public.is_active_beta_user());

revoke all on public.outdoor_data_imports, public.outdoor_areas, public.outdoor_circuits, public.outdoor_problems from anon;
revoke insert, update, delete, truncate on public.outdoor_data_imports, public.outdoor_areas, public.outdoor_circuits, public.outdoor_problems from authenticated;

-- ── 4. Climber problems linked to the catalogue ────────────────────────────
alter table public.problems
  add column outdoor_problem_id integer references public.outdoor_problems (id) on delete set null;
-- One personal problem per catalogue problem and climber: attempts accumulate.
create unique index problems_outdoor_owner_key on public.problems (created_by, outdoor_problem_id)
  where outdoor_problem_id is not null;

-- A linked problem must belong to the gym that represents its Boolder area.
create or replace function public.problems_match_outdoor_area() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outdoor_problem_id is not null and not exists (
    select 1
    from public.outdoor_problems op
    join public.outdoor_areas oa on oa.id = op.area_id
    where op.id = new.outdoor_problem_id and oa.gym_id = new.gym_id
  ) then
    raise exception 'Outdoor problem % is not in this area', new.outdoor_problem_id using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.problems_match_outdoor_area() from public, anon, authenticated;
create trigger problems_match_outdoor_area before insert or update of outdoor_problem_id, gym_id on public.problems
  for each row execute function public.problems_match_outdoor_area();

-- ═══════════════════════════════════════════════════════════════════════════
-- LOCAL DEVELOPMENT SEED — synthetic demo data only.
-- "Alex" is a fictional climber (working grade ~6B+, target 7A).
-- No real beta-tester emails or climbing history may ever be added here.
-- Applied by `supabase db reset` on a LOCAL stack only.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.beta_users (email, display_name, role)
values ('alex@leblond.local', 'Alex', 'admin')
on conflict (email) do nothing;

insert into public.gyms (id, name, brand, city, country, grading_system, created_by) values
  ('d0000000-0000-0000-0000-000000000001', 'Demo Arkose', 'ARKOSE', 'Paris', 'FR', 'ARKOSE_COLOR', null),
  ('d0000000-0000-0000-0000-000000000002', 'Demo Climbing District', 'CLIMBING_DISTRICT', 'Paris', 'FR', 'CLIMBING_DISTRICT_COLOR', null),
  ('d0000000-0000-0000-0000-000000000003', 'Demo Bloc Indé', 'INDEPENDENT', 'Lyon', 'FR', 'FONT', null)
on conflict do nothing;

-- Sign in locally as alex@leblond.local (Inbucket/Mailpit shows the code at
-- http://localhost:54324). Climbing history is created by using the app.

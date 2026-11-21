-- The rival's name and photo (asked 2026-11-21): the climber may rename the rival
-- and give it their own picture instead of one of the drawn portraits.
--
-- * display_name: chosen when signing the pact, frozen until now; it becomes a
--   setting like the portrait. Its existing check (1–40 characters) still applies.
-- * photo_path: an object in the private "media" bucket under
--   "<user_id>/rival/<uuid>.<webp|jpg|png>". The existing owner-only Storage
--   policies (first folder = auth.uid()) cover it; the check below keeps the path
--   in the owner's own folder. Null = the drawn portrait is shown.
--
-- The rest of the signed terms (programme, start date, duration, progression) stay
-- frozen. Additive only.

alter table public.alter_ego_pacts
  add column photo_path text,
  add constraint alter_ego_pacts_photo_path check (
    photo_path is null
    or photo_path ~ ('^' || user_id::text || '/rival/[0-9a-f-]{36}\.(webp|jpg|png)$')
  );

grant update (display_name, photo_path) on public.alter_ego_pacts to authenticated;

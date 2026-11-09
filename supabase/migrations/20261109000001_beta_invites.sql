-- LEBLOND: invitation links for the closed beta.
-- The admin creates a link in Beta administration and sends it (WhatsApp,
-- Telegram, SMS…). The friend opens it and signs up with their own email,
-- which joins the whitelist at that moment: the admin never needs to know it.
-- A link works once, for 30 days, and can be cancelled before it is used.

create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  -- 10 characters without look-alikes (no I, O, 0, 1): 32^10 ≈ 10^15 codes, too many to guess.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  -- Who the link is for, as the admin wrote it (optional, shown only to the admin).
  label text not null default '' check (char_length(label) <= 60),
  expires_at timestamptz not null default now() + interval '30 days',
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Which link brought each tester (null for testers the admin added directly).
alter table public.beta_users add column invite_id uuid references public.beta_invites (id) on delete set null;

-- Only the admin sees and creates links, and can only cancel them: a link is
-- marked used by redeem_beta_invite() alone, and never deleted.
alter table public.beta_invites enable row level security;
revoke all on public.beta_invites from anon, authenticated;
grant select on public.beta_invites to authenticated;
grant insert (code, label) on public.beta_invites to authenticated;
grant update (revoked_at) on public.beta_invites to authenticated;
create policy beta_invites_select on public.beta_invites for select to authenticated using (public.is_admin());
create policy beta_invites_insert on public.beta_invites for insert to authenticated with check (public.is_admin());
create policy beta_invites_update on public.beta_invites for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Called by the sign-up form before the account is created (the whitelist
-- trigger on auth.users then lets the email in). Open to anonymous visitors:
-- holding a valid code is the permission. Returns false for any refusal
-- without saying why.
create or replace function public.redeem_beta_invite(p_code text, p_email text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite public.beta_invites;
  v_active boolean;
begin
  if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return false;
  end if;

  select * into v_invite from public.beta_invites i
  where i.code = v_code and i.redeemed_at is null and i.revoked_at is null and i.expires_at > now()
  for update;
  if not found then
    return false;
  end if;

  select b.active into v_active from public.beta_users b where b.email = v_email;
  if found then
    -- Already on the list: the link stays unused. A tester the admin
    -- deactivated is not let back in by a link.
    return v_active;
  end if;

  insert into public.beta_users (email, display_name, role, active, invite_id)
  values (v_email, coalesce(nullif(trim(v_invite.label), ''), split_part(v_email, '@', 1)), 'beta_tester', true, v_invite.id);
  update public.beta_invites set redeemed_at = now() where id = v_invite.id;
  return true;
end $$;
revoke all on function public.redeem_beta_invite(text, text) from public;
grant execute on function public.redeem_beta_invite(text, text) to anon, authenticated;

-- Closed-beta invitation links (self-contained).
\set ON_ERROR_STOP 1
create or replace function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  begin execute stmt; exception when others then
    raise notice 'ok (expected failure) %: [%] %', label, sqlstate, sqlerrm; return; end;
  raise exception 'EXPECTED FAILURE did not happen: %', label;
end $$;
create or replace function pg_temp.expect(cond boolean, label text) returns void
language plpgsql as $$
begin if cond is not true then raise exception 'ASSERTION FAILED: %', label; end if; end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated, anon;
grant execute on function pg_temp.expect(boolean, text) to authenticated, anon;

insert into public.beta_users (email, display_name, role) values
  ('inv-admin@invite.test', 'Inv Admin', 'admin'),
  ('inv-tester@invite.test', 'Inv Tester', 'beta_tester'),
  ('inv-gone@invite.test', 'Inv Gone', 'beta_tester')
on conflict (email) do nothing;
update public.beta_users set active = false where email = 'inv-gone@invite.test';
insert into auth.users (id, email) values
  ('f4000000-0000-0000-0000-00000000000a', 'inv-admin@invite.test'),
  ('f4000000-0000-0000-0000-00000000000b', 'inv-tester@invite.test');

-- The admin creates links; they are marked as theirs.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"f4000000-0000-0000-0000-00000000000a","email":"inv-admin@invite.test","role":"authenticated"}', false);
insert into public.beta_invites (code, label) values ('ABCDEFGHJK', 'Friend'), ('BCDEFGHJKL', ''), ('CDEFGHJKLM', 'Later');
select pg_temp.expect((select count(*) = 3 and bool_and(created_by = 'f4000000-0000-0000-0000-00000000000a')
  and bool_and(redeemed_at is null and expires_at > now() + interval '29 days')
  from public.beta_invites where code in ('ABCDEFGHJK', 'BCDEFGHJKL', 'CDEFGHJKLM')), 'the admin creates 30-day links');
select pg_temp.expect_error($$insert into public.beta_invites (code) values ('ABCDE')$$, 'a code has 10 characters');
select pg_temp.expect_error($$insert into public.beta_invites (code) values ('OBCDEFGHJK')$$, 'a code has no look-alike characters');
select pg_temp.expect_error($$insert into public.beta_invites (code, redeemed_at) values ('DEFGHJKLMN', now())$$,
  'the admin cannot create a link marked as used');
select pg_temp.expect_error($$update public.beta_invites set redeemed_at = now() where code = 'BCDEFGHJKL'$$,
  'the admin cannot mark a link as used');
select pg_temp.expect_error($$delete from public.beta_invites where code = 'ABCDEFGHJK'$$, 'links are cancelled, never deleted');
update public.beta_invites set revoked_at = now() where code = 'CDEFGHJKLM';
select pg_temp.expect((select revoked_at is not null from public.beta_invites where code = 'CDEFGHJKLM'), 'the admin cancels a link');

-- A tester sees no link and cannot create or cancel one.
select set_config('request.jwt.claims', '{"sub":"f4000000-0000-0000-0000-00000000000b","email":"inv-tester@invite.test","role":"authenticated"}', false);
select pg_temp.expect((select count(*) = 0 from public.beta_invites), 'a tester sees no invitation');
select pg_temp.expect_error($$insert into public.beta_invites (code) values ('EFGHJKLMNP')$$, 'a tester cannot create an invitation');
update public.beta_invites set revoked_at = now() where code = 'ABCDEFGHJK';
reset role;
select pg_temp.expect((select revoked_at is null from public.beta_invites where code = 'ABCDEFGHJK'), 'a tester cannot cancel a link');

-- Anyone holding a link can use it, once, with their own email.
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.expect_error($$select * from public.beta_invites$$, 'anonymous visitors cannot list invitations');
select pg_temp.expect_error($$select * from public.beta_users$$, 'anonymous visitors cannot read the whitelist');
select pg_temp.expect(public.redeem_beta_invite('abcde-fghjk', ' Friend@Invite.TEST '), 'a friend uses a link, typed loosely');
select pg_temp.expect(not public.redeem_beta_invite('ABCDEFGHJK', 'other@invite.test'), 'a link works once');
select pg_temp.expect(not public.redeem_beta_invite('CDEFGHJKLM', 'other@invite.test'), 'a cancelled link does not work');
select pg_temp.expect(not public.redeem_beta_invite('ZZZZZZZZZZ', 'other@invite.test'), 'an unknown code does not work');
select pg_temp.expect(not public.redeem_beta_invite(null, 'other@invite.test'), 'no code does not work');
select pg_temp.expect(not public.redeem_beta_invite('BCDEFGHJKL', 'not-an-email'), 'an invalid email is refused');
select pg_temp.expect(not public.redeem_beta_invite('BCDEFGHJKL', 'inv-gone@invite.test'), 'a deactivated tester is not let back in');
select pg_temp.expect(public.redeem_beta_invite('BCDEFGHJKL', 'inv-tester@invite.test'), 'someone already invited is accepted');
reset role;
select pg_temp.expect((select redeemed_at is null from public.beta_invites where code = 'BCDEFGHJKL'),
  'refusals and already-invited emails leave the link unused');
select pg_temp.expect((select active from public.beta_users where email = 'inv-gone@invite.test') = false,
  'the deactivated tester stays deactivated');
select pg_temp.expect((select b.active and b.role = 'beta_tester' and b.display_name = 'Friend' and i.redeemed_at is not null
  from public.beta_users b join public.beta_invites i on i.id = b.invite_id where b.email = 'friend@invite.test'),
  'the friend joins the whitelist as a tester, through that link');

-- Without a name on the link, the tester is listed under the start of their email.
set role anon;
select pg_temp.expect(public.redeem_beta_invite('BCDEFGHJKL', 'nameless@invite.test'), 'a link without a name works');
reset role;
select pg_temp.expect((select display_name = 'nameless' from public.beta_users where email = 'nameless@invite.test'),
  'a nameless link lists the tester by email name');

-- An expired link does not work.
insert into public.beta_invites (code, label, expires_at) values ('FGHJKLMNPQ', 'Late', now() - interval '1 minute');
set role anon;
select pg_temp.expect(not public.redeem_beta_invite('FGHJKLMNPQ', 'late@invite.test'), 'an expired link does not work');
reset role;
select pg_temp.expect(not exists (select 1 from public.beta_users where email in ('late@invite.test', 'other@invite.test')),
  'refused emails are not added');

-- The friend's account now passes the whitelist trigger; a refused one does not.
insert into auth.users (id, email) values ('f4000000-0000-0000-0000-00000000000c', 'Friend@invite.test');
select pg_temp.expect(exists (select 1 from auth.users where id = 'f4000000-0000-0000-0000-00000000000c'),
  'the invited friend can create an account');
select pg_temp.expect_error($$insert into auth.users (id, email) values ('f4000000-0000-0000-0000-00000000000d', 'other@invite.test')$$,
  'an email whose link was refused still cannot sign up');

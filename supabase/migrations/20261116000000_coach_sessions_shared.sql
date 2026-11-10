-- Coach sessions for everyone: a coach session can be SHARED, i.e. offered to
-- every active climber (the coach's library), not only to the climber whose key
-- wrote it. Only a key belonging to a beta administrator can share; anyone else
-- still writes private sessions. A shared session is read-only for the others:
-- only its owner (through the app or the key) can replace or remove it.
-- Shared content must not contain anyone's personal or health details.

alter table public.coach_sessions add column shared boolean not null default false;
create index coach_sessions_shared on public.coach_sessions (updated_at desc) where shared;

drop policy coach_sessions_select on public.coach_sessions;
create policy coach_sessions_select on public.coach_sessions for select to authenticated
  using ((user_id = auth.uid() or shared) and public.is_active_beta_user());
-- coach_sessions_delete is unchanged: own rows only.

drop function public.coach_key_put_session(text, text, text, text, integer, text, jsonb);
create or replace function public.coach_key_put_session(
  p_key text, p_slug text, p_title text, p_objective text, p_minutes integer, p_place text, p_content jsonb,
  p_shared boolean default false
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
  v_id uuid;
begin
  if coalesce(p_shared, false) and not exists (
    select 1 from auth.users u join public.beta_users b on b.email = lower(u.email)
    where u.id = v_user and b.active and b.role = 'admin'
  ) then
    raise exception 'forbidden_shared' using errcode = '42501';
  end if;
  if not exists (select 1 from public.coach_sessions where user_id = v_user and slug = p_slug)
     and (select count(*) from public.coach_sessions where user_id = v_user) >= 100 then
    raise exception 'too_many_sessions' using errcode = 'P0001';
  end if;
  insert into public.coach_sessions (user_id, slug, title, objective, minutes, place, author, content, shared)
  values (v_user, p_slug, p_title, coalesce(p_objective, ''), p_minutes, p_place, 'CLAUDE', p_content, coalesce(p_shared, false))
  on conflict (user_id, slug) do update set
    title = excluded.title, objective = excluded.objective, minutes = excluded.minutes,
    place = excluded.place, content = excluded.content, shared = excluded.shared
  returning id into v_id;
  return v_id;
end $$;

drop function public.coach_key_list_sessions(text);
create or replace function public.coach_key_list_sessions(p_key text)
returns table (slug text, title text, minutes integer, shared boolean, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
begin
  return query select c.slug, c.title, c.minutes, c.shared, c.updated_at
    from public.coach_sessions c where c.user_id = v_user order by c.updated_at desc;
end $$;

revoke all on function public.coach_key_put_session(text, text, text, text, integer, text, jsonb, boolean),
  public.coach_key_list_sessions(text) from public;
grant execute on function public.coach_key_put_session(text, text, text, text, integer, text, jsonb, boolean),
  public.coach_key_list_sessions(text) to anon, authenticated;

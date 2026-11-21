-- Room for the shared coach library. Every shared session is written by an
-- administrator's key, so the 100-sessions-per-account cap also capped the
-- library offered to every climber (it reached 100 on 2026-11-21). An
-- administrator's key may now hold up to 500 sessions; every other key keeps 100.
-- Same signature, grants and behaviour otherwise (20261116000000_coach_sessions_shared).

create or replace function public.coach_key_put_session(
  p_key text, p_slug text, p_title text, p_objective text, p_minutes integer, p_place text, p_content jsonb,
  p_shared boolean default false
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := public.coach_key_owner(p_key);
  v_admin boolean;
  v_id uuid;
begin
  v_admin := exists (
    select 1 from auth.users u join public.beta_users b on b.email = lower(u.email)
    where u.id = v_user and b.active and b.role = 'admin'
  );
  if coalesce(p_shared, false) and not v_admin then
    raise exception 'forbidden_shared' using errcode = '42501';
  end if;
  if not exists (select 1 from public.coach_sessions where user_id = v_user and slug = p_slug)
     and (select count(*) from public.coach_sessions where user_id = v_user) >= (case when v_admin then 500 else 100 end) then
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

revoke all on function public.coach_key_put_session(text, text, text, text, integer, text, jsonb, boolean) from public;
grant execute on function public.coach_key_put_session(text, text, text, text, integer, text, jsonb, boolean) to anon, authenticated;

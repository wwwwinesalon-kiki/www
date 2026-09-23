-- Apply after 20260912000000_minimal_publishing.sql, or after WWW-03 preparation.
-- This migration enforces a paid service-month window for member-only articles.
begin;

alter table public.article_entitlements
  add column valid_from timestamptz;

create or replace function public.has_article_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.article_entitlements e
    where e.user_id = (select auth.uid())
      and e.allowed and e.verified_at is not null
      and e.valid_from <= now() and e.valid_until > now()
  );
$$;
revoke all on function public.has_article_access() from public, anon;
grant execute on function public.has_article_access() to authenticated;

drop policy if exists "members read visible contents" on public.contents;
drop policy if exists "qualified readers or publishing editors" on public.contents;
create policy "qualified readers or publishing editors" on public.contents
  for select to authenticated using (
    public.can_edit() or (
      publish_status='published' and deleted_at is null and archived_at is null
      and (public_visible or (member_visible and public.has_article_access()))
    )
  );

drop function public.apply_kaihipay_snapshot(text,text,boolean,timestamptz,timestamptz);
create function public.apply_kaihipay_snapshot(
  p_event_id text, p_member_id text, p_allowed boolean,
  p_verified_at timestamptz, p_valid_from timestamptz, p_valid_until timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare existing public.article_entitlements;
begin
  select * into existing from public.article_entitlements
    where provider_member_id=p_member_id for update;
  if not found then raise exception 'verified_binding_required'; end if;
  if p_verified_at is null or p_verified_at > now() + interval '1 minute' then
    raise exception 'invalid_verification_time';
  end if;
  if p_allowed and (p_valid_from is null or p_valid_until is null
    or p_valid_until <= p_valid_from) then
    raise exception 'invalid_paid_window';
  end if;
  if existing.verified_at is null or p_verified_at > existing.verified_at then
    update public.article_entitlements set
      allowed=p_allowed, verified_at=p_verified_at,
      valid_from=case when p_allowed then p_valid_from else null end,
      valid_until=case when p_allowed then p_valid_until else null end
    where user_id=existing.user_id;
  end if;
  update public.kaihipay_sync_events set processed_at=now(), error_code=null
    where event_id=p_event_id and provider_member_id=p_member_id;
  return true;
end;
$$;
revoke all on function public.apply_kaihipay_snapshot(text,text,boolean,timestamptz,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.apply_kaihipay_snapshot(text,text,boolean,timestamptz,timestamptz,timestamptz)
  to service_role;

commit;

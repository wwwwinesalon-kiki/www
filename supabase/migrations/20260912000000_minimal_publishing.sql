-- Review on isolated Supabase first. No destructive conversion of legacy data.
begin;
alter table public.contents add column body_format text not null default 'plain' check (body_format in ('plain','html'));
alter table public.contents add column cover_alt text not null default '';
-- Keep existing categories and allow editorial categories without rewriting rows.
alter table public.contents drop constraint if exists contents_type_check;
alter table public.contents add constraint contents_type_check check (type ~ '^[A-Z_]{1,40}$');

create table public.article_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider_member_id text not null unique,
  allowed boolean not null default false,
  verified_at timestamptz,
  valid_until timestamptz,
  check (not allowed or (verified_at is not null and valid_until is not null))
);
alter table public.article_entitlements enable row level security;
revoke all on public.article_entitlements from anon, authenticated;
grant select on public.article_entitlements to authenticated;
grant all on public.article_entitlements to service_role;
create policy "own entitlement read" on public.article_entitlements for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.has_article_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.article_entitlements e where e.user_id=(select auth.uid())
    and e.allowed and e.verified_at is not null and e.valid_until > now());
$$;
revoke all on function public.has_article_access() from public, anon;
grant execute on function public.has_article_access() to authenticated;

drop policy "members read visible contents" on public.contents;
create policy "qualified readers or publishing editors" on public.contents for select to authenticated using (
  public.can_edit() or (publish_status='published' and deleted_at is null and archived_at is null
    and (public_visible or (member_visible and public.has_article_access())))
);
-- No implicit migration from profiles.status='active': legacy access requires verified binding.
revoke execute on function public.admin_update_profile(uuid,public.app_role,public.member_status) from authenticated;

create table public.article_media (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null,
  object_path text not null unique,
  alt text not null check (length(alt) between 1 and 500),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  created_at timestamptz not null default now()
);
-- article_id deliberately accepts not-yet-saved drafts. It is immutable to readers.
create index article_media_article_idx on public.article_media(article_id);
alter table public.article_media enable row level security;
revoke all on public.article_media from anon, authenticated;
grant select, insert on public.article_media to authenticated;
grant all on public.article_media to service_role;
create policy "editors attach images" on public.article_media for insert to authenticated with check (public.can_edit());
create policy "images follow article visibility" on public.article_media for select to authenticated using (
  public.can_edit() or (public.has_article_access() and exists(select 1 from public.contents c
    where c.id=article_id and c.publish_status='published' and c.member_visible and c.deleted_at is null and c.archived_at is null
    and (c.cover_image='/api/media/'||article_media.id::text or
      (c.body_format='html' and position('src="/api/media/'||article_media.id::text||'"' in c.body)>0))))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('www-article-images','www-article-images',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy "editors upload article images" on storage.objects for insert to authenticated
with check (bucket_id='www-article-images' and public.can_edit());
-- No client SELECT policy on Storage: server streams after RLS and entitlement checks.
-- This prevents members minting long-lived signed URLs.

create table public.kaihipay_sync_events (
  event_id text primary key,
  provider_member_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  error_code text
);
alter table public.kaihipay_sync_events enable row level security;
revoke all on public.kaihipay_sync_events from anon, authenticated;
grant all on public.kaihipay_sync_events to service_role;
create table public.kaihipay_invitation_jobs (
  provider_member_id text primary key,
  user_id uuid unique references auth.users(id),
  status text not null check (status in ('sending','sent','review')),
  created_at timestamptz not null default now()
);
alter table public.kaihipay_invitation_jobs enable row level security;
revoke all on public.kaihipay_invitation_jobs from anon,authenticated;
grant all on public.kaihipay_invitation_jobs to service_role;
-- Only normalized references are stored, not full payment payloads or customer PII.
create or replace function public.apply_kaihipay_snapshot(
  p_event_id text, p_member_id text, p_allowed boolean, p_verified_at timestamptz, p_valid_until timestamptz
) returns boolean language plpgsql security definer set search_path='' as $$
declare existing public.article_entitlements;
begin
  select * into existing from public.article_entitlements where provider_member_id=p_member_id for update;
  if not found then raise exception 'verified_binding_required'; end if;
  if p_verified_at is null or p_verified_at > now() + interval '1 minute' then raise exception 'invalid_verification_time'; end if;
  if existing.verified_at is null or p_verified_at > existing.verified_at then
    update public.article_entitlements set allowed=p_allowed,verified_at=p_verified_at,valid_until=p_valid_until
      where user_id=existing.user_id;
  end if;
  update public.kaihipay_sync_events set processed_at=now(),error_code=null where event_id=p_event_id and provider_member_id=p_member_id;
  return true;
end;
$$;
revoke all on function public.apply_kaihipay_snapshot(text,text,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_kaihipay_snapshot(text,text,boolean,timestamptz,timestamptz) to service_role;
commit;

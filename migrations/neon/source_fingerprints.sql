-- Read-only. Run in Supabase SQL Editor with the live writer paused.
-- Compare this result with Neon: select * from public.www_migration_fingerprints();
-- PostgreSQL JSONB canonicalizes key order; UTC makes timestamp text stable.
set time zone 'UTC';
select 'profiles' as table_name, count(*)::bigint as row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id::text), '')) as fingerprint
  from public.profiles t
union all select 'events', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id::text), ''))
  from public.events t
union all select 'contents', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id::text), ''))
  from public.contents t
union all select 'event_applications', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id::text), ''))
  from public.event_applications t
union all select 'article_entitlements', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.user_id::text), ''))
  from public.article_entitlements t
union all select 'article_media', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id::text), ''))
  from public.article_media t
union all select 'kaihipay_sync_events', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.event_id), ''))
  from public.kaihipay_sync_events t
union all select 'kaihipay_invitation_jobs', count(*)::bigint,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.provider_member_id), ''))
  from public.kaihipay_invitation_jobs t;

-- Use only for a newly created, empty Neon database after 0001_www_schema.sql.
-- This does not recover data from a deleted Supabase project. Never run this
-- against a database that contains imported or production records.
begin;

do $$
begin
  if (select activated_at from public.www_migration_control where singleton) is not null then
    raise exception 'backend_already_activated';
  end if;

  if exists (select 1 from public.profiles)
    or exists (select 1 from public.www_auth_links)
    or exists (select 1 from public.events)
    or exists (select 1 from public.contents)
    or exists (select 1 from public.event_applications)
    or exists (select 1 from public.article_entitlements)
    or exists (select 1 from public.article_media)
    or exists (select 1 from public.kaihipay_sync_events)
    or exists (select 1 from public.kaihipay_invitation_jobs)
    or exists (select 1 from public.www_pending_claims)
    or exists (select 1 from public.www_claim_lookup_throttle)
    or exists (select 1 from public.www_media_migration_status)
    or exists (select 1 from public.www_media_inventory_checkpoint)
    or exists (select 1 from public.www_migration_baseline) then
    raise exception 'fresh_start_requires_empty_database';
  end if;
end;
$$;

create trigger www_scrub_new_event_application_contact
before insert on public.event_applications
for each row execute function public.www_scrub_new_event_application_contact();

update public.www_migration_control
set activated_at = now()
where singleton and activated_at is null;

commit;

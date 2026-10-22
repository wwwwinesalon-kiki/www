-- Execute only after importing ALL eight tables, verifying private object
-- bytes, and recording the source fingerprints in www_migration_baseline.
-- This is transactional: a mismatch installs no trigger and does not activate.
begin;
do $$
declare
  actual record;
  expected record;
begin
  if (select count(*) from public.www_migration_baseline) <> 8 then
    raise exception 'migration_baseline_incomplete';
  end if;
  for actual in select * from public.www_migration_fingerprints() loop
    select b.expected_rows, b.expected_fingerprint into expected
      from public.www_migration_baseline b where b.table_name = actual.table_name;
    if not found or expected.expected_rows <> actual.row_count
      or expected.expected_fingerprint <> actual.fingerprint then
      raise exception 'migration_data_mismatch: %', actual.table_name;
    end if;
  end loop;
  if exists (
    select 1 from public.article_media m
    left join public.www_media_migration_status s on s.media_id = m.id
    where s.media_id is null
  ) then
    raise exception 'private_media_not_verified';
  end if;
  if not exists (
    select 1 from public.www_media_inventory_checkpoint i
    where i.singleton
      and i.source_object_count = (select count(*) from public.article_media)
      and i.source_object_count = (select count(*) from public.www_media_migration_status)
      and i.source_keys_md5 = (
        select md5(coalesce(string_agg(m.object_path, E'\n'
          order by m.object_path collate "C"), ''))
        from public.article_media m
      )
      and i.source_keys_sha256 = (
        select encode(sha256(convert_to(coalesce(
          string_agg(m.object_path, E'\n' order by m.object_path collate "C"),
          ''), 'UTF8')), 'hex')
        from public.article_media m
      )
  ) then
    raise exception 'private_media_inventory_not_verified';
  end if;
end;
$$;

create trigger www_scrub_new_event_application_contact
before insert on public.event_applications
for each row execute function public.www_scrub_new_event_application_contact();

update public.www_migration_control set activated_at = now() where singleton;
commit;

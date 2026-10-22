-- Fresh Neon PostgreSQL database only. Do not run on Supabase or an occupied database.
-- Keep the legacy domain UUIDs so imported articles, reservations, and entitlement links
-- retain their original relationships. Neon Auth subjects are bound separately.
begin;

create type public.app_role as enum ('member', 'viewer', 'editor', 'owner');
create type public.member_status as enum ('pending', 'active', 'pause', 'churned');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null default '',
  name text not null default '',
  role public.app_role not null default 'member',
  status public.member_status not null default 'pending',
  kaihipay_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A matching email address is NOT sufficient to create this link. The server must
-- verify the Neon Auth session, and an operator must verify a migrated legacy identity.
create table public.www_auth_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  auth_subject text not null unique check (length(auth_subject) between 1 and 255),
  legacy_supabase_user_id uuid unique,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  event_type text not null default 'salon',
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  venue text not null,
  capacity integer not null default 20 check (capacity > 0),
  price integer not null default 0 check (price >= 0),
  member_only boolean not null default false,
  registration_enabled boolean not null default true,
  waitlist_enabled boolean not null default false,
  public_visible boolean not null default true,
  member_visible boolean not null default true,
  publish_status text not null default 'draft' check (publish_status in ('draft', 'published')),
  cover_image text,
  items_to_bring text,
  precautions text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type ~ '^[A-Z_]{1,40}$'),
  title text not null,
  slug text not null unique,
  summary text,
  body text not null default '',
  tags text,
  cover_image text,
  audio text,
  public_visible boolean not null default false,
  member_visible boolean not null default true,
  publish_status text not null default 'draft' check (publish_status in ('draft', 'published')),
  published_at timestamptz,
  is_new boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  body_format text not null default 'plain' check (body_format in ('plain', 'html')),
  cover_alt text not null default ''
);

create table public.event_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  line_name text,
  note text,
  application_status text not null default 'applied',
  payment_status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.article_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider_member_id text not null unique,
  allowed boolean not null default false,
  verified_at timestamptz,
  valid_until timestamptz,
  valid_from timestamptz,
  check (not allowed or (
    verified_at is not null and valid_from is not null and
    valid_until is not null and valid_until > valid_from
  ))
);

create table public.article_media (
  id uuid primary key default gen_random_uuid(),
  -- No FK: the editor can upload images before it saves a draft article.
  article_id uuid not null,
  object_path text not null unique,
  alt text not null check (length(alt) between 1 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 3145728),
  created_at timestamptz not null default now()
);

-- A metadata row is not proof that the object bytes were moved. Serve private
-- media only after a byte-for-byte SHA-256 comparison has populated this table.
create table public.www_media_migration_status (
  media_id uuid primary key references public.article_media(id) on delete cascade,
  target_object_key text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null
);

-- Recorded only after recursively listing the entire private source bucket,
-- rejecting unreferenced/missing keys, verifying bytes, and listing it again.
-- A retry clears this checkpoint before any source reads, so failure stays closed.
create table public.www_media_inventory_checkpoint (
  singleton boolean primary key default true check (singleton),
  source_bucket text not null check (source_bucket = 'www-article-images'),
  source_object_count bigint not null check (source_object_count >= 0),
  source_keys_md5 text not null check (source_keys_md5 ~ '^[0-9a-f]{32}$'),
  source_keys_sha256 text not null check (source_keys_sha256 ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null
);

-- Cutover stays closed until source/target fingerprints and private bytes match.
create table public.www_migration_baseline (
  table_name text primary key,
  expected_rows bigint not null check (expected_rows >= 0),
  expected_fingerprint text not null check (expected_fingerprint ~ '^[0-9a-f]{32}$')
);
create table public.www_migration_control (
  singleton boolean primary key default true check (singleton),
  activated_at timestamptz
);
insert into public.www_migration_control(singleton) values (true);

create table public.kaihipay_sync_events (
  event_id text primary key,
  provider_member_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  error_code text
);

create table public.kaihipay_invitation_jobs (
  provider_member_id text primary key,
  user_id uuid unique references public.profiles(id),
  status text not null check (status in ('sending', 'sent', 'review')),
  created_at timestamptz not null default now()
);

-- Future paid members (none yet at migration time) can claim access after
-- verifying the same email with Neon Auth. HMAC-SHA256 is computed server-side
-- from the normalized Kaihipay email; no raw customer email is kept here.
create table public.www_pending_claims (
  provider_member_id text primary key,
  email_hmac text not null unique check (email_hmac ~ '^[0-9a-f]{64}$'),
  allowed boolean not null default false,
  verified_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  claimed_profile_id uuid unique references public.profiles(id),
  claimed_at timestamptz,
  check (not allowed or (
    verified_at is not null and valid_from is not null and
    valid_until is not null and valid_until > valid_from
  )),
  check ((claimed_profile_id is null) = (claimed_at is null))
);

-- A verified-but-unpaid user may request an immediate provider lookup. Keep only
-- a keyed HMAC and a short throttle window to bound authenticated API probing.
create table public.www_claim_lookup_throttle (
  email_hmac text primary key check (email_hmac ~ '^[0-9a-f]{64}$'),
  next_allowed_at timestamptz not null
);

create index profiles_role_idx on public.profiles(role);
create index events_publish_idx on public.events(publish_status, start_at);
create index contents_publish_idx on public.contents(publish_status, published_at desc);
create index applications_event_idx on public.event_applications(event_id);
create index applications_user_idx on public.event_applications(user_id);
create index article_media_article_idx on public.article_media(article_id);

-- Run the matching read-only source_fingerprints.sql in Supabase before export
-- and again immediately before cutover. The same canonical JSONB row hash is
-- computed here for the eight legacy tables. Keep PostgreSQL timezone at UTC.
create function public.www_migration_fingerprints()
returns table(table_name text, row_count bigint, fingerprint text)
language sql stable set search_path = '' set timezone = 'UTC' as $$
  select 'profiles', count(*)::bigint,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by t.id::text), ''))
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
$$;

-- Historical contact fields are imported intact, but the new booking flow does
-- not collect or duplicate Kaihipay customer contact data.
create function public.www_scrub_new_event_application_contact()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := 'WWW会員';
  new.email := 'not-collected@example.invalid';
  new.line_name := null;
  new.note := null;
  return new;
end;
$$;
-- The trigger is installed by 0002_activate.sql AFTER historical rows are
-- imported, so legacy application contacts are not modified in transit.

-- All auth_subject arguments must come from a server-verified Neon Auth session.
-- No browser/client database connection or Data API access is permitted.
create function public.www_member_access(p_auth_subject text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
      from public.www_auth_links l
      join public.profiles p on p.id = l.profile_id
      join public.article_entitlements e on e.user_id = l.profile_id
     where l.auth_subject = p_auth_subject
       and exists (select 1 from public.www_migration_control c
                    where c.singleton and c.activated_at is not null)
       and l.verified_at is not null
       and p.status = 'active'
       and e.allowed
       and e.verified_at is not null
       -- Daily reconciliation is expected at 03:00 UTC. After two missed
       -- runs, fail closed rather than preserving a reversed payment grant
       -- until the end of its originally paid month.
       and e.verified_at >= now() - interval '48 hours'
       and e.verified_at <= now() + interval '1 minute'
       and e.valid_from <= now()
       and e.valid_until > now()
  );
$$;

-- The event row lock serializes seat allocation across concurrent requests.
-- Contact fields are deliberately not accepted; payment for events is separate.
create function public.www_apply_to_member_event(
  p_auth_subject text, p_event_id uuid
) returns table(application_id uuid, application_status text)
language plpgsql set search_path = '' as $$
declare
  actor_id uuid;
  event_row public.events;
  seat_count integer;
  result_status text;
  result_id uuid;
begin
  select l.profile_id into actor_id
    from public.www_auth_links l where l.auth_subject = p_auth_subject;
  if actor_id is null or not public.www_member_access(p_auth_subject) then
    raise exception 'membership_required';
  end if;

  select * into event_row from public.events
    where id = p_event_id and publish_status = 'published'
      and deleted_at is null and archived_at is null
      and registration_enabled and start_at > now()
    for update;
  if not found then raise exception 'registration_closed'; end if;

  if exists (
    select 1 from public.event_applications a
     where a.event_id = p_event_id and a.user_id = actor_id
       and a.deleted_at is null and a.application_status <> 'cancelled'
  ) then raise exception 'already_applied'; end if;

  select count(*) into seat_count from public.event_applications a
   where a.event_id = p_event_id and a.deleted_at is null
     and a.application_status in ('pending', 'approved', 'attended');
  if seat_count >= event_row.capacity and not event_row.waitlist_enabled then
    raise exception 'registration_full';
  end if;
  result_status := case when seat_count >= event_row.capacity then 'waitlist' else 'pending' end;
  insert into public.event_applications (
    event_id, user_id, name, email, application_status
  ) values (
    p_event_id, actor_id, 'WWW会員', 'not-collected@example.invalid', result_status
  ) returning id into result_id;
  return query select result_id, result_status;
end;
$$;

-- Only the server-side Kaihipay worker may call this function. It requires an
-- existing verified binding and queued event, and ignores stale snapshots.
create function public.www_apply_kaihipay_snapshot(
  p_event_id text, p_member_id text, p_allowed boolean,
  p_verified_at timestamptz, p_valid_from timestamptz, p_valid_until timestamptz
) returns boolean language plpgsql set search_path = '' as $$
declare
  existing public.article_entitlements;
  queued public.kaihipay_sync_events;
begin
  if not exists (select 1 from public.www_migration_control c
                  where c.singleton and c.activated_at is not null) then
    raise exception 'migration_not_activated';
  end if;
  select * into queued from public.kaihipay_sync_events
   where event_id = p_event_id and provider_member_id = p_member_id for update;
  if not found then raise exception 'queued_event_required'; end if;
  select * into existing from public.article_entitlements
   where provider_member_id = p_member_id for update;
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
      allowed = p_allowed,
      verified_at = p_verified_at,
      valid_from = case when p_allowed then p_valid_from else null end,
      valid_until = case when p_allowed then p_valid_until else null end
     where user_id = existing.user_id;
  end if;
  update public.kaihipay_sync_events set processed_at = now(), error_code = null
   where event_id = p_event_id and provider_member_id = p_member_id;
  return true;
end;
$$;

-- Subject and HMAC must be derived by the server from a verified Neon Auth
-- session (emailVerified=true). The database cannot authenticate these args.
-- Row locks, unique keys, and one transaction prevent a claim being redeemed
-- by two accounts. An existing profile may be reused only if not bound to a
-- different Kaihipay member. Payment reversal is enforced by the worker's
-- authoritative snapshot updates to article_entitlements.
create function public.www_claim_paid_membership(
  p_auth_subject text, p_email_hmac text
) returns uuid language plpgsql set search_path = '' as $$
declare
  claim public.www_pending_claims;
  actor_id uuid;
  existing_member_id text;
  existing_allowed boolean;
  existing_verified_at timestamptz;
begin
  if not exists (select 1 from public.www_migration_control c
                  where c.singleton and c.activated_at is not null) then
    raise exception 'migration_not_activated';
  end if;
  if nullif(btrim(p_auth_subject), '') is null or
     p_email_hmac !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_claim_identity';
  end if;
  select * into claim from public.www_pending_claims
   where email_hmac = p_email_hmac for update;
  if not found or not claim.allowed or claim.verified_at is null or
     claim.valid_from > now() or claim.valid_until <= now() then
    raise exception 'no_current_paid_claim';
  end if;
  if claim.verified_at < now() - interval '5 minutes' then
    raise exception 'claim_snapshot_stale';
  end if;

  select l.profile_id into actor_id from public.www_auth_links l
   where l.auth_subject = p_auth_subject;
  if claim.claimed_profile_id is not null and
     (actor_id is null or claim.claimed_profile_id <> actor_id) then
    raise exception 'claim_already_bound';
  end if;
  if actor_id is null then
    insert into public.profiles(email, name, role, status)
      values('', '', 'member', 'active') returning id into actor_id;
    insert into public.www_auth_links(profile_id, auth_subject, verified_at)
      values(actor_id, p_auth_subject, now());
  end if;
  -- A verified, pre-existing pending member can become active after payment.
  -- Never change a suspended/churned account or elevate a staff profile here.
  update public.profiles set status = 'active', updated_at = now()
   where id = actor_id and role = 'member' and status = 'pending';

  select e.provider_member_id, e.allowed, e.verified_at
    into existing_member_id, existing_allowed, existing_verified_at
    from public.article_entitlements e where e.user_id = actor_id for update;
  if existing_member_id is not null and existing_member_id <> claim.provider_member_id then
    raise exception 'profile_already_bound_to_other_member';
  end if;
  -- A concurrent reconciliation may have applied a newer reversal before its
  -- pending-claim row is refreshed. Never restore an older payment snapshot.
  if existing_verified_at > claim.verified_at or
     (existing_verified_at = claim.verified_at and not existing_allowed) then
    raise exception 'claim_snapshot_superseded';
  end if;
  if existing_member_id is null then
    insert into public.article_entitlements(
      user_id, provider_member_id, allowed, verified_at, valid_from, valid_until
    ) values (
      actor_id, claim.provider_member_id, true, claim.verified_at,
      claim.valid_from, claim.valid_until
    );
  else
    update public.article_entitlements set
      allowed = true, verified_at = claim.verified_at,
      valid_from = claim.valid_from, valid_until = claim.valid_until
     where user_id = actor_id;
  end if;
  update public.www_pending_claims set
    claimed_profile_id = actor_id, claimed_at = coalesce(claimed_at, now())
   where provider_member_id = claim.provider_member_id;
  return actor_id;
end;
$$;

-- Neon connections are server-only. Never publish the database URL or give the
-- browser a direct SQL/Data API credential. In particular, the subject-taking
-- functions cannot authenticate their own argument.
revoke all on public.profiles, public.www_auth_links, public.events,
  public.contents, public.event_applications, public.article_entitlements,
  public.article_media, public.www_media_migration_status,
  public.www_media_inventory_checkpoint,
  public.www_migration_baseline, public.www_migration_control,
  public.kaihipay_sync_events, public.kaihipay_invitation_jobs,
  public.www_pending_claims, public.www_claim_lookup_throttle from public;
revoke all on function public.www_member_access(text),
  public.www_apply_to_member_event(text, uuid),
  public.www_apply_kaihipay_snapshot(text, text, boolean, timestamptz, timestamptz, timestamptz),
  public.www_claim_paid_membership(text, text),
  public.www_migration_fingerprints()
  from public;

commit;

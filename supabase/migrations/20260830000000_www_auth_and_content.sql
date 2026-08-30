create extension if not exists pgcrypto;

create type public.app_role as enum ('member','viewer','editor','owner');
create type public.member_status as enum ('pending','active','pause','churned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role public.app_role not null default 'member',
  status public.member_status not null default 'pending',
  kaihipay_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  publish_status text not null default 'draft' check (publish_status in ('draft','published')),
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
  type text not null check (type in ('PEOPLE','FIELD','TABLE','NEWS')),
  title text not null,
  slug text not null unique,
  summary text,
  body text not null default '',
  tags text,
  cover_image text,
  audio text,
  public_visible boolean not null default false,
  member_visible boolean not null default true,
  publish_status text not null default 'draft' check (publish_status in ('draft','published')),
  published_at timestamptz,
  is_new boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
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

create index profiles_role_idx on public.profiles(role);
create index events_publish_idx on public.events(publish_status, start_at);
create index contents_publish_idx on public.contents(publish_status, published_at desc);
create index applications_event_idx on public.event_applications(event_id);
create index applications_user_idx on public.event_applications(user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'name',''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('owner','editor','viewer')
  );
$$;

create or replace function public.can_edit()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('owner','editor')
  );
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.contents enable row level security;
alter table public.event_applications enable row level security;

revoke all on public.profiles, public.events, public.contents, public.event_applications from anon, authenticated;
grant select on public.events, public.contents to anon;
grant select on public.profiles, public.events, public.contents, public.event_applications to authenticated;
grant insert on public.event_applications to anon, authenticated;
grant insert, update, delete on public.events, public.contents to authenticated;
grant update(name) on public.profiles to authenticated;
grant update on public.event_applications to authenticated;

create policy "public reads published events" on public.events for select to anon
using (publish_status='published' and public_visible and deleted_at is null and archived_at is null);
create policy "members read visible events" on public.events for select to authenticated
using ((publish_status='published' and member_visible and deleted_at is null and archived_at is null) or public.is_admin());
create policy "editors create events" on public.events for insert to authenticated with check (public.can_edit());
create policy "editors update events" on public.events for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "editors delete events" on public.events for delete to authenticated using (public.can_edit());

create policy "public reads published contents" on public.contents for select to anon
using (publish_status='published' and public_visible and deleted_at is null and archived_at is null);
create policy "members read visible contents" on public.contents for select to authenticated
using ((publish_status='published' and member_visible and deleted_at is null and archived_at is null) or public.is_admin());
create policy "editors create contents" on public.contents for insert to authenticated with check (public.can_edit());
create policy "editors update contents" on public.contents for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy "editors delete contents" on public.contents for delete to authenticated using (public.can_edit());

create policy "users read own profile" on public.profiles for select to authenticated
using (id=(select auth.uid()) or public.is_admin());
create policy "users update own profile" on public.profiles for update to authenticated
using (id=(select auth.uid())) with check (id=(select auth.uid()));
create or replace function public.admin_update_profile(
  target_id uuid,
  next_role public.app_role,
  next_status public.member_status
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit() then raise exception 'forbidden'; end if;
  update public.profiles set role=next_role,status=next_status,updated_at=now() where id=target_id;
end;
$$;
revoke execute on function public.admin_update_profile(uuid,public.app_role,public.member_status) from public, anon;
grant execute on function public.admin_update_profile(uuid,public.app_role,public.member_status) to authenticated;

create policy "anyone applies to open events" on public.event_applications for insert to anon, authenticated
with check (exists(select 1 from public.events e where e.id=event_id and e.registration_enabled and e.publish_status='published'));
create policy "users read own applications" on public.event_applications for select to authenticated
using (user_id=(select auth.uid()) or public.is_admin());
create policy "admins update applications" on public.event_applications for update to authenticated
using (public.can_edit()) with check (public.can_edit());

insert into public.events(title,slug,description,start_at,end_at,venue,capacity,price,publish_status)
values('WWW WINE SALON','www-wine-salon','ワインを囲みながら造り手と土地の物語に触れる会',now()+interval '30 days',now()+interval '30 days 2 hours','東京',20,8000,'published')
on conflict (slug) do nothing;

insert into public.contents(type,title,slug,summary,body,public_visible,publish_status,published_at,is_new)
values('NEWS','WWWからのお知らせ','www-start','Wine Work Womenの活動をご案内します','ワインから仕事と暮らしをつなぐ活動をお届けします',true,'published',now(),true)
on conflict (slug) do nothing;

-- 最初の管理者を作成した後にSQL Editorで次を実行してください
-- update public.profiles set role='owner',status='active' where email='YOUR_EMAIL';

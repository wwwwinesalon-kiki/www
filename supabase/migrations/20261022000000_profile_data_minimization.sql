-- Keep Auth as the login identity and Kaihipay as the customer record.
-- Existing profile values are intentionally retained until a reviewed cleanup.
begin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Legacy NOT NULL columns remain for compatibility but receive no customer data.
  insert into public.profiles(id,email,name) values(new.id,'','');
  return new;
end;
$$;

-- Prevent reading historic profile PII through the authenticated PostgREST role.
revoke select on public.profiles from authenticated;
grant select(id,role,status,created_at,updated_at) on public.profiles to authenticated;
revoke update(name) on public.profiles from authenticated;

-- Existing application contact fields stay in the table for reviewed retention,
-- but client sessions only need reservation identity and workflow state.
revoke select on public.event_applications from authenticated;
grant select(id,event_id,user_id,application_status,created_at,updated_at,deleted_at)
  on public.event_applications to authenticated;
revoke update on public.event_applications from authenticated;
grant update(application_status,deleted_at,updated_at)
  on public.event_applications to authenticated;

-- Also scrub direct RPC callers, not only the WWW form/API.
create or replace function public.scrub_new_event_application_contact()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := 'WWW会員';
  new.email := 'not-collected@example.invalid';
  new.line_name := null;
  new.note := null;
  return new;
end;
$$;
drop trigger if exists scrub_new_event_application_contact on public.event_applications;
create trigger scrub_new_event_application_contact
before insert on public.event_applications
for each row execute function public.scrub_new_event_application_contact();

commit;

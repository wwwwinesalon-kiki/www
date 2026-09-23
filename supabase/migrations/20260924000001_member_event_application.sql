-- Member reservations require paid access. The event row lock serializes seat allocation.
begin;
drop policy if exists "anyone applies to open events" on public.event_applications;
revoke insert on public.event_applications from anon, authenticated;

create function public.apply_to_member_event(
  p_event_id uuid, p_name text, p_email text, p_line_name text, p_note text
) returns table(application_id uuid, application_status text)
language plpgsql security definer set search_path = '' as $$
declare
  event_row public.events;
  seat_count integer;
  result_status text;
  result_id uuid;
begin
  if (select auth.uid()) is null or not public.has_article_access() then
    raise exception 'membership_required';
  end if;
  if nullif(btrim(p_name),'') is null or length(p_name)>100 or
     nullif(btrim(p_email),'') is null or length(p_email)>254 or
     length(coalesce(p_line_name,''))>100 or length(coalesce(p_note,''))>2000 then
    raise exception 'invalid_application';
  end if;
  select * into event_row from public.events
    where id=p_event_id and publish_status='published'
      and deleted_at is null and archived_at is null and registration_enabled
      and start_at>now()
    for update;
  if not found then raise exception 'registration_closed'; end if;
  if exists (select 1 from public.event_applications a
    where a.event_id=p_event_id and a.user_id=(select auth.uid())
      and a.deleted_at is null and a.application_status <> 'cancelled') then
    raise exception 'already_applied';
  end if;
  select count(*) into seat_count from public.event_applications a
    where a.event_id=p_event_id and a.deleted_at is null
      and a.application_status in ('pending','approved','attended');
  if seat_count >= event_row.capacity and not event_row.waitlist_enabled then
    raise exception 'registration_full';
  end if;
  result_status := case when seat_count >= event_row.capacity then 'waitlist' else 'pending' end;
  insert into public.event_applications(event_id,user_id,name,email,line_name,note,application_status)
    values (p_event_id,(select auth.uid()),btrim(p_name),btrim(p_email),
      nullif(btrim(p_line_name),''),nullif(btrim(p_note),''),result_status)
    returning id into result_id;
  return query select result_id,result_status;
end;
$$;
revoke all on function public.apply_to_member_event(uuid,text,text,text,text) from public,anon;
grant execute on function public.apply_to_member_event(uuid,text,text,text,text) to authenticated;
commit;

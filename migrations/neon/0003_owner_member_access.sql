-- An active, verified owner can inspect member content and workflows without
-- fabricating a Kaihipay payment. Ordinary members remain payment-gated.
create or replace function public.www_member_access(p_auth_subject text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
      from public.www_auth_links l
      join public.profiles p on p.id = l.profile_id
     where l.auth_subject = p_auth_subject
       and exists (select 1 from public.www_migration_control c
                    where c.singleton and c.activated_at is not null)
       and l.verified_at is not null
       and p.status = 'active'
       and (
         p.role = 'owner'
         or exists (
           select 1 from public.article_entitlements e
            where e.user_id = p.id
              and e.allowed
              and e.verified_at is not null
              and e.verified_at >= now() - interval '48 hours'
              and e.verified_at <= now() + interval '1 minute'
              and e.valid_from <= now()
              and e.valid_until > now()
         )
       )
  );
$$;

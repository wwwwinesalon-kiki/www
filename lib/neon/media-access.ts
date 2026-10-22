/** The same parameterized predicate is used by the route and DB security test. */
export const ARTICLE_MEDIA_ACCESS_SQL = `
  select m.object_path, m.mime_type
  from public.article_media m
  join public.www_media_migration_status verified
    on verified.media_id = m.id
   and verified.target_object_key = m.object_path
  where m.id = $1::uuid
    and (
      $2::boolean
      or (
        $3::boolean
        and exists (
          select 1 from public.contents c
          where c.id = m.article_id
            and c.publish_status = 'published'
            and c.member_visible = true
            and c.deleted_at is null
            and c.archived_at is null
            and (
              c.cover_image = '/api/media/' || m.id::text
              or (
                c.body_format = 'html'
                and position('src="/api/media/' || m.id::text || '"' in c.body) > 0
              )
            )
        )
      )
    )
  limit 1
`;

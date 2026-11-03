import { requireAdmin } from '@/lib/admin-auth';
import { eventWritePayload } from '@/lib/event-write';
import { saveArticle } from '@/lib/article-write';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { neonInsert } from '@/lib/neon/crud';

const tables = {
  events: 'events',
  contents: 'contents',
} as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity } = await params;
  if (entity === 'members')
    return Response.json(
      { error: '会員情報は会費ペイで管理してください' },
      { status: 410 },
    );
  const table = tables[entity as keyof typeof tables];
  if (!table)
    return Response.json({ error: 'Unknown entity' }, { status: 404 });
  if (isNeonBackend()) {
    const data = await neonSql().query(
      `select *, updated_at::text as updated_at_version from public.${table} where deleted_at is null and archived_at is null order by created_at desc limit 200`,
    ) as Record<string, unknown>[];
    if (table === 'contents') {
      for (const row of data) row.updated_at = row.updated_at_version;
    }
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const { data, error } = await actor.supabase
    .from(table)
    .select('*')
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity } = await params;
  if (entity === 'members')
    return Response.json(
      { error: '会員情報は会費ペイで管理してください' },
      { status: 422 },
    );
  if (entity === 'contents') return saveArticle(req, actor);
  const table = tables[entity as keyof typeof tables];
  if (!table)
    return Response.json({ error: 'Unknown entity' }, { status: 404 });
  let body = (await req.json()) as Record<string, unknown>;
  if (entity === 'events') {
    const { payload, errors } = eventWritePayload(body);
    if (Object.keys(errors).length)
      return Response.json({ errors }, { status: 422 });
    body = payload;
  }
  const allowed =
    entity === 'events'
      ? [
          'title',
          'slug',
          'event_type',
          'description',
          'start_at',
          'end_at',
          'venue',
          'capacity',
          'price',
          'member_only',
          'registration_enabled',
          'waitlist_enabled',
          'publish_status',
          'public_visible',
          'member_visible',
          'cover_image',
          'items_to_bring',
          'precautions',
        ]
      : [
          'type',
          'title',
          'slug',
          'summary',
          'body',
          'tags',
          'cover_image',
          'audio',
          'publish_status',
          'public_visible',
          'member_visible',
          'published_at',
          'is_new',
        ];
  const payload = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowed.includes(key)),
  );
  if (isNeonBackend()) {
    try {
      const data = await neonInsert(table, payload, allowed);
      return Response.json({ id: data?.id }, { status: 201 });
    } catch {
      return Response.json({ error: '保存できませんでした 入力を確認してください' }, { status: 422 });
    }
  }
  const { data, error } = await actor.supabase
    .from(table)
    .insert(payload)
    .select('id')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data, { status: 201 });
}

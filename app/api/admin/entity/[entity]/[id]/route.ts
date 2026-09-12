import { requireAdmin } from '@/lib/admin-auth';
import { saveArticle } from '@/lib/article-write';

const config = {
  events: {
    table: 'events',
    fields: [
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
      'archived_at',
    ],
  },
  contents: {
    table: 'contents',
    fields: [
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
      'archived_at',
      'is_new',
    ],
  },
  event_applications: {
    table: 'event_applications',
    fields: ['application_status', 'payment_status', 'note'],
  },
} as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity, id } = await params;
  if (entity === 'contents') return saveArticle(req, actor, id);
  if (entity === 'members')
    return Response.json(
      { error: '会員状態と権限の変更はこの画面では行いません' },
      { status: 410 },
    );
  const body = (await req.json()) as Record<string, unknown>;
  const item = config[entity as keyof typeof config];
  if (!item) return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const payload = Object.fromEntries(
    Object.entries(body).filter(([key]) =>
      (item.fields as readonly string[]).includes(key),
    ),
  );
  if (!Object.keys(payload).length)
    return Response.json({ error: 'No valid fields' }, { status: 422 });
  const { error } = await actor.supabase
    .from(item.table)
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error
    ? Response.json({ error: error.message }, { status: 422 })
    : Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity, id } = await params;
  if (entity === 'members')
    return Response.json(
      { error: '会員削除はSupabase Authで実行してください' },
      { status: 422 },
    );
  const item = config[entity as keyof typeof config];
  if (!item) return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const now = new Date().toISOString();
  const { error } = await actor.supabase
    .from(item.table)
    .update({
      ...(entity === 'event_applications' ? {} : { archived_at: now }),
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', id);
  return error
    ? Response.json({ error: error.message }, { status: 422 })
    : Response.json({ ok: true });
}

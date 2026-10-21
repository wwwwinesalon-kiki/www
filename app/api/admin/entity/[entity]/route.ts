import { requireAdmin } from '@/lib/admin-auth';
import { validateEvent } from '@/lib/domain';
import { saveArticle } from '@/lib/article-write';

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
  const { data, error } = await actor.supabase
    .from(table)
    .select('*')
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
      { error: '会員はSupabase Authで招待してください' },
      { status: 422 },
    );
  if (entity === 'contents') return saveArticle(req, actor);
  const table = tables[entity as keyof typeof tables];
  if (!table)
    return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const body = (await req.json()) as Record<string, unknown>;
  if (entity === 'events') {
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const errors = validateEvent({
      slug: text(body.slug),
      capacity: Number(body.capacity),
      price: Number(body.price),
      startAt: text(body.start_at),
      endAt: text(body.end_at),
    });
    if (Object.keys(errors).length)
      return Response.json({ errors }, { status: 422 });
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
  const { data, error } = await actor.supabase
    .from(table)
    .insert(payload)
    .select('id')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json(data, { status: 201 });
}

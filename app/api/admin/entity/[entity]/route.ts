import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { validateEvent } from '@/lib/domain';
const cfg = {
  members: { table: 'members', required: ['name', 'status'] },
  events: {
    table: 'events',
    required: [
      'title',
      'slug',
      'start_at',
      'end_at',
      'venue',
      'capacity',
      'price',
    ],
  },
  contents: { table: 'contents', required: ['type', 'title', 'slug', 'body'] },
} as const;
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  if (!(await requireAdmin(req)))
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity } = await params,
    c = cfg[entity as keyof typeof cfg];
  if (!c) return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${c.table} WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return Response.json(results);
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity } = await params,
    c = cfg[entity as keyof typeof cfg];
  if (!c) return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const b = (await req.json()) as Record<string, unknown>;
  if (c.required.some((k) => b[k] === undefined || b[k] === ''))
    return Response.json(
      { error: '必須項目を入力してください' },
      { status: 422 },
    );
  if (entity === 'events') {
    const errors = validateEvent({
      slug: String(b.slug),
      capacity: Number(b.capacity),
      price: Number(b.price),
      startAt: String(b.start_at),
      endAt: String(b.end_at),
    });
    if (Object.keys(errors).length)
      return Response.json({ errors }, { status: 422 });
  }
  const now = new Date().toISOString(),
    id = crypto.randomUUID();
  let sql = '',
    values: unknown[] = [];
  if (entity === 'members') {
    sql =
      'INSERT INTO members (id,name,line_name,email,status,joined_at,source,last_contact_at,interest_categories,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)';
    values = [
      id,
      b.name,
      b.line_name || null,
      b.email || null,
      b.status,
      b.joined_at || null,
      b.source || null,
      b.last_contact_at || null,
      JSON.stringify(b.interest_categories || []),
      b.notes || null,
      now,
      now,
    ];
  } else if (entity === 'events') {
    sql =
      'INSERT INTO events (id,title,slug,event_type,description,start_at,end_at,venue,capacity,price,member_only,registration_enabled,waitlist_enabled,publish_status,public_visible,member_visible,cover_image,items_to_bring,precautions,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
    values = [
      id,
      b.title,
      b.slug,
      b.event_type || 'その他',
      b.description || '',
      b.start_at,
      b.end_at,
      b.venue,
      Number(b.capacity),
      Number(b.price),
      b.member_only ? 1 : 0,
      b.registration_enabled ? 1 : 0,
      b.waitlist_enabled ? 1 : 0,
      b.publish_status || 'draft',
      b.public_visible ? 1 : 0,
      b.member_visible ? 1 : 0,
      b.cover_image || null,
      b.items_to_bring || null,
      b.precautions || null,
      now,
      now,
    ];
  } else {
    sql =
      'INSERT INTO contents (id,type,title,slug,summary,body,tags,cover_image,audio,publish_status,public_visible,member_visible,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
    values = [
      id,
      b.type,
      b.title,
      b.slug,
      b.summary || '',
      b.body,
      JSON.stringify(b.tags || []),
      b.cover_image || null,
      b.audio || null,
      b.publish_status || 'draft',
      b.public_visible ? 1 : 0,
      b.member_visible ? 1 : 0,
      b.publish_status === 'published' ? now : null,
      now,
      now,
    ];
  }
  const statements = [
    env.DB.prepare(sql).bind(...values),
    env.DB.prepare(
      'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(
      crypto.randomUUID(),
      actor.email,
      `${entity}.created`,
      entity,
      id,
      null,
      JSON.stringify(b),
      now,
    ),
  ];
  if (entity === 'contents') {
    statements.push(
      env.DB.prepare(
        'INSERT INTO content_placements (id,content_id,surface,position,featured,pinned,is_new) VALUES (?,?,?,?,?,?,?)',
      ).bind(crypto.randomUUID(), id, 'public_home', 999, 0, 0, 1),
      env.DB.prepare(
        'INSERT INTO content_placements (id,content_id,surface,position,featured,pinned,is_new) VALUES (?,?,?,?,?,?,?)',
      ).bind(crypto.randomUUID(), id, 'member_home', 999, 0, 0, 1),
    );
  }
  await env.DB.batch(statements);
  return Response.json({ id }, { status: 201 });
}

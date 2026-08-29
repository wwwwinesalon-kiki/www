import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { MEMBER_STATUSES, PAYMENT_STATUSES } from '@/lib/domain';
const config = {
  members: {
    table: 'members',
    fields: [
      'name',
      'line_name',
      'email',
      'status',
      'joined_at',
      'source',
      'last_contact_at',
      'interest_categories',
      'notes',
    ],
  },
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
  event_applications: {
    table: 'event_applications',
    fields: ['application_status', 'payment_status', 'cancelled_at', 'notes'],
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
    ],
  },
  event_payments: {
    table: 'event_payments',
    fields: ['status', 'paid_at', 'refunded_at'],
  },
  content_placements: {
    table: 'content_placements',
    fields: [
      'surface',
      'position',
      'featured',
      'pinned',
      'is_new',
      'archived_at',
    ],
  },
  notifications: { table: 'notifications', fields: ['read_at'] },
} as const;
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity, id } = await params;
  const c = config[entity as keyof typeof config];
  if (!c) return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const body = (await req.json()) as Record<string, unknown>;
  const fields = c.fields.filter((f) => f in body);
  if (!fields.length)
    return Response.json({ error: 'No valid fields' }, { status: 422 });
  if (
    entity === 'members' &&
    body.status &&
    !MEMBER_STATUSES.includes(body.status as never)
  )
    return Response.json({ error: 'Invalid status' }, { status: 422 });
  if (
    entity === 'event_payments' &&
    body.status &&
    !PAYMENT_STATUSES.includes(body.status as never)
  )
    return Response.json({ error: 'Invalid status' }, { status: 422 });
  const before = await env.DB.prepare(`SELECT * FROM ${c.table} WHERE id=?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!before) return Response.json({ error: 'Not found' }, { status: 404 });
  if (
    entity === 'event_applications' &&
    body.application_status === 'approved'
  ) {
    const eventId = String(before.event_id),
      event = await env.DB.prepare('SELECT capacity FROM events WHERE id=?')
        .bind(eventId)
        .first<{ capacity: number }>(),
      count = await env.DB.prepare(
        "SELECT COUNT(*) count FROM event_applications WHERE event_id=? AND id!=? AND application_status IN ('approved','attended') AND deleted_at IS NULL",
      )
        .bind(eventId, id)
        .first<{ count: number }>();
    if (event && (count?.count || 0) >= event.capacity)
      return Response.json(
        { error: '定員に達しています。Waitlistのままにしてください' },
        { status: 409 },
      );
  }
  const now = new Date().toISOString(),
    hasUpdatedAt = !['content_placements', 'notifications'].includes(entity);
  const set = [
      ...fields.map((f) => `${f}=?`),
      ...(hasUpdatedAt ? ['updated_at=?'] : []),
    ].join(','),
    values = fields.map((f) =>
      typeof body[f] === 'object' ? JSON.stringify(body[f]) : body[f],
    );
  const where = hasUpdatedAt ? 'id=? AND deleted_at IS NULL' : 'id=?',
    args = hasUpdatedAt ? [...values, now, id] : [...values, id],
    statements = [
      env.DB.prepare(`UPDATE ${c.table} SET ${set} WHERE ${where}`).bind(
        ...args,
      ),
      env.DB.prepare(
        'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
      ).bind(
        crypto.randomUUID(),
        actor.email,
        `${entity}.updated`,
        entity,
        id,
        JSON.stringify(before),
        JSON.stringify(body),
        now,
      ),
    ];
  if (entity === 'event_payments' && body.status)
    statements.push(
      env.DB.prepare(
        'UPDATE event_applications SET payment_status=?,updated_at=? WHERE id=(SELECT application_id FROM event_payments WHERE id=?)',
      ).bind(body.status, now, id),
    );
  await env.DB.batch(statements);
  return Response.json({ ok: true });
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { entity, id } = await params;
  const c = config[entity as keyof typeof config];
  if (!c) return Response.json({ error: 'Unknown entity' }, { status: 404 });
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE ${c.table} SET deleted_at=?,updated_at=? WHERE id=?`,
    ).bind(now, now, id),
    env.DB.prepare(
      'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(
      crypto.randomUUID(),
      actor.email,
      `${entity}.archived`,
      entity,
      id,
      null,
      JSON.stringify({ deleted_at: now }),
      now,
    ),
  ]);
  return Response.json({ ok: true });
}

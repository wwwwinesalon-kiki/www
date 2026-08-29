import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
import { sha256 } from '@/lib/auth';
export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { results } = await env.DB.prepare(
    'SELECT key,value FROM settings',
  ).all<{ key: string; value: string }>();
  return Response.json(
    Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value)])),
  );
}
export async function PATCH(req: Request) {
  const actor = await requireAdmin(req, true);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const b = (await req.json()) as Record<string, unknown>,
    now = new Date().toISOString();
  const allowed = [
    'site_name',
    'site_url',
    'contact',
    'session_lifetime_days',
    'categories',
    'tags',
    'event_types',
    'notification_settings',
  ];
  const statements = Object.entries(b)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) =>
      env.DB.prepare(
        'INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',
      ).bind(k, JSON.stringify(v), now),
    );
  if (typeof b.member_password === 'string') {
    if (b.member_password.length < 12)
      return Response.json(
        { error: 'パスワードは12文字以上です' },
        { status: 422 },
      );
    statements.push(
      env.DB.prepare(
        'INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',
      ).bind(
        'member_password_hash',
        JSON.stringify(await sha256(b.member_password)),
        now,
      ),
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO settings (key,value,updated_at) VALUES ('member_password_version','2',?) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT),updated_at=excluded.updated_at",
      ).bind(now),
    );
    statements.push(
      env.DB.prepare(
        'INSERT INTO notifications (id,type,title,body,created_at) VALUES (?,?,?,?,?)',
      ).bind(
        crypto.randomUUID(),
        'password_updated',
        'Member Passwordを更新しました',
        '旧セッションはすべて失効しました',
        now,
      ),
    );
  }
  if (!statements.length)
    return Response.json({ error: 'No settings' }, { status: 422 });
  statements.push(
    env.DB.prepare(
      'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(
      crypto.randomUUID(),
      actor.email,
      'settings.updated',
      'settings',
      'global',
      null,
      JSON.stringify(Object.keys(b)),
      now,
    ),
  );
  await env.DB.batch(statements);
  return Response.json({ ok: true });
}

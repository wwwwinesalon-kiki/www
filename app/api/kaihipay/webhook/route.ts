import { env } from 'cloudflare:workers';
import {
  HttpKaihipayAdapter,
  MockKaihipayAdapter,
  type KaihipayEvent,
} from '@/lib/integrations';

type MemberRow = { id: string; name: string; status: string };

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-kaihipay-signature') || '';
  const adapter =
    process.env.KAIHIPAY_TOKEN && process.env.KAIHIPAY_WEBHOOK_SECRET
      ? new HttpKaihipayAdapter(
          process.env.KAIHIPAY_TOKEN,
          process.env.KAIHIPAY_WEBHOOK_SECRET,
        )
      : new MockKaihipayAdapter();
  if (!(await adapter.verifyWebhook(body, signature)))
    return Response.json({ error: 'invalid signature' }, { status: 401 });

  let event: KaihipayEvent;
  try {
    event = JSON.parse(body) as KaihipayEvent;
  } catch {
    return Response.json({ error: 'invalid payload' }, { status: 400 });
  }
  if (!event.customerId || !event.occurredAt)
    return Response.json({ error: 'missing event fields' }, { status: 400 });

  const eventKey = `${event.customerId}:${event.occurredAt}`;
  const duplicate = await env.DB.prepare(
    "SELECT id FROM audit_logs WHERE entity_type='kaihipay_event' AND entity_id=? LIMIT 1",
  )
    .bind(eventKey)
    .first();
  if (duplicate) return Response.json({ ok: true, duplicate: true });

  const verified = await adapter.fetchSubscription(event.customerId);
  const mapped =
    verified.subscriptionStatus === 'active'
      ? 'active'
      : verified.subscriptionStatus === 'paused'
        ? 'pause'
        : 'churned';
  const member = await env.DB.prepare(
    'SELECT id,name,status FROM members WHERE kaihipay_customer_id=? LIMIT 1',
  )
    .bind(event.customerId)
    .first<MemberRow>();
  const now = new Date().toISOString();
  if (!member) {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO notifications (id,type,title,body,created_at) VALUES (?,?,?,?,?)',
      ).bind(
        crypto.randomUUID(),
        'warning',
        '会費ペイ照合エラー',
        `顧客ID ${event.customerId} に一致する会員が見つかりません。`,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
      ).bind(
        crypto.randomUUID(),
        'kaihipay',
        'member.subscription_unmatched',
        'kaihipay_event',
        eventKey,
        null,
        JSON.stringify({ customerId: event.customerId, status: mapped }),
        now,
      ),
    ]);
    return Response.json({ ok: true, matched: false });
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE members SET status=?,updated_at=? WHERE id=?').bind(
      mapped,
      now,
      member.id,
    ),
    env.DB.prepare(
      'INSERT INTO notifications (id,type,title,body,created_at) VALUES (?,?,?,?,?)',
    ).bind(
      crypto.randomUUID(),
      'payment',
      '会費ペイの状態を同期しました',
      `${member.name}：${member.status} → ${mapped}`,
      now,
    ),
    env.DB.prepare(
      'INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before,after,created_at) VALUES (?,?,?,?,?,?,?,?)',
    ).bind(
      crypto.randomUUID(),
      'kaihipay',
      'member.subscription_synced',
      'kaihipay_event',
      eventKey,
      JSON.stringify({ status: member.status }),
      JSON.stringify({ memberId: member.id, status: mapped }),
      now,
    ),
  ]);
  return Response.json({ ok: true, matched: true, status: mapped });
}

import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { createMemberSession, sha256 } from '@/lib/auth';
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(req: Request) {
  const ip = req.headers.get('cf-connecting-ip') || 'local',
    now = Date.now(),
    entry = attempts.get(ip);
  if (entry && entry.reset > now && entry.count >= 5)
    return NextResponse.json(
      { error: 'Too many attempts' },
      { status: 429, headers: { 'retry-after': '900' } },
    );
  let password = '';
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const { results } = await env.DB.prepare(
    "SELECT key,value FROM settings WHERE key IN ('member_password_hash','member_password_version','session_lifetime_days')",
  ).all<{ key: string; value: string }>();
  const settings = Object.fromEntries(
    results.map((r) => [r.key, JSON.parse(r.value)]),
  );
  const expected = String(
    settings.member_password_hash ||
      process.env.MEMBER_PASSWORD_HASH ||
      (await sha256('www-preview-2026')),
  );
  if ((await sha256(password)) !== expected) {
    attempts.set(ip, {
      count: (entry?.reset && entry.reset > now ? entry.count : 0) + 1,
      reset: now + 900000,
    });
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  attempts.delete(ip);
  const secret =
      process.env.MEMBER_SESSION_SECRET ||
      'local-preview-secret-change-in-production',
    version = String(
      settings.member_password_version ||
        process.env.MEMBER_SESSION_VERSION ||
        '1',
    ),
    days = Number(
      settings.session_lifetime_days || process.env.MEMBER_SESSION_DAYS || 30,
    ),
    token = await createMemberSession(secret, version, days);
  await env.DB.prepare(
    'INSERT INTO analytics_events (id,event_type,session_id,path,occurred_at) VALUES (?,?,?,?,?)',
  )
    .bind(
      crypto.randomUUID(),
      'member_login',
      crypto.randomUUID(),
      '/member/login',
      new Date().toISOString(),
    )
    .run();
  const res = NextResponse.json({ ok: true });
  res.cookies.set('www_member', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/member',
    maxAge: days * 86400,
  });
  return res;
}

import { requireAdmin } from '@/lib/admin-auth';
import { readKaihipayCourses } from '@/lib/kaihipay-read';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

// Explicit owner action only. No charge, invitation or entitlement mutation.
export async function POST(req: Request) {
  const actor = await requireAdmin(req, true);
  if (!actor || actor.role !== 'owner')
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  try {
    if (new URL(req.headers.get('origin') || '').origin !==
        new URL(req.url).origin)
      return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }
  if (!process.env.KAIHIPAY_API_TOKEN?.trim())
    return Response.json({ error: 'APIトークンが未設定です' }, { status: 503, headers });
  try {
    const result = await readKaihipayCourses(process.env.KAIHIPAY_API_TOKEN);
    return Response.json({ ...result, automaticActivation: false }, { headers });
  } catch {
    return Response.json({ error: '接続を確認できません API権限・有効期限を確認してください' },
      { status: 502, headers });
  }
}

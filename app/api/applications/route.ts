import { memberAccess } from '@/lib/member-access';
import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { neonSessionUser } from '@/lib/neon/auth';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { eventId?: unknown } | null;
  if (typeof body?.eventId !== 'string' || !body.eventId)
    return Response.json(
      { error: 'イベントを確認してください' },
      { status: 422 },
    );
  const access = await memberAccess();
  if (!access.user || !access.entitled)
    return Response.json({ error: '会員ログインと有効な会費のお支払いが必要です' }, { status: 403 });
  if (isNeonBackend()) {
    const user = await neonSessionUser();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const rows = await neonSql()`select * from public.www_apply_to_member_event(
        ${user.id}, ${body.eventId}::uuid
      )` as unknown as Array<{ application_id: string; application_status: string }>;
      const result = rows[0];
      if (!result) return Response.json({ error: '受付状況を確認してください' }, { status: 409 });
      return Response.json({ id: result.application_id, status: result.application_status }, { status: 201 });
    } catch {
      return Response.json({ error: '受付状況を確認してください' }, { status: 409 });
    }
  }
  // The existing SQL function requires name/email text. Fixed non-personal values
  // preserve its seat-locking and duplicate-check behavior without storing PII.
  const { data, error } = await access.supabase.rpc('apply_to_member_event', {
    p_event_id: body.eventId,
    p_name: 'WWW会員',
    p_email: 'not-collected@example.invalid',
    p_line_name: '',
    p_note: '',
  });
  if (error || !data?.[0])
    return Response.json({ error: '受付状況を確認してください' }, { status: 409 });
  return Response.json({ id:data[0].application_id, status:data[0].application_status }, { status: 201 });
}

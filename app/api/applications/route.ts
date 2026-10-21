import { memberAccess } from '@/lib/member-access';

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

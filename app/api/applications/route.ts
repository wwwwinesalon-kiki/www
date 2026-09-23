import { memberAccess } from '@/lib/member-access';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<
    string,
    string
  > | null;
  if (
    !body?.eventId ||
    !body.name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || '')
  )
    return Response.json(
      { error: '入力内容を確認してください' },
      { status: 422 },
    );
  const access = await memberAccess();
  if (!access.user || !access.entitled)
    return Response.json({ error: '会員ログインと有効な会費のお支払いが必要です' }, { status: 403 });
  const { data, error } = await access.supabase.rpc('apply_to_member_event', {
    p_event_id:body.eventId,p_name:body.name,p_email:body.email,
    p_line_name:body.lineName || '',p_note:body.note || '',
  });
  if (error || !data?.[0])
    return Response.json({ error: '受付状況を確認してください' }, { status: 409 });
  return Response.json({ id:data[0].application_id, status:data[0].application_status }, { status: 201 });
}

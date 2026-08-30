import { createClient } from '@/lib/supabase/server';
import { nextApplicationStatus } from '@/lib/domain';

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
  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('capacity,waitlist_enabled,registration_enabled')
    .eq('id', body.eventId)
    .eq('publish_status', 'published')
    .single();
  if (!event?.registration_enabled)
    return Response.json({ error: '受付を終了しています' }, { status: 409 });
  const { count } = await supabase
    .from('event_applications')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', body.eventId)
    .neq('application_status', 'cancelled');
  const status = nextApplicationStatus(
    event.capacity,
    count || 0,
    event.waitlist_enabled,
  );
  if (status === 'closed')
    return Response.json({ error: '満席です' }, { status: 409 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('event_applications')
    .insert({
      event_id: body.eventId,
      user_id: user?.id || null,
      name: body.name,
      email: body.email,
      line_name: body.lineName || null,
      note: body.note || null,
      application_status: status,
    })
    .select('id')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json({ id: data.id, status }, { status: 201 });
}

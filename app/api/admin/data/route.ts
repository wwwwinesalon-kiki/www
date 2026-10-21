import { requireAdmin } from '@/lib/admin-auth';
import { storageService } from '@/lib/supabase/service';

export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const [events, applications, contents] = await Promise.all([
    actor.supabase
      .from('events')
      .select('*,event_applications(count)')
      .order('start_at')
      .limit(300),
    actor.supabase
      .from('event_applications')
      .select('id,event_id,user_id,application_status,created_at,events(title)')
      .order('created_at', { ascending: false })
      .limit(500),
    actor.supabase
      .from('contents')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500),
  ]);
  const error = events.error || applications.error || contents.error;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const userIds = [...new Set((applications.data || [])
    .map((application) => application.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const bindings = userIds.length
    ? await storageService().from('article_entitlements')
      .select('user_id,provider_member_id').in('user_id', userIds)
    : { data: [], error: null };
  if (bindings.error) return Response.json({ error: '会員番号の照合に失敗しました' }, { status: 500 });
  const memberNumberByUserId = new Map(
    (bindings.data || []).map((binding) => [binding.user_id, binding.provider_member_id]),
  );
  return Response.json({
    members: [],
    events: (events.data || []).map((e) => ({
      ...e,
      date: e.start_at?.slice(0, 10),
      status: e.publish_status,
      applications: e.event_applications?.[0]?.count || 0,
    })),
    applications: (applications.data || []).map((a) => ({
      id: a.id,
      event_id: a.event_id,
      member_number: a.user_id ? memberNumberByUserId.get(a.user_id) || null : null,
      application_status: a.application_status,
      event_title: Array.isArray(a.events)
        ? a.events[0]?.title
        : (a.events as { title?: string } | null)?.title,
      applied_at: a.created_at,
      created_at: a.created_at,
    })),
    payments: [],
    contents: (contents.data || []).map((c) => ({
      ...c,
      publicVisible: c.public_visible,
      memberVisible: c.member_visible,
      status: c.publish_status,
    })),
    placements: [],
    notifications: [],
    logs: [],
    analytics: [],
    settings: {},
    adminUsers: [],
  });
}

import { requireAdmin } from '@/lib/admin-auth';
import { storageService } from '@/lib/supabase/service';
import { isNeonBackend, neonSql } from '@/lib/neon/db';

export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  if (isNeonBackend()) {
    const sql = neonSql();
    const result = await Promise.all([
      sql`select e.*,
        (select count(*)::integer from public.event_applications a
          where a.event_id=e.id and a.deleted_at is null
            and a.application_status <> 'cancelled') as applications
        from public.events e order by e.start_at limit 300`,
      sql`select a.id,a.event_id,a.application_status,a.created_at,
          e.title as event_title,t.provider_member_id as member_number
        from public.event_applications a
        join public.events e on e.id=a.event_id
        left join public.article_entitlements t on t.user_id=a.user_id
        order by a.created_at desc limit 500`,
      sql`select * from public.contents order by updated_at desc limit 500`,
    ]);
    const [events, applications, contents] = result as unknown as Record<string, unknown>[][];
    return Response.json({
      members: [],
      events: events.map((e) => ({
        ...e,
        date: e.start_at instanceof Date || typeof e.start_at === 'string'
          ? new Date(e.start_at).toISOString().slice(0, 10)
          : null,
        status: e.publish_status,
      })),
      applications: applications.map((a) => ({
        ...a, applied_at: a.created_at,
      })),
      payments: [],
      contents: contents.map((c) => ({
        ...c,
        publicVisible: c.public_visible,
        memberVisible: c.member_visible,
        status: c.publish_status,
      })),
      placements: [], notifications: [], logs: [], analytics: [], settings: {}, adminUsers: [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
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

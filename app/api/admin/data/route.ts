import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const [profiles, events, applications, contents] = await Promise.all([
    actor.supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    actor.supabase
      .from('events')
      .select('*,event_applications(count)')
      .order('start_at')
      .limit(300),
    actor.supabase
      .from('event_applications')
      .select('*,events(title)')
      .order('created_at', { ascending: false })
      .limit(500),
    actor.supabase
      .from('contents')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500),
  ]);
  const error =
    profiles.error || events.error || applications.error || contents.error;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    members: (profiles.data || []).map((p) => ({
      ...p,
      line: '',
      joined: p.created_at,
      source: 'Supabase Auth',
    })),
    events: (events.data || []).map((e) => ({
      ...e,
      date: e.start_at?.slice(0, 10),
      status: e.publish_status,
      applications: e.event_applications?.[0]?.count || 0,
    })),
    applications: (applications.data || []).map((a) => ({
      ...a,
      event_title: a.events?.title,
      applied_at: a.created_at,
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
    adminUsers: (profiles.data || [])
      .filter((p) => p.role !== 'member')
      .map((p) => ({ role: p.role, access_email: p.email })),
  });
}

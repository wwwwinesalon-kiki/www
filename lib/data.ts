import { createClient } from '@/lib/supabase/server';
import { memberAccess } from '@/lib/member-access';
import { isNeonBackend, neonSql } from '@/lib/neon/db';

export type EventView = {
  id: string;
  title: string;
  slug: string;
  event_type: string;
  description: string | null;
  start_at: string;
  end_at: string;
  venue: string;
  capacity: number;
  price: number;
  member_only: number;
  registration_enabled: number;
  waitlist_enabled: number;
  public_visible: number;
  member_visible: number;
  publish_status: string;
  cover_image: string | null;
  items_to_bring: string | null;
  precautions: string | null;
  applications: number;
};
export type ContentView = {
  id: string;
  type: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  body_format?: string;
  cover_alt?: string;
  tags: string | null;
  cover_image: string | null;
  public_visible: number;
  member_visible: number;
  publish_status: string;
  published_at: string | null;
  position: number | null;
  featured: number | null;
  pinned: number | null;
  is_new: number | null;
};

function dateIso(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw new Error('Invalid database timestamp');
  }
  return new Date(value).toISOString();
}

export async function publicEvents(member = false) {
  if (isNeonBackend()) {
    const rows = (await neonSql()`
      select e.*,
        (select count(*)::integer from public.event_applications a
          where a.event_id = e.id and a.deleted_at is null
            and a.application_status <> 'cancelled') as applications
      from public.events e
      where e.deleted_at is null and e.archived_at is null
        and e.publish_status = 'published'
        and ((${member} and e.member_visible) or (not ${member} and e.public_visible))
      order by e.start_at
    `) as unknown as Record<string, unknown>[];
    return rows.map((event) => ({
      ...event,
      start_at: dateIso(event.start_at),
      end_at: dateIso(event.end_at),
      member_only: Number(event.member_only),
      registration_enabled: Number(event.registration_enabled),
      waitlist_enabled: Number(event.waitlist_enabled),
      public_visible: Number(event.public_visible),
      member_visible: Number(event.member_visible),
    })) as EventView[];
  }
  const supabase = await createClient();
  const visibility = member ? 'member_visible' : 'public_visible';
  const { data, error } = await supabase
    .from('events')
    .select('*,event_applications(count)')
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('publish_status', 'published')
    .eq(visibility, true)
    .order('start_at');
  if (error) return [];
  return (data || []).map((event) => ({
    ...event,
    applications: event.event_applications?.[0]?.count || 0,
    member_only: Number(event.member_only),
    registration_enabled: Number(event.registration_enabled),
    waitlist_enabled: Number(event.waitlist_enabled),
    public_visible: Number(event.public_visible),
    member_visible: Number(event.member_visible),
  })) as EventView[];
}
export async function upcomingMemberEvents(limit = 2) {
  const events = await publicEvents(true);
  const now = Date.now();
  return events
    .filter((event) => new Date(event.end_at).getTime() >= now)
    .slice(0, limit);
}
export async function eventBySlug(slug: string, member = false) {
  const events = await publicEvents(member);
  return events.find((event) => event.slug === slug) || null;
}
export async function visibleContents(member = false, type?: string) {
  if (member) {
    const access = await memberAccess();
    if (!access.user || !access.entitled) return [];
  }
  if (isNeonBackend()) {
    const rows = (await neonSql()`
      select id,type,title,slug,summary,body,body_format,cover_alt,tags,
        cover_image,public_visible,member_visible,publish_status,published_at,is_new
      from public.contents
      where deleted_at is null and archived_at is null
        and publish_status = 'published'
        and ((${member} and member_visible) or (not ${member} and public_visible))
        and (${type ?? null}::text is null or type = ${type ?? null}::text)
      order by published_at desc nulls last
    `) as unknown as Record<string, unknown>[];
    return rows.map((content) => ({
      ...content,
      published_at: content.published_at ? dateIso(content.published_at) : null,
      public_visible: Number(content.public_visible),
      member_visible: Number(content.member_visible),
      position: null,
      featured: null,
      pinned: null,
      is_new: Number(content.is_new),
    })) as ContentView[];
  }
  const supabase = await createClient();
  const visibility = member ? 'member_visible' : 'public_visible';
  let query = supabase
    .from('contents')
    .select(
      'id,type,title,slug,summary,body,body_format,cover_alt,tags,cover_image,public_visible,member_visible,publish_status,published_at,is_new',
    )
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('publish_status', 'published')
    .eq(visibility, true)
    .order('published_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error)
    throw new Error(
      '記事を取得できませんでした 時間をおいて再試行してください',
    );
  return (data || []).map((content) => ({
    ...content,
    public_visible: Number(content.public_visible),
    member_visible: Number(content.member_visible),
    position: null,
    featured: null,
    pinned: null,
    is_new: Number(content.is_new),
  })) as ContentView[];
}
export async function contentBySlug(slug: string, member = true) {
  const contents = await visibleContents(member);
  return contents.find((content) => content.slug === slug) || null;
}

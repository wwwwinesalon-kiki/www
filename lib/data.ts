import { env } from 'cloudflare:workers';

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
  tags: string | null;
  cover_image: string | null;
  audio: string | null;
  public_visible: number;
  member_visible: number;
  publish_status: string;
  published_at: string | null;
  position: number | null;
  featured: number | null;
  pinned: number | null;
  is_new: number | null;
};

export async function publicEvents(member = false) {
  const visibility = member ? 'member_visible' : 'public_visible';
  const { results } = await env.DB.prepare(
    `SELECT e.*,(SELECT COUNT(*) FROM event_applications a WHERE a.event_id=e.id AND a.deleted_at IS NULL AND a.application_status NOT IN ('cancelled','no_show')) applications FROM events e WHERE e.deleted_at IS NULL AND e.archived_at IS NULL AND e.publish_status='published' AND e.${visibility}=1 ORDER BY e.start_at`,
  ).all<EventView>();
  return results;
}
export async function eventBySlug(slug: string, member = false) {
  const visibility = member ? 'member_visible' : 'public_visible';
  return env.DB.prepare(
    `SELECT e.*,(SELECT COUNT(*) FROM event_applications a WHERE a.event_id=e.id AND a.deleted_at IS NULL AND a.application_status NOT IN ('cancelled','no_show')) applications FROM events e WHERE e.slug=? AND e.deleted_at IS NULL AND e.archived_at IS NULL AND e.publish_status='published' AND e.${visibility}=1`,
  )
    .bind(slug)
    .first<EventView>();
}
export async function visibleContents(member = false, type?: string) {
  const visibility = member ? 'member_visible' : 'public_visible',
    surface = member ? 'member_home' : 'public_home';
  const where = type ? ' AND c.type=?' : '';
  const sql = `SELECT c.*,p.position,p.featured,p.pinned,p.is_new FROM contents c LEFT JOIN content_placements p ON p.content_id=c.id AND p.surface=? AND p.archived_at IS NULL WHERE c.deleted_at IS NULL AND c.archived_at IS NULL AND c.publish_status='published' AND c.${visibility}=1${where} ORDER BY COALESCE(p.pinned,0) DESC,COALESCE(p.position,999999),c.published_at DESC`;
  const q = env.DB.prepare(sql);
  const { results } = type
    ? await q.bind(surface, type).all<ContentView>()
    : await q.bind(surface).all<ContentView>();
  return results;
}
export async function contentBySlug(slug: string, member = true) {
  const visibility = member ? 'member_visible' : 'public_visible';
  return env.DB.prepare(
    `SELECT c.*,NULL position,NULL featured,NULL pinned,NULL is_new FROM contents c WHERE c.slug=? AND c.deleted_at IS NULL AND c.archived_at IS NULL AND c.publish_status='published' AND c.${visibility}=1`,
  )
    .bind(slug)
    .first<ContentView>();
}

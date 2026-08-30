import { createClient } from '@/lib/supabase/server';

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
export async function eventBySlug(slug: string, member = false) {
  const events = await publicEvents(member);
  return events.find((event) => event.slug === slug) || null;
}
export async function visibleContents(member = false, type?: string) {
  const supabase = await createClient();
  const visibility = member ? 'member_visible' : 'public_visible';
  let query = supabase
    .from('contents')
    .select('*')
    .is('deleted_at', null)
    .is('archived_at', null)
    .eq('publish_status', 'published')
    .eq(visibility, true)
    .order('published_at', { ascending: false });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) return [];
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

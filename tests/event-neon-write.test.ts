import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), identity: vi.fn() }));
vi.mock('@/lib/neon/db', () => ({
  isNeonBackend: () => true,
  neonSql: () => Object.assign(mocks.query, { query: mocks.query }),
}));
vi.mock('@/lib/neon/identity', () => ({ linkedNeonIdentity: mocks.identity }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
import { GET as listEvents, POST } from '../app/api/admin/entity/[entity]/route';
import { DELETE, PATCH } from '../app/api/admin/entity/[entity]/[id]/route';
import { GET as dashboardData } from '../app/api/admin/data/route';
import { eventDateIso } from '../lib/event-write';

const db = new PGlite();
const origin = 'https://www.test';
const ownerId = '11111111-1111-4111-8111-111111111111';
const params = { params: Promise.resolve({ entity: 'events' }) };
const itemParams = (id: string) => ({ params: Promise.resolve({ entity: 'events', id }) });
const request = (value: object, method = 'POST') => new Request(`${origin}/api/admin/entity/events`, {
  method, headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(value),
});
const draft = {
  title: '余市ワインの会', slug: 'yoichi-wine', venue: 'KiKi', capacity: 6, price: 3410,
  start_at: '2026-11-04T00:30', end_at: '2026-11-04T02:00',
  publish_status: 'draft', public_visible: false, member_visible: true,
  member_only: true, registration_enabled: true, waitlist_enabled: false,
};

beforeAll(async () => {
  await db.exec(await readFile(new URL('../migrations/neon/0001_www_schema.sql', import.meta.url), 'utf8'));
  mocks.query.mockImplementation(async (query: string | TemplateStringsArray, valuesOrFirst?: unknown, ...rest: unknown[]) => {
    const tagged = Array.isArray(query);
    const text = tagged ? query.map((part, index) => part + (index < query.length - 1 ? `$${index + 1}` : '')).join('') : query;
    const values = tagged ? [valuesOrFirst, ...rest].slice(0, query.length - 1) : valuesOrFirst;
    return (await db.query(text as string, values as unknown[])).rows;
  });
}, 30000);
beforeEach(async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin);
  mocks.identity.mockResolvedValue({ email: 'owner@example.test', role: 'owner', profileId: ownerId });
  await db.exec('truncate public.events cascade');
});
afterAll(async () => { vi.unstubAllEnvs(); await db.close(); });

it('creates a draft, publishes an edited event, then removes it from lists without losing reservation history', async () => {
  const created = await POST(request(draft), params);
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const stored = await db.query<{ start_at: Date; publish_status: string }>('select start_at,publish_status from public.events where id=$1', [id]);
  expect(new Date(stored.rows[0].start_at).toISOString()).toBe('2026-11-03T15:30:00.000Z');
  expect(stored.rows[0].publish_status).toBe('draft');
  const dashboard = await dashboardData(new Request(`${origin}/api/admin/data`));
  expect((await dashboard.json()).events[0]).toMatchObject({ id, date: '2026-11-04', status: 'draft' });

  const published = await PATCH(request({ title: '更新したワインの会', publish_status: 'published' }, 'PATCH'), itemParams(id));
  expect(published.status).toBe(200);
  const list = await listEvents(new Request(`${origin}/api/admin/entity/events`), params);
  expect((await list.json())[0]).toMatchObject({ id, title: '更新したワインの会', publish_status: 'published' });
  await db.query("insert into public.event_applications(event_id,name,email,application_status) values($1,'Test member','test@example.test','pending')", [id]);

  const removed = await DELETE(new Request(`${origin}/api/admin/entity/events/${id}`, { method: 'DELETE', headers: { Origin: origin } }), itemParams(id));
  expect(removed.status).toBe(200);
  const after = await db.query<{ deleted_at: Date | null; publish_status: string; public_visible: boolean; member_visible: boolean; registration_enabled: boolean }>(
    'select deleted_at,publish_status,public_visible,member_visible,registration_enabled from public.events where id=$1', [id],
  );
  expect(after.rows[0]).toMatchObject({ publish_status: 'draft', public_visible: false, member_visible: false, registration_enabled: false });
  expect(after.rows[0].deleted_at).not.toBeNull();
  expect(await (await listEvents(new Request(`${origin}/api/admin/entity/events`), params)).json()).toEqual([]);
  const afterDashboard = await (await dashboardData(new Request(`${origin}/api/admin/data`))).json();
  expect(afterDashboard.events).toEqual([]);
  expect(afterDashboard.applications).toHaveLength(1);
  const hiddenPatch = await PATCH(request({ publish_status: 'published' }, 'PATCH'), itemParams(id));
  expect(hiddenPatch.status).toBe(404);
});

it('validates partial edits against the saved event and leaves invalid edits unchanged', async () => {
  const { id } = await (await POST(request(draft), params)).json();
  for (const change of [
    { start_at: 'invalid-date' },
    { end_at: '2026-11-04T00:15' },
    { price: -1 },
    { capacity: 0 },
    { publish_status: 'archived' },
    { registration_enabled: 'false' },
  ]) {
    const response = await PATCH(request(change, 'PATCH'), itemParams(id));
    expect(response.status).toBe(422);
    expect(Object.keys((await response.json()).errors).length).toBeGreaterThan(0);
  }
  const { rows } = await db.query('select price,capacity,publish_status,registration_enabled from public.events where id=$1', [id]);
  expect(rows[0]).toEqual({ price: 3410, capacity: 6, publish_status: 'draft', registration_enabled: true });
});

it('allows a viewer to read but rejects event writes', async () => {
  const { id } = await (await POST(request(draft), params)).json();
  mocks.identity.mockResolvedValue({ email: 'viewer@example.test', role: 'viewer', profileId: ownerId });
  expect((await listEvents(new Request(`${origin}/api/admin/entity/events`), params)).status).toBe(200);
  expect((await POST(request({ ...draft, slug: 'another-event' }), params)).status).toBe(403);
  expect((await PATCH(request({ publish_status: 'published' }, 'PATCH'), itemParams(id))).status).toBe(403);
  expect((await DELETE(new Request(`${origin}/api/admin/entity/events/${id}`, { method: 'DELETE', headers: { Origin: origin } }), itemParams(id))).status).toBe(403);
});

it('normalizes Japan-local editor dates and preserves explicit time zones', () => {
  expect(eventDateIso('2026-11-04T19:00')).toBe('2026-11-04T10:00:00.000Z');
  expect(eventDateIso('2026-11-04T19:00:00+09:00')).toBe('2026-11-04T10:00:00.000Z');
  expect(eventDateIso('2026-11-04T10:00:00Z')).toBe('2026-11-04T10:00:00.000Z');
  expect(eventDateIso('not-a-date')).toBe('');
});

import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('@/lib/member-access', () => ({ memberAccess: mocks.access }));
vi.mock('@/lib/neon/db', () => ({ isNeonBackend: () => false, neonSql: vi.fn() }));
vi.mock('@/lib/neon/auth', () => ({ neonSessionUser: vi.fn() }));
import { POST } from '../app/api/applications/route';

afterEach(() => vi.resetAllMocks());

function request(body: unknown) {
  return new Request('https://example.test/api/applications', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

it('books with a paid account but never forwards submitted contact information', async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: [{ application_id: 'booking-id', application_status: 'pending' }],
    error: null,
  });
  mocks.access.mockResolvedValue({ user: { id: 'auth-user-id' }, entitled: true,
    supabase: { rpc } });
  const response = await POST(request({
    eventId: 'event-id', name: 'Private Name', email: 'private@example.test',
    lineName: 'Private LINE', note: 'Private note',
  }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: 'booking-id', status: 'pending' });
  expect(rpc).toHaveBeenCalledWith('apply_to_member_event', {
    p_event_id: 'event-id', p_name: 'WWW会員',
    p_email: 'not-collected@example.invalid', p_line_name: '', p_note: '',
  });
});

it('rejects booking without paid membership before touching the database', async () => {
  const rpc = vi.fn();
  mocks.access.mockResolvedValue({ user: { id: 'auth-user-id' }, entitled: false,
    supabase: { rpc } });
  expect((await POST(request({ eventId: 'event-id' }))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});

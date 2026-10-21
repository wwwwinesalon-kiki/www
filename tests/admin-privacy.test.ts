import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), service: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/supabase/service', () => ({ storageService: mocks.service }));
vi.mock('@/lib/domain', () => ({ validateEvent: vi.fn() }));
vi.mock('@/lib/article-write', () => ({ saveArticle: vi.fn() }));
import { GET as getData } from '../app/api/admin/data/route';
import { GET as getMembersCsv } from '../app/api/admin/members.csv/route';
import { GET as getEntity } from '../app/api/admin/entity/[entity]/route';

afterEach(() => vi.resetAllMocks());

it('does not expose customer records or application contact/payment fields', async () => {
  const selected = new Map<string, string>();
  const from = vi.fn((table: string) => ({
    select: (columns: string) => {
      selected.set(table, columns);
      return {
        order: () => ({
          limit: async () => ({
            data: table === 'event_applications'
              ? [{
                  id: 'application-id', event_id: 'event-id', user_id: 'auth-user-id', application_status: 'pending',
                  created_at: '2026-10-22T00:00:00Z', events: [{ title: 'NOMIKAI' }],
                  name: 'secret-name', email: 'secret@example.test',
                  payment_status: 'paid', note: 'secret-note',
                }]
              : [],
            error: null,
          }),
        }),
      };
    },
  }));
  mocks.admin.mockResolvedValue({ supabase: { from } });
  mocks.service.mockReturnValue({ from: () => ({ select: () => ({
    in: async () => ({ data: [{ user_id: 'auth-user-id', provider_member_id: 'kaihipay-123' }], error: null }),
  }) }) });
  const response = await getData(new Request('https://example.test/api/admin/data'));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.members).toEqual([]);
  expect(result.adminUsers).toEqual([]);
  expect(result.applications).toEqual([{
    id: 'application-id', event_id: 'event-id', application_status: 'pending',
    member_number: 'kaihipay-123',
    created_at: '2026-10-22T00:00:00Z', applied_at: '2026-10-22T00:00:00Z',
    event_title: 'NOMIKAI',
  }]);
  expect(selected.get('event_applications')).not.toContain('*');
  expect(from).not.toHaveBeenCalledWith('profiles');
});

it('disables the former customer CSV endpoint', async () => {
  mocks.admin.mockResolvedValue({ supabase: { from: vi.fn() } });
  const response = await getMembersCsv(new Request('https://example.test/api/admin/members.csv'));
  expect(response.status).toBe(410);
  expect(response.headers.get('content-type')).toContain('application/json');
});

it('disables the legacy member directory endpoint', async () => {
  const from = vi.fn();
  mocks.admin.mockResolvedValue({ supabase: { from } });
  const response = await getEntity(
    new Request('https://example.test/api/admin/entity/members'),
    { params: Promise.resolve({ entity: 'members' }) },
  );
  expect(response.status).toBe(410);
  expect(from).not.toHaveBeenCalled();
});

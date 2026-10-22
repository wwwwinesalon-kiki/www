import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), service: vi.fn() }));
vi.mock('@/lib/admin-auth', () => ({ requireAdmin: mocks.admin }));
vi.mock('@/lib/supabase/service', () => ({ storageService: mocks.service }));

import { GET } from '../app/api/admin/kaihipay/issues/route';

afterEach(() => vi.resetAllMocks());

function request() {
  return new Request('https://www.example.test/api/admin/kaihipay/issues');
}

function query(result: { data: Record<string, unknown>[] | null; error: Error | null }) {
  const chain = {
    in: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => result),
  };
  chain.in.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
}

function database(
  invitationResult: { data: Record<string, unknown>[] | null; error: Error | null },
  syncResult: { data: Record<string, unknown>[] | null; error: Error | null },
) {
  const invitations = query(invitationResult);
  const sync = query(syncResult);
  const invitationSelect = vi.fn(() => invitations);
  const syncSelect = vi.fn(() => sync);
  const from = vi.fn((table: string) => {
    if (table === 'kaihipay_invitation_jobs') return { select: invitationSelect };
    if (table === 'kaihipay_sync_events') return { select: syncSelect };
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.service.mockReturnValue({ from });
  return { from, invitations, sync, invitationSelect, syncSelect };
}

it.each([null, { role: 'viewer' }, { role: 'editor' }])(
  'rejects non-owner %j before opening the service database',
  async (actor) => {
    mocks.admin.mockResolvedValue(actor);
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.service).not.toHaveBeenCalled();
  },
);

it('returns only minimal review identifiers with bounded filtered reads', async () => {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  const db = database(
    {
      data: [{
        provider_member_id: 'kaihipay-123', status: 'review',
        email: 'secret@example.test', created_at: '2026-10-22T00:00:00Z',
      }],
      error: null,
    },
    {
      data: [{
        provider_member_id: 'kaihipay-456', error_code: 'private-error',
        received_at: '2026-10-22T00:00:00Z',
      }],
      error: null,
    },
  );

  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    invitations: [{ memberId: 'kaihipay-123', status: 'review' }],
    sync: [{ memberId: 'kaihipay-456' }],
  });
  expect(db.from).toHaveBeenCalledTimes(2);
  expect(db.invitationSelect).toHaveBeenCalledWith('provider_member_id,status');
  expect(db.syncSelect).toHaveBeenCalledWith('provider_member_id');
  expect(db.invitations.in).toHaveBeenCalledWith('status', ['review', 'sending']);
  expect(db.sync.not).toHaveBeenCalledWith('error_code', 'is', null);
  expect(db.sync.is).toHaveBeenCalledWith('processed_at', null);
  expect(db.invitations.limit).toHaveBeenCalledWith(50);
  expect(db.sync.limit).toHaveBeenCalledWith(50);
});

it.each(['invitation', 'sync'])('returns a generic 503 when the %s read fails', async (which) => {
  mocks.admin.mockResolvedValue({ role: 'owner' });
  const failure = { data: null, error: new Error('secret backend detail') };
  const empty = { data: [], error: null };
  database(which === 'invitation' ? failure : empty, which === 'sync' ? failure : empty);

  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const body = await response.text();
  expect(body).not.toContain('secret backend detail');
  expect(body).not.toContain('kaihipay-');
});

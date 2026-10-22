import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  sql: vi.fn(),
  authoritative: vi.fn(),
  discover: vi.fn(),
  record: vi.fn(),
  backend: vi.fn(() => true),
}));

vi.mock('@/lib/neon/db', () => ({
  isNeonBackend: mocks.backend,
  neonSql: () => mocks.sql,
}));
vi.mock('@/lib/neon/auth', () => ({ neonSessionUser: mocks.user }));
vi.mock('@/lib/neon/kaihipay', () => ({
  authoritativeSnapshot: mocks.authoritative,
  discoverPaidClaimByEmail: mocks.discover,
  recordAuthoritativeSnapshot: mocks.record,
  emailClaimHmac: () => 'a'.repeat(64),
  sameEmailHmac: (a: string, b: string) => a === b,
}));

import { POST } from '../app/api/member/claim/route';

const url = 'https://member.example.test/api/member/claim';
function request(origin = 'https://member.example.test') {
  return new Request(url, { method: 'POST', headers: { origin } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.backend.mockReturnValue(true);
  mocks.user.mockResolvedValue({ id: 'neon-user', email: 'paid@example.com', emailVerified: true });
  let accessChecks = 0;
  mocks.sql.mockImplementation(async (parts: TemplateStringsArray) => {
    const query = parts.join('?');
    if (query.includes('FROM public.www_migration_control')) return [{ active: true }];
    if (query.includes('www_member_access')) {
      accessChecks++;
      return [{ allowed: accessChecks > 1 }];
    }
    if (query.includes('FROM public.www_pending_claims')) {
      return [{ provider_member_id: 'member-1' }];
    }
    if (query.includes('www_claim_paid_membership')) return [{ id: 'profile-1' }];
    throw new Error('unexpected_sql');
  });
  mocks.authoritative.mockResolvedValue({
    memberId: 'member-1', emailHmac: 'a'.repeat(64), allowed: true,
    verifiedAt: new Date().toISOString(),
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    validUntil: new Date(Date.now() + 60_000).toISOString(),
  });
  mocks.record.mockResolvedValue(undefined);
  mocks.discover.mockResolvedValue(null);
});

describe('POST /api/member/claim', () => {
  it('only grants after a verified session and a fresh authoritative snapshot', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'active' });
    expect(mocks.authoritative).toHaveBeenCalledWith('member-1');
    expect(mocks.record).toHaveBeenCalledOnce();
    expect(mocks.sql.mock.calls.some(([parts]) =>
      (parts as TemplateStringsArray).join('?').includes('www_claim_paid_membership'))).toBe(true);
  });

  it('keeps unverified email pending without contacting Kaihipay', async () => {
    mocks.user.mockResolvedValue({ id: 'neon-user', email: 'paid@example.com', emailVerified: false });
    const response = await POST(request());
    expect(await response.json()).toEqual({ status: 'pending' });
    expect(mocks.authoritative).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it('fails closed on provider outage and never calls the claim function', async () => {
    mocks.authoritative.mockRejectedValue(new Error('kaihipay_api_failed'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(mocks.sql.mock.calls.some(([parts]) =>
      (parts as TemplateStringsArray).join('?').includes('www_claim_paid_membership'))).toBe(false);
  });

  it('checks the provider immediately when the daily sync has not created a claim', async () => {
    mocks.sql.mockImplementation(async (parts: TemplateStringsArray) => {
      const query = parts.join('?');
      if (query.includes('FROM public.www_migration_control')) return [{ active: true }];
      if (query.includes('www_member_access')) return [{ allowed: false }];
      if (query.includes('FROM public.www_pending_claims')) return [];
      throw new Error('unexpected_sql');
    });
    const response = await POST(request());
    expect(await response.json()).toEqual({ status: 'pending' });
    expect(mocks.discover).toHaveBeenCalledWith('a'.repeat(64));
    expect(mocks.authoritative).not.toHaveBeenCalled();
  });

  it('rejects cross-origin writes before session or database access', async () => {
    const response = await POST(request('https://other.example.test'));
    expect(response.status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
});

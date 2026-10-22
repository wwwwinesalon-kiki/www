import { afterEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../lib/neon/db-runtime', () => ({ neonSql: () => dbMock.sql }));

import {
  activateNeonFromKaihipay,
  authoritativeSnapshot,
  discoverPaidClaimByEmail,
  emailClaimHmac,
  sameEmailHmac,
} from '../lib/neon/kaihipay';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  dbMock.sql.mockReset();
});

describe('Neon Kaihipay identity snapshots', () => {
  it('continues past one failed member and never calls a customer endpoint to revoke bound access', async () => {
    vi.stubEnv('KAIHIPAY_EMAIL_HMAC_SECRET', 's'.repeat(48));
    vi.stubEnv('KAIHIPAY_API_TOKEN', 'private-token');
    vi.stubEnv('KAIHIPAY_MEMBERSHIP_COURSE_ID', '42');
    vi.stubEnv('KAIHIPAY_EXPECTED_RECURRING_FEE_YEN', '3410');
    const memberIds = Array.from({ length: 6 }, (_, index) => `member-${index + 1}`);
    const applied: string[] = [];
    let failFirst = true;
    dbMock.sql.mockImplementation(async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join(' ');
      if (query.includes('FROM public.www_migration_control')) return [{ active: true }];
      if (query.includes('FROM public.article_entitlements') && query.includes('ORDER BY')) {
        return memberIds.map((provider_member_id) => ({ provider_member_id }));
      }
      if (query.includes('FROM public.www_pending_claims') && query.includes('ORDER BY')) return [];
      if (query.includes('www_apply_kaihipay_snapshot')) {
        const memberId = values[1] as string;
        applied.push(memberId);
        if (memberId === 'member-1' && failFirst) throw new Error('provider_write_failed');
      }
      return [];
    });
    const fetcher = vi.fn().mockImplementation(async (input: string) => {
      if (input.includes('/courses?')) return Response.json({ response: { data: [
        { id: 42, name: 'www月額費用', billing_type: 'monthly', recuring_fee: 3410 },
      ] } });
      if (input.includes('/orders?')) return Response.json({ response: { data: [] } });
      throw new Error('customer_endpoint_must_not_be_required_for_reversal');
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(activateNeonFromKaihipay()).rejects.toThrow('kaihipay_reconcile_partial_failure:1');
    expect(applied).toEqual(memberIds);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/customers/'))).toBe(false);

    failFirst = false;
    expect(await activateNeonFromKaihipay()).toEqual({ scanned: 6, updated: 6, review: 0 });
  });

  it('normalizes and HMACs verified email without retaining plaintext', () => {
    vi.stubEnv('KAIHIPAY_EMAIL_HMAC_SECRET', 'a'.repeat(48));
    const a = emailClaimHmac('  MEMBER@Example.COM  ');
    const b = emailClaimHmac('member@example.com');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toContain('member');
    expect(sameEmailHmac(a, b)).toBe(true);
    expect(sameEmailHmac(a, 'b'.repeat(64))).toBe(false);
    expect(() => emailClaimHmac('not-an-email')).toThrow('invalid_claim_email');
    vi.stubEnv('KAIHIPAY_EMAIL_HMAC_SECRET', 'short');
    expect(() => emailClaimHmac('member@example.com')).toThrow('kaihipay_hmac_secret_too_short');
  });

  it('takes customer email and paid service month only from official API records', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T00:00:00.000Z'));
    vi.stubEnv('KAIHIPAY_EMAIL_HMAC_SECRET', 'b'.repeat(48));
    const fetcher = vi.fn().mockResolvedValue(Response.json({ response: { data: {
      customer_number: 'member-1', mail: 'Paid@Example.com',
    } } }));
    vi.stubGlobal('fetch', fetcher);
    const snapshot = await authoritativeSnapshot('member-1', {
      token: 'private-token',
      courseId: 42,
      orders: [{
        customer_number: 'member-1', order_number: 'order-1',
        determine_status: '確定済', payment_status: '入金済',
        details: [{ type: '継続課金', course_id: 42, usage_month: '2026年10月' }],
      }],
    });
    expect(snapshot).toMatchObject({
      memberId: 'member-1', allowed: true,
      verifiedAt: '2026-10-22T00:00:00.000Z',
      validFrom: '2026-09-30T15:00:00.000Z',
      validUntil: '2026-10-31T15:00:00.000Z',
      emailHmac: emailClaimHmac('paid@example.com'),
    });
    expect(JSON.stringify(snapshot)).not.toContain('Paid@Example.com');
    expect(fetcher.mock.calls[0][0]).toBe('https://api.kaihipay.jp/v1/customers/member-1');
  });

  it('discovers one currently paid customer before cron and refuses ambiguous email matches', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T00:00:00.000Z'));
    vi.stubEnv('KAIHIPAY_EMAIL_HMAC_SECRET', 'c'.repeat(48));
    vi.stubEnv('KAIHIPAY_API_TOKEN', 'private-token');
    vi.stubEnv('KAIHIPAY_MEMBERSHIP_COURSE_ID', '42');
    vi.stubEnv('KAIHIPAY_EXPECTED_RECURRING_FEE_YEN', '3410');
    dbMock.sql.mockResolvedValue([{ next_allowed_at: '2026-10-22T00:05:00.000Z' }]);
    let sameEmailForSecond = false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: string) => {
      if (input.includes('/courses?')) return Response.json({ response: { data: [
        { id: 42, name: 'www月額費用', billing_type: 'monthly', recuring_fee: 3410 },
      ] } });
      if (input.includes('/orders?')) return Response.json({ response: { data:
        ['member-1', 'member-2'].map((memberId) => ({
          order_number: `order-${memberId}`, customer_number: memberId,
          determine_status: '確定済', payment_status: '入金済',
          details: [{ type: '継続課金', course_id: 42, usage_month: '2026年10月' }],
        })),
      } });
      if (input.includes('/customers/')) {
        const memberId = input.endsWith('/member-1') ? 'member-1' : 'member-2';
        return Response.json({ response: { data: {
          customer_number: memberId,
          mail: memberId === 'member-1' || sameEmailForSecond
            ? 'paid@example.com' : 'other@example.com',
        } } });
      }
      throw new Error('unexpected_provider_path');
    }));
    const hmac = emailClaimHmac('paid@example.com');
    expect((await discoverPaidClaimByEmail(hmac))?.memberId).toBe('member-1');
    expect(JSON.stringify(dbMock.sql.mock.calls)).not.toContain('paid@example.com');
    sameEmailForSecond = true;
    expect(await discoverPaidClaimByEmail(hmac)).toBeNull();
  });
});

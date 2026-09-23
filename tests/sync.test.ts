import { it, expect } from 'vitest';
import {
  receiveNotice,
  processNotice,
  replayPending,
  planAccount,
  inviteOnce,
  type SyncStore,
  type KaihipayAdapter,
  type VerifiedNotice,
  type VerifiedSnapshot,
} from '../lib/integrations';
function harness() {
  const pending = new Map<string, VerifiedNotice>();
  const done = new Set<string>();
  let latest: VerifiedSnapshot | undefined;
  const store: SyncStore = {
    persist: async (n) => {
      if (done.has(n.eventId)) return 'done';
      pending.set(n.eventId, n);
      return 'pending';
    },
    apply: async (n, s) => {
      if (!latest || Date.parse(s.verifiedAt) > Date.parse(latest.verifiedAt))
        latest = s;
      done.add(n.eventId);
      pending.delete(n.eventId);
    },
    failed: async () => {},
    pending: async () => [...pending.values()],
    boundMembers: async () => ['member'],
  };
  let fail = false;
  const adapter: KaihipayAdapter = {
    authenticateAndParse: async (r) =>
      r.headers.get('test-auth') === 'yes'
        ? { eventId: 'event', memberId: 'member' }
        : null,
    fetchAuthoritativeSnapshot: async (memberId) => {
      if (fail) throw new Error('outage');
      return {
        memberId,
        allowed: true,
        verifiedAt: '2026-09-12T00:00:00Z',
        validFrom: '2026-09-12T00:00:00Z',
        validUntil: '2026-09-13T00:00:00Z',
      };
    },
  };
  return {
    store,
    adapter,
    latest: () => latest,
    fail: (v: boolean) => {
      fail = v;
    },
  };
}
it('rejects unauthenticated notices before persistence', async () => {
  const h = harness();
  expect(
    await receiveNotice(
      h.adapter,
      h.store,
      new Request('https://test.invalid'),
    ),
  ).toBe('unauthorized');
  expect(await h.store.pending(10)).toHaveLength(0);
});
it('deduplicates completed notifications', async () => {
  const h = harness(),
    n = { eventId: 'a', memberId: 'member' };
  expect(await processNotice(h.adapter, h.store, n)).toBe('processed');
  expect(await processNotice(h.adapter, h.store, n)).toBe('duplicate');
});
it('records temporary failure and replays without granting new access', async () => {
  const h = harness();
  h.fail(true);
  expect(
    await processNotice(h.adapter, h.store, {
      eventId: 'b',
      memberId: 'member',
    }),
  ).toBe('retry');
  expect(h.latest()).toBeUndefined();
  h.fail(false);
  expect(await replayPending(h.adapter, h.store, 10)).toEqual(['processed']);
});
it('does not cancel a previously verified snapshot during an outage', async () => {
  const h = harness();
  await processNotice(h.adapter, h.store, { eventId: 'a', memberId: 'member' });
  const before = h.latest();
  h.fail(true);
  await processNotice(h.adapter, h.store, { eventId: 'b', memberId: 'member' });
  expect(h.latest()).toEqual(before);
});
it('email equality is not account ownership', () =>
  expect(
    planAccount({
      memberId: 'm',
      verifiedEmail: 'a@test.invalid',
      emailExists: true,
    }).action,
  ).toBe('review'));
it('rejects an invalid access expiry without granting access', async () => {
  const h = harness();
  h.adapter.fetchAuthoritativeSnapshot = async (memberId) => ({
    memberId,
    allowed: true,
    verifiedAt: '2026-09-12T00:00:00Z',
    validFrom: '2026-09-12T00:00:00Z',
    validUntil: 'invalid',
  });
  expect(
    await processNotice(h.adapter, h.store, {
      eventId: 'invalid',
      memberId: 'member',
    }),
  ).toBe('retry');
  expect(h.latest()).toBeUndefined();
});
it('existing binding reuses user without a duplicate account', () =>
  expect(
    planAccount({
      memberId: 'm',
      verifiedEmail: 'a@test.invalid',
      emailExists: true,
      boundUserId: 'u',
    }),
  ).toEqual({ action: 'reuse', userId: 'u' }));
it('invitation claims suppress duplicates and uncertain retries', async () => {
  const claimed = new Set<string>();
  let sends = 0;
  const store = {
    claim: async (id: string) => {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    complete: async () => {},
    uncertain: async () => {},
  };
  const plan = {
    action: 'invite' as const,
    memberId: 'm',
    verifiedEmail: 'a@test.invalid',
  };
  const send = async () => {
    sends++;
    throw new Error('unknown outcome');
  };
  expect(await inviteOnce(plan, store, send)).toBe('review_required');
  expect(await inviteOnce(plan, store, send)).toBe('already_claimed');
  expect(sends).toBe(1);
});

/**
 * Provider-neutral contract only. No Kaihipay endpoint, signature or grace period
 * is assumed here. The production adapter stays disabled until contract review.
 */
export type VerifiedNotice = { eventId: string; memberId: string };
export type VerifiedSnapshot = {
  memberId: string;
  allowed: boolean;
  verifiedAt: string;
  validFrom: string | null;
  validUntil: string | null;
};
export interface KaihipayAdapter {
  authenticateAndParse(request: Request): Promise<VerifiedNotice | null>;
  fetchAuthoritativeSnapshot(memberId: string): Promise<VerifiedSnapshot>;
}
export interface SyncStore {
  persist(notice: VerifiedNotice): Promise<'pending' | 'done'>;
  apply(notice: VerifiedNotice, snapshot: VerifiedSnapshot): Promise<void>;
  failed(notice: VerifiedNotice, code: string): Promise<void>;
  pending(limit: number): Promise<VerifiedNotice[]>;
  boundMembers(limit: number, after?: string): Promise<string[]>;
}
export async function processNotice(
  adapter: KaihipayAdapter,
  store: SyncStore,
  notice: VerifiedNotice,
) {
  if ((await store.persist(notice)) === 'done') return 'duplicate';
  try {
    // Never apply the notification payload as authoritative membership state.
    const snapshot = await adapter.fetchAuthoritativeSnapshot(notice.memberId);
    if (
      snapshot.memberId !== notice.memberId ||
      !Number.isFinite(Date.parse(snapshot.verifiedAt)) ||
      (snapshot.allowed &&
        (!snapshot.validFrom || !snapshot.validUntil ||
          !Number.isFinite(Date.parse(snapshot.validFrom)) ||
          !Number.isFinite(Date.parse(snapshot.validUntil)) ||
          Date.parse(snapshot.validUntil) <= Date.parse(snapshot.validFrom)))
    )
      throw new Error('invalid_snapshot');
    await store.apply(notice, snapshot);
    return 'processed';
  } catch {
    // Do not turn an upstream outage into blanket activation or cancellation.
    await store.failed(notice, 'lookup_or_apply_failed');
    return 'retry';
  }
}
export async function receiveNotice(
  adapter: KaihipayAdapter,
  store: SyncStore,
  req: Request,
) {
  const notice = await adapter.authenticateAndParse(req);
  if (!notice) return 'unauthorized';
  return processNotice(adapter, store, notice);
}
export async function replayPending(
  adapter: KaihipayAdapter,
  store: SyncStore,
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('invalid_batch');
  const results = [];
  // Sequential processing: batch size and schedule must follow confirmed rate limits.
  for (const notice of await store.pending(limit))
    results.push(await processNotice(adapter, store, notice));
  return results;
}
export async function reconcileBatch(
  adapter: KaihipayAdapter,
  store: SyncStore,
  options: { limit: number; runId: string; after?: string },
) {
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 100
  )
    throw new Error('invalid_batch');
  const members = await store.boundMembers(options.limit, options.after);
  for (const memberId of members)
    await processNotice(adapter, store, {
      eventId: 'reconcile:' + options.runId + ':' + memberId,
      memberId,
    });
  return members.at(-1);
}
export type AccountPlan =
  | { action: 'reuse'; userId: string }
  | { action: 'review'; reason: string }
  | { action: 'invite'; memberId: string; verifiedEmail: string };
export function planAccount(input: {
  memberId: string;
  verifiedEmail: string;
  boundUserId?: string;
  emailExists: boolean;
  verifiedExistingUserId?: string;
}): AccountPlan {
  if (input.boundUserId) return { action: 'reuse', userId: input.boundUserId };
  // verifiedExistingUserId must come from staff reconciliation with proof of
  // ownership of BOTH identities, never from user metadata or an email lookup.
  if (input.verifiedExistingUserId)
    return { action: 'reuse', userId: input.verifiedExistingUserId };
  if (input.emailExists)
    return { action: 'review', reason: 'verify_both_identities' };
  return {
    action: 'invite',
    memberId: input.memberId,
    verifiedEmail: input.verifiedEmail,
  };
}
export interface InvitationStore {
  claim(memberId: string): Promise<boolean>;
  complete(memberId: string, userId: string): Promise<void>;
  uncertain(memberId: string): Promise<void>;
}
export async function inviteOnce(
  plan: Extract<AccountPlan, { action: 'invite' }>,
  store: InvitationStore,
  sendVerifiedInvite: (email: string) => Promise<{ userId: string }>,
) {
  if (!(await store.claim(plan.memberId))) return 'already_claimed';
  try {
    const { userId } = await sendVerifiedInvite(plan.verifiedEmail);
    await store.complete(plan.memberId, userId);
    return 'sent';
  } catch {
    await store.uncertain(plan.memberId);
    return 'review_required';
  }
  // Unknown send outcome is NOT automatically retried. Reconcile Auth users first.
}
export function getLineJoinUrl() {
  return process.env.LINE_JOIN_URL || 'https://lin.ee/xWYPyBv';
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { readAllOrders, readCustomer, resolveMembershipCourseIdWithFee } from '../kaihipay-api-runtime';
import { paidAccessWindow, paidServiceMonths, type Order } from '../kaihipay-orders';
import { neonSql } from './db-runtime';

type PaidWindow = { validFrom: string; validUntil: string } | null;

export type KaihipaySnapshot = {
  memberId: string;
  emailHmac: string;
  allowed: boolean;
  verifiedAt: string;
  validFrom: string | null;
  validUntil: string | null;
};
type PaymentSnapshot = Omit<KaihipaySnapshot, 'emailHmac'>;

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function hmacSecret(): string {
  const secret = requiredSetting('KAIHIPAY_EMAIL_HMAC_SECRET');
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('kaihipay_hmac_secret_too_short');
  return secret;
}

async function neonMembershipCourseId(token: string): Promise<number> {
  const configuredId = requiredSetting('KAIHIPAY_MEMBERSHIP_COURSE_ID');
  const expectedFeeText = requiredSetting('KAIHIPAY_EXPECTED_RECURRING_FEE_YEN');
  if (!/^[1-9]\d*$/.test(configuredId) ||
      !/^[1-9]\d*$/.test(expectedFeeText) ||
      !Number.isSafeInteger(Number(expectedFeeText))) {
    throw new Error('kaihipay_course_fee_review_required');
  }
  // The approved customer total is 3,410. The exact API recurring_fee field
  // must be inspected before setting this expected value; a separate fee may
  // explain the difference, but this code does not assume one exists.
  return resolveMembershipCourseIdWithFee(token, configuredId, Number(expectedFeeText));
}

/** Only a server-verified Neon Auth email or the Kaihipay customer API is accepted. */
export function emailClaimHmac(email: string, secret = hmacSecret()): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('invalid_claim_email');
  }
  return createHmac('sha256', secret).update(normalized, 'utf8').digest('hex');
}

export function sameEmailHmac(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function windowForMember(
  orders: Order[], memberId: string, courseId: number, now: Date,
): PaidWindow {
  return paidAccessWindow(paidServiceMonths(orders, memberId, courseId), now);
}

/** Read only authoritative API records; caller never supplies payment state. */
export async function authoritativeSnapshot(
  memberId: string,
  context?: { token: string; courseId: number; orders: Order[]; ordersReadAt?: string },
): Promise<KaihipaySnapshot> {
  const token = context?.token ?? requiredSetting('KAIHIPAY_API_TOKEN');
  const courseId = context?.courseId ?? await neonMembershipCourseId(token);
  const orders = context?.orders ?? await readAllOrders(token);
  // Timestamp the order read, not the later customer lookup. A slow cron must
  // never overwrite a newer payment reversal with an older cached order list.
  const verifiedAt = context?.ordersReadAt ? new Date(context.ordersReadAt) : new Date();
  if (!Number.isFinite(verifiedAt.getTime()) || verifiedAt.getTime() > Date.now() + 60_000) {
    throw new Error('invalid_kaihipay_snapshot_time');
  }
  const customer = await readCustomer(token, memberId);
  const window = windowForMember(orders, memberId, courseId, verifiedAt);
  return {
    memberId,
    emailHmac: emailClaimHmac(customer.email),
    allowed: !!window,
    verifiedAt: verifiedAt.toISOString(),
    validFrom: window?.validFrom ?? null,
    validUntil: window?.validUntil ?? null,
  };
}

/** Bound payment reversals do not depend on a separate customer-contact lookup. */
async function applyBoundPaymentSnapshot(snapshot: PaymentSnapshot): Promise<void> {
  const sql = neonSql();
  const eventId = `reconcile:${snapshot.memberId}`;
  await sql`
    INSERT INTO public.kaihipay_sync_events (
      event_id, provider_member_id, received_at, processed_at, error_code
    ) VALUES (${eventId}, ${snapshot.memberId}, ${snapshot.verifiedAt}, NULL, NULL)
    ON CONFLICT (event_id) DO UPDATE SET
      received_at = EXCLUDED.received_at,
      processed_at = NULL, error_code = NULL
  `;
  await sql`
    SELECT public.www_apply_kaihipay_snapshot(
      ${eventId}, ${snapshot.memberId}, ${snapshot.allowed},
      ${snapshot.verifiedAt}, ${snapshot.validFrom}, ${snapshot.validUntil}
    )
  `;
}

/** No customer email, name, address, or raw provider response is stored in Neon. */
export async function recordAuthoritativeSnapshot(snapshot: KaihipaySnapshot): Promise<void> {
  const sql = neonSql();
  const bound = (await sql`
    SELECT user_id FROM public.article_entitlements
    WHERE provider_member_id = ${snapshot.memberId} LIMIT 1
  `) as unknown as Array<{ user_id: string }>;

  if (bound.length) {
    // New claims retain this row after redemption. Reconcile the entitlement
    // first: a pending-claim HMAC conflict must not block a reversal.
    await applyBoundPaymentSnapshot(snapshot);
    await sql`
      UPDATE public.www_pending_claims SET
        email_hmac = ${snapshot.emailHmac}, allowed = ${snapshot.allowed},
        verified_at = ${snapshot.verifiedAt},
        valid_from = ${snapshot.validFrom}, valid_until = ${snapshot.validUntil}
      WHERE provider_member_id = ${snapshot.memberId}
        AND (verified_at IS NULL OR verified_at < ${snapshot.verifiedAt})
    `;
    return;
  }

  // Unique email HMAC and member ID make conflicting provider identities a hard
  // error for manual review, never an automatic transfer between accounts.
  await sql`
    INSERT INTO public.www_pending_claims (
      provider_member_id, email_hmac, allowed, verified_at, valid_from, valid_until
    ) VALUES (
      ${snapshot.memberId}, ${snapshot.emailHmac}, ${snapshot.allowed},
      ${snapshot.verifiedAt}, ${snapshot.validFrom}, ${snapshot.validUntil}
    ) ON CONFLICT (provider_member_id) DO UPDATE SET
      email_hmac = EXCLUDED.email_hmac,
      allowed = EXCLUDED.allowed,
      verified_at = EXCLUDED.verified_at,
      valid_from = EXCLUDED.valid_from,
      valid_until = EXCLUDED.valid_until
    WHERE public.www_pending_claims.verified_at IS NULL
      OR public.www_pending_claims.verified_at < EXCLUDED.verified_at
  `;
}

/** Existing cron/admin sync entrypoint, used only after the migration gate opens. */
export async function activateNeonFromKaihipay(): Promise<{
  scanned: number; updated: number; review: number;
}> {
  const sql = neonSql();
  const gate = (await sql`
    SELECT activated_at IS NOT NULL AS active
    FROM public.www_migration_control WHERE singleton = true
  `) as unknown as Array<{ active: boolean }>;
  if (gate[0]?.active !== true) throw new Error('migration_not_activated');

  // Validate all secrets before any write. The API can still fail afterwards;
  // no new entitlement is granted without a complete authoritative snapshot.
  hmacSecret();
  const token = requiredSetting('KAIHIPAY_API_TOKEN');
  const courseId = await neonMembershipCourseId(token);
  const orders = await readAllOrders(token);
  const ordersReadAt = new Date().toISOString();
  const now = new Date(ordersReadAt);
  const memberIds = new Set<string>();
  const bound = (await sql`
    SELECT provider_member_id FROM public.article_entitlements
    ORDER BY provider_member_id
  `) as unknown as Array<{ provider_member_id: string }>;
  const boundIds = new Set(bound.map((row) => row.provider_member_id));
  const pending = (await sql`
    SELECT provider_member_id FROM public.www_pending_claims
    ORDER BY provider_member_id
  `) as unknown as Array<{ provider_member_id: string }>;
  const pendingIds = new Set(pending.map((row) => row.provider_member_id));
  // Existing grants and pending claims are reconciled before new candidates.
  for (const row of bound) memberIds.add(row.provider_member_id);
  for (const row of pending) memberIds.add(row.provider_member_id);
  for (const order of orders) {
    if (typeof order.customer_number !== 'string') continue;
    if (windowForMember(orders, order.customer_number, courseId, now)) {
      memberIds.add(order.customer_number);
    }
  }
  // Kaihipay limits API traffic; never silently omit a member from a "success".
  if (memberIds.size > 120) throw new Error('kaihipay_customer_batch_limit');

  const ids = [...memberIds];
  let updated = 0;
  let review = 0;
  for (let index = 0; index < ids.length; index += 5) {
    const outcomes = await Promise.allSettled(
      ids.slice(index, index + 5).map(async (memberId) => {
        const window = windowForMember(orders, memberId, courseId, now);
        const payment: PaymentSnapshot = {
          memberId, allowed: !!window, verifiedAt: ordersReadAt,
          validFrom: window?.validFrom ?? null,
          validUntil: window?.validUntil ?? null,
        };
        if (boundIds.has(memberId)) {
          await applyBoundPaymentSnapshot(payment);
          // The old HMAC remains private; only payment state changes here.
          await sql`
            UPDATE public.www_pending_claims SET
              allowed = ${payment.allowed}, verified_at = ${payment.verifiedAt},
              valid_from = ${payment.validFrom}, valid_until = ${payment.validUntil}
            WHERE provider_member_id = ${memberId}
              AND (verified_at IS NULL OR verified_at < ${ordersReadAt})
          `;
        } else if (!window && pendingIds.has(memberId)) {
          // Revoking an unclaimed record does not require customer email.
          await sql`
            UPDATE public.www_pending_claims SET
              allowed = false, verified_at = ${ordersReadAt},
              valid_from = NULL, valid_until = NULL
            WHERE provider_member_id = ${memberId}
              AND (verified_at IS NULL OR verified_at < ${ordersReadAt})
          `;
        } else {
          const snapshot = await authoritativeSnapshot(memberId, {
            token, courseId, orders, ordersReadAt,
          });
          await recordAuthoritativeSnapshot(snapshot);
        }
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') updated++;
      else review++;
    }
  }
  // Netlify retries failed background runs. Do not report a partial run as a
  // success even when the other members were reconciled safely.
  if (review) throw new Error(`kaihipay_reconcile_partial_failure:${review}`);
  return { scanned: ids.length, updated, review };
}

/** Immediate first-login discovery before the next daily cron, rate-limited. */
export async function discoverPaidClaimByEmail(
  claimantHmac: string,
): Promise<KaihipaySnapshot | null> {
  if (!/^[0-9a-f]{64}$/.test(claimantHmac)) throw new Error('invalid_claim_hmac');
  const sql = neonSql();
  const gate = (await sql`
    INSERT INTO public.www_claim_lookup_throttle(email_hmac, next_allowed_at)
    VALUES (${claimantHmac}, now() + interval '5 minutes')
    ON CONFLICT (email_hmac) DO UPDATE SET
      next_allowed_at = now() + interval '5 minutes'
    WHERE public.www_claim_lookup_throttle.next_allowed_at <= now()
    RETURNING next_allowed_at
  `) as unknown as Array<{ next_allowed_at: string }>;
  if (!gate.length) return null;

  try {
    hmacSecret();
    const token = requiredSetting('KAIHIPAY_API_TOKEN');
    const courseId = await neonMembershipCourseId(token);
    const orders = await readAllOrders(token);
    const ordersReadAt = new Date().toISOString();
    const now = new Date(ordersReadAt);
    const memberIds = new Set<string>();
    for (const order of orders) {
      if (typeof order.customer_number !== 'string') continue;
      const window = windowForMember(orders, order.customer_number, courseId, now);
      if (window && Date.parse(window.validFrom) <= now.getTime() &&
          Date.parse(window.validUntil) > now.getTime()) {
        memberIds.add(order.customer_number);
      }
    }
    if (memberIds.size > 40) throw new Error('kaihipay_discovery_batch_limit');

    const snapshots: KaihipaySnapshot[] = [];
    const ids = [...memberIds];
    for (let index = 0; index < ids.length; index += 5) {
      const batch = await Promise.all(ids.slice(index, index + 5).map(
        (memberId) => authoritativeSnapshot(memberId, {
          token, courseId, orders, ordersReadAt,
        }),
      ));
      snapshots.push(...batch.filter((snapshot) =>
        snapshot.allowed && sameEmailHmac(snapshot.emailHmac, claimantHmac)));
    }
    // Two paid customers sharing one email require human review. Never choose
    // whichever appeared first in the API result.
    return snapshots.length === 1 ? snapshots[0] : null;
  } catch (error) {
    // Provider outages should be retryable once recovered, not hidden for five
    // minutes by a failed lookup reservation.
    await sql`
      DELETE FROM public.www_claim_lookup_throttle
      WHERE email_hmac = ${claimantHmac}
        AND next_allowed_at = ${gate[0].next_allowed_at}
    `.catch(() => undefined);
    throw error;
  }
}

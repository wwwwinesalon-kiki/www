import { isNeonBackend, neonSql } from '@/lib/neon/db';
import { neonSessionUser } from '@/lib/neon/auth';
import {
  authoritativeSnapshot,
  discoverPaidClaimByEmail,
  emailClaimHmac,
  recordAuthoritativeSnapshot,
  sameEmailHmac,
} from '@/lib/neon/kaihipay';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

/** Claim a paid month using only a verified Neon session, never a supplied ID. */
export async function POST(request: Request) {
  if (!isNeonBackend()) return Response.json({ error: 'Not Found' }, { status: 404, headers });
  try {
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    }
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }

  try {
    const user = await neonSessionUser();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (user.emailVerified !== true || !user.email) {
      return Response.json({ status: 'pending' }, { headers });
    }
    const sql = neonSql();
    const migration = (await sql`
      SELECT activated_at IS NOT NULL AS active
      FROM public.www_migration_control WHERE singleton = true
    `) as unknown as Array<{ active: boolean }>;
    if (migration[0]?.active !== true) {
      return Response.json({ status: 'unavailable' }, { status: 503, headers });
    }
    const active = (await sql`
      SELECT public.www_member_access(${user.id}) AS allowed
    `) as unknown as Array<{ allowed: boolean }>;
    if (active[0]?.allowed === true) {
      return Response.json({ status: 'active' }, { headers });
    }

    const claimantHmac = emailClaimHmac(user.email);
    const candidates = (await sql`
      SELECT provider_member_id FROM public.www_pending_claims
      WHERE email_hmac = ${claimantHmac} LIMIT 1
    `) as unknown as Array<{ provider_member_id: string }>;
    // This API read must finish successfully for every new grant. A stale cron
    // row, browser claim, or provider outage cannot open member access.
    const snapshot = candidates.length
      ? await authoritativeSnapshot(candidates[0].provider_member_id)
      : await discoverPaidClaimByEmail(claimantHmac);
    if (!snapshot) return Response.json({ status: 'pending' }, { headers });
    await recordAuthoritativeSnapshot(snapshot);
    if (!sameEmailHmac(snapshot.emailHmac, claimantHmac) || !snapshot.allowed ||
        !snapshot.validFrom || !snapshot.validUntil ||
        Date.parse(snapshot.validFrom) > Date.now() ||
        Date.parse(snapshot.validUntil) <= Date.now()) {
      return Response.json({ status: 'pending' }, { headers });
    }

    try {
      await sql`
        SELECT public.www_claim_paid_membership(${user.id}, ${claimantHmac})
      `;
    } catch (error) {
      // A claim redeemed by another verified account or an existing different
      // provider binding is a manual-review case, not an automatic transfer.
      if (/claim_already_bound|profile_already_bound_to_other_member|no_current_paid_claim/.test(String(error))) {
        return Response.json({ status: 'pending' }, { headers });
      }
      throw error;
    }
    const granted = (await sql`
      SELECT public.www_member_access(${user.id}) AS allowed
    `) as unknown as Array<{ allowed: boolean }>;
    return Response.json(
      { status: granted[0]?.allowed === true ? 'active' : 'pending' },
      { headers },
    );
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}

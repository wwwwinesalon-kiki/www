import 'server-only';
import { storageService } from './supabase/service';
import { readAllOrders, readCustomer, resolveMembershipCourseId } from './kaihipay-api';
import { readAuthEmailIndex } from './auth-email-index';
import { paidAccessWindow, paidServiceMonths } from './kaihipay-orders';
import { SupabaseInvitationStore, SupabaseSyncStore } from './kaihipay-store';
import { inviteOnce, processNotice, type KaihipayAdapter, type VerifiedSnapshot } from './integrations';
import { isNeonBackend } from './neon/db';
import { activateNeonFromKaihipay } from './neon/kaihipay';

const genericError = 'kaihipay_activation_failed';
function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

export async function activateFromKaihipay(): Promise<{
  scanned: number; updated: number; review: number;
}> {
  if (isNeonBackend()) return activateNeonFromKaihipay();
  const token = requiredSetting('KAIHIPAY_API_TOKEN');
  const courseId = await resolveMembershipCourseId(token,process.env.KAIHIPAY_MEMBERSHIP_COURSE_ID);
  const site = new URL(requiredSetting('NEXT_PUBLIC_SITE_URL'));
  if (site.protocol !== 'https:') throw new Error('invalid_site_url');
  const db = storageService();
  const orders = await readAllOrders(token);
  const customers = new Set<string>();
  for (const order of orders) {
    if (typeof order.customer_number === 'string' &&
        paidServiceMonths([order], order.customer_number, courseId).length)
      customers.add(order.customer_number);
  }
  const { data: bound, error: boundError } = await db.from('article_entitlements')
    .select('provider_member_id').limit(1000);
  if (boundError) throw new Error('bindings_read_failed');
  for (const row of bound || []) customers.add(row.provider_member_id);
  if (customers.size > 1000 || (bound || []).length === 1000) throw new Error('kaihipay_customer_limit');
  const sync = new SupabaseSyncStore(db);
  const invitations = new SupabaseInvitationStore(db);
  const now = new Date();
  let updated = 0, review = 0;
  let knownEmails: Set<string> | null = null;

  for (const number of customers) {
    try {
      const months = paidServiceMonths(orders, number, courseId);
      const window = paidAccessWindow(months, now);
      const { data: existing, error: existingError } = await db
        .from('article_entitlements').select('user_id').eq('provider_member_id', number).maybeSingle();
      if (existingError) throw new Error(genericError);

      if (!existing && window) {
        const { data: job, error: jobError } = await db.from('kaihipay_invitation_jobs')
          .select('status,user_id').eq('provider_member_id', number).maybeSingle();
        if (jobError) throw new Error(genericError);
        let userId = job?.status === 'sent' && job.user_id ? job.user_id as string : null;
        if (!userId && job) { review++; continue; }
        if (!userId) {
          const customer = await readCustomer(token, number);
          knownEmails ??= await readAuthEmailIndex(db);
          const normalizedEmail = customer.email.trim().toLowerCase();
          if (knownEmails.has(normalizedEmail)) {
            await db.from('kaihipay_invitation_jobs').insert({provider_member_id:number,status:'review'});
            review++; continue;
          }
          const result = await inviteOnce(
            { action:'invite', memberId:number, verifiedEmail:customer.email }, invitations,
            async (email) => {
              const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
                redirectTo: new URL('/member/auth?next=/member/setup', site).toString(),
              });
              if (error || !data.user) throw new Error('invite_failed');
              return { userId:data.user.id };
            },
          );
          if (result !== 'sent') { review++; continue; }
          knownEmails.add(normalizedEmail);
          const { data: sentJob } = await db.from('kaihipay_invitation_jobs')
            .select('user_id').eq('provider_member_id',number).single();
          userId = sentJob?.user_id || null;
        }
        if (!userId) throw new Error(genericError);
        // article_entitlements is the only WWW-side Kaihipay identity binding.
        const { error } = await db.from('article_entitlements').insert({
          user_id:userId,provider_member_id:number,allowed:false,
        });
        if (error && error.code !== '23505') throw new Error(genericError);
      }
      // One durable reconciliation row per provider member avoids unbounded audit growth.
      // Refreshing it also catches reversals that return to a previous order status.
      const eventId = `reconcile:${number}`;
      const { error: queueError } = await db.from('kaihipay_sync_events').upsert({
        event_id:eventId,provider_member_id:number,received_at:now.toISOString(),
        processed_at:null,error_code:null,
      }, {onConflict:'event_id'});
      if (queueError) throw new Error(genericError);
      const snapshot: VerifiedSnapshot = {
        memberId:number, allowed:!!window, verifiedAt:now.toISOString(),
        validFrom:window?.validFrom || null, validUntil:window?.validUntil || null,
      };
      const adapter: KaihipayAdapter = {
        authenticateAndParse: async () => null,
        fetchAuthoritativeSnapshot: async () => snapshot,
      };
      const result = await processNotice(adapter,sync,{eventId,memberId:number});
      if (result === 'retry') review++;
      else if (result === 'processed') updated++;
    } catch {
      review++;
    }
  }
  return { scanned:customers.size, updated, review };
}

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SyncStore,
  VerifiedNotice,
  VerifiedSnapshot,
  InvitationStore,
} from './integrations';
export class SupabaseSyncStore implements SyncStore {
  constructor(private client: SupabaseClient) {}
  async persist(n: VerifiedNotice): Promise<'pending' | 'done'> {
    const { error } = await this.client
      .from('kaihipay_sync_events')
      .upsert(
        { event_id: n.eventId, provider_member_id: n.memberId },
        { onConflict: 'event_id', ignoreDuplicates: true },
      );
    if (error) throw new Error('persist_failed');
    const { data, error: readError } = await this.client
      .from('kaihipay_sync_events')
      .select('processed_at,provider_member_id')
      .eq('event_id', n.eventId)
      .single();
    if (readError || data.provider_member_id !== n.memberId)
      throw new Error('event_identity_conflict');
    return data.processed_at ? 'done' : 'pending';
  }
  async apply(n: VerifiedNotice, s: VerifiedSnapshot) {
    const { error } = await this.client.rpc('apply_kaihipay_snapshot', {
      p_event_id: n.eventId,
      p_member_id: n.memberId,
      p_allowed: s.allowed,
      p_verified_at: s.verifiedAt,
      p_valid_until: s.validUntil,
    });
    if (error) throw new Error('apply_failed');
  }
  async failed(n: VerifiedNotice, code: string) {
    const { error } = await this.client
      .from('kaihipay_sync_events')
      .update({ error_code: code })
      .eq('event_id', n.eventId)
      .is('processed_at', null);
    if (error) throw new Error('failure_record_failed');
  }
  async pending(limit: number) {
    const { data, error } = await this.client
      .from('kaihipay_sync_events')
      .select('event_id,provider_member_id')
      .is('processed_at', null)
      .order('received_at')
      .limit(limit);
    if (error) throw new Error('queue_read_failed');
    return (data || []).map((r) => ({
      eventId: r.event_id,
      memberId: r.provider_member_id,
    }));
  }
  async boundMembers(limit: number, after?: string) {
    let q = this.client
      .from('article_entitlements')
      .select('provider_member_id')
      .order('provider_member_id')
      .limit(limit);
    if (after) q = q.gt('provider_member_id', after);
    const { data, error } = await q;
    if (error) throw new Error('bindings_read_failed');
    return (data || []).map((r) => r.provider_member_id as string);
  }
}
export class SupabaseInvitationStore implements InvitationStore {
  constructor(private client: SupabaseClient) {}
  async claim(memberId: string) {
    const { error } = await this.client
      .from('kaihipay_invitation_jobs')
      .insert({ provider_member_id: memberId, status: 'sending' });
    if (error?.code === '23505') return false;
    if (error) throw new Error('claim_failed');
    return true;
  }
  async complete(memberId: string, userId: string) {
    const { error } = await this.client
      .from('kaihipay_invitation_jobs')
      .update({ status: 'sent', user_id: userId })
      .eq('provider_member_id', memberId);
    if (error) throw new Error('invite_record_failed');
  }
  async uncertain(memberId: string) {
    const { error } = await this.client
      .from('kaihipay_invitation_jobs')
      .update({ status: 'review' })
      .eq('provider_member_id', memberId);
    if (error) throw new Error('invite_record_failed');
  }
}

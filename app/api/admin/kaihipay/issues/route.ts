import { requireAdmin } from '@/lib/admin-auth';
import { storageService } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

// Contact details and payment records stay in Kaihipay.
export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor || actor.role !== 'owner')
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });

  try {
    const db = storageService();
    const [invitations, syncEvents] = await Promise.all([
      db.from('kaihipay_invitation_jobs')
        .select('provider_member_id,status')
        .in('status', ['review', 'sending'])
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('kaihipay_sync_events')
        .select('provider_member_id')
        .not('error_code', 'is', null)
        .is('processed_at', null)
        .order('received_at', { ascending: false })
        .limit(50),
    ]);
    if (invitations.error || syncEvents.error)
      throw new Error('kaihipay_issues_read_failed');

    return Response.json({
      invitations: (invitations.data || []).map((row) => ({
        memberId: row.provider_member_id,
        status: row.status,
      })),
      sync: [...new Set((syncEvents.data || []).map((row) => row.provider_member_id))]
        .map((memberId) => ({ memberId })),
    }, { headers });
  } catch {
    return Response.json({ error: '処理状況を取得できませんでした' },
      { status: 503, headers });
  }
}

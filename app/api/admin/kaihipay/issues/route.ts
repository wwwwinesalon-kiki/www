import { requireAdmin } from '@/lib/admin-auth';
import { storageService } from '@/lib/supabase/service';
import { isNeonBackend, neonSql } from '@/lib/neon/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

// Contact details and payment records stay in Kaihipay.
export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor || actor.role !== 'owner')
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });

  try {
    if (isNeonBackend()) {
      const sql = neonSql();
      const [invitations, syncEvents] = await Promise.all([
        sql`select provider_member_id,status from public.kaihipay_invitation_jobs
          where status in ('review','sending') order by created_at desc limit 50`,
        sql`select distinct provider_member_id from public.kaihipay_sync_events
          where error_code is not null and processed_at is null
          order by provider_member_id limit 50`,
      ]);
      return Response.json({
        invitations: (invitations as unknown as Array<{ provider_member_id: string; status: string }>).map((row) => ({
          memberId: row.provider_member_id, status: row.status,
        })),
        sync: (syncEvents as unknown as Array<{ provider_member_id: string }>).map((row) => ({
          memberId: row.provider_member_id,
        })),
      }, { headers });
    }
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

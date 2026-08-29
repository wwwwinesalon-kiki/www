import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  const queries = [
    "SELECT id,name,line_name line,email,status,COALESCE(joined_at,'—') joined,source,last_contact_at lastContact,interest_categories interestCategories,notes,created_at FROM members WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 500",
    "SELECT e.*,substr(e.start_at,1,10) date,e.publish_status status,(SELECT COUNT(*) FROM event_applications a WHERE a.event_id=e.id AND a.deleted_at IS NULL AND a.application_status NOT IN ('cancelled','no_show')) applications FROM events e WHERE e.deleted_at IS NULL ORDER BY e.start_at LIMIT 300",
    'SELECT a.*,e.title event_title FROM event_applications a JOIN events e ON e.id=a.event_id WHERE a.deleted_at IS NULL ORDER BY a.applied_at DESC LIMIT 500',
    'SELECT p.id,p.application_id,a.name,e.title event,p.amount,p.status,p.paid_at paidAt,p.refunded_at refundedAt FROM event_payments p JOIN event_applications a ON a.id=p.application_id JOIN events e ON e.id=a.event_id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 500',
    'SELECT c.*,c.public_visible publicVisible,c.member_visible memberVisible,c.publish_status status FROM contents c WHERE c.deleted_at IS NULL ORDER BY c.updated_at DESC LIMIT 500',
    'SELECT p.*,c.title,c.type FROM content_placements p JOIN contents c ON c.id=p.content_id WHERE p.archived_at IS NULL AND c.deleted_at IS NULL ORDER BY p.surface,p.position',
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100',
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300',
    'SELECT event_type,path,entity_id,COUNT(*) value,COUNT(DISTINCT session_id) sessions FROM analytics_events GROUP BY event_type,path,entity_id ORDER BY value DESC LIMIT 300',
    'SELECT key,value FROM settings',
    'SELECT role,access_email FROM admin_users ORDER BY role,access_email',
  ];
  const rows = await Promise.all(queries.map((q) => env.DB.prepare(q).all()));
  const settings = Object.fromEntries(
    (rows[9].results as { key: string; value: string }[]).map((r) => {
      try {
        return [r.key, JSON.parse(r.value)];
      } catch {
        return [r.key, r.value];
      }
    }),
  );
  return Response.json({
    members: rows[0].results,
    events: rows[1].results,
    applications: rows[2].results,
    payments: rows[3].results,
    contents: rows[4].results,
    placements: rows[5].results,
    notifications: rows[6].results,
    logs: rows[7].results,
    analytics: rows[8].results,
    settings,
    adminUsers: rows[10].results,
  });
}

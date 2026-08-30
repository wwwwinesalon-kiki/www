import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: Request) {
  return (await requireAdmin(req))
    ? Response.json({})
    : Response.json({ error: 'Forbidden' }, { status: 403 });
}
export async function PATCH(req: Request) {
  return (await requireAdmin(req, true))
    ? Response.json({ error: '環境設定はVercelで管理します' }, { status: 422 })
    : Response.json({ error: 'Forbidden' }, { status: 403 });
}

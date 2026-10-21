import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return Response.json(
    { error: '会員情報は会費ペイで管理してください' },
    { status: 410 },
  );
}

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: Request) {
  return (await requireAdmin(req, true))
    ? Response.json(
        { error: 'Supabase Storageの設定後に利用できます' },
        { status: 503 },
      )
    : Response.json({ error: 'Forbidden' }, { status: 403 });
}

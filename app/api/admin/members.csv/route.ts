import { requireAdmin } from '@/lib/admin-auth';
export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = await actor.supabase
    .from('profiles')
    .select('email,name,role,status,created_at')
    .order('created_at');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const escape = (value: unknown) => {
    const text =
      typeof value === 'string' || typeof value === 'number' ? `${value}` : '';
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [
    'email,name,role,status,created_at',
    ...(data || []).map((row) =>
      [row.email, row.name, row.role, row.status, row.created_at]
        .map(escape)
        .join(','),
    ),
  ].join('\n');
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="members.csv"',
    },
  });
}

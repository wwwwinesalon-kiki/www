import type { AdminRole } from './auth';
import { createClient } from '@/lib/supabase/server';
export async function requireAdmin(req: Request, write = false) {
  if (write) {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).origin !== new URL(req.url).origin)
      return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = data?.role as AdminRole | undefined;
  if (
    !role ||
    !['owner', 'editor', 'viewer'].includes(role) ||
    (write && role === 'viewer')
  )
    return null;
  return { email: user.email || user.id, role, userId: user.id, supabase };
}

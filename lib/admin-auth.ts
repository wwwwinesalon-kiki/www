import type { AdminRole } from './auth';
import { createClient } from '@/lib/supabase/server';
import { isNeonBackend } from '@/lib/neon/db';
import { linkedNeonIdentity } from '@/lib/neon/identity';
import { legacySupabaseUnavailable } from '@/lib/neon/legacy-guard';
export async function requireAdmin(req: Request, write = false) {
  if (write) {
    const origin = req.headers.get('origin');
    try {
      if (origin && new URL(origin).origin !== new URL(req.url).origin)
        return null;
    } catch {
      return null;
    }
  }
  if (isNeonBackend()) {
    const identity = await linkedNeonIdentity();
    if (
      !identity ||
      identity.role === 'member' ||
      (write && identity.role === 'viewer')
    )
      return null;
    return {
      email: identity.email,
      role: identity.role,
      userId: identity.profileId,
      supabase: legacySupabaseUnavailable(),
    };
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

import 'server-only';

import { neonSql } from '@/lib/neon/db';
import { neonSessionUser } from '@/lib/neon/auth';
import type { AdminRole } from '@/lib/auth';

export type LinkedNeonIdentity = {
  authSubject: string;
  profileId: string;
  email: string;
  role: AdminRole | 'member';
  entitled: boolean;
};

/**
 * Never infer a legacy membership or staff role from an email match alone.
 * A separately verified link binds the managed auth subject to a profile.
 */
export async function linkedNeonIdentity(
  sessionUser?: Awaited<ReturnType<typeof neonSessionUser>>,
): Promise<LinkedNeonIdentity | null> {
  const user =
    sessionUser === undefined ? await neonSessionUser() : sessionUser;
  if (!user?.id || user.emailVerified !== true) return null;
  const sql = neonSql();
  const profiles = (await sql`
    SELECT p.id, p.role
    FROM public.www_auth_links AS link
    JOIN public.profiles AS p ON p.id = link.profile_id
    WHERE link.auth_subject = ${user.id}
      AND link.verified_at IS NOT NULL
      AND p.status = 'active'
    LIMIT 1
  `) as unknown as Array<{ id: string; role: string }>;
  const profile = profiles[0];
  if (!profile) return null;

  const access = (await sql`
    SELECT public.www_member_access(${user.id}) AS allowed
  `) as unknown as Array<{ allowed: boolean }>;
  return {
    authSubject: user.id,
    profileId: profile.id,
    email: user.email || profile.id,
    role: ['owner', 'editor', 'viewer'].includes(profile.role)
      ? (profile.role as AdminRole)
      : 'member',
    entitled: access[0]?.allowed === true,
  };
}

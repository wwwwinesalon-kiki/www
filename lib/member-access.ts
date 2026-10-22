import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';
import { isNeonBackend } from '@/lib/neon/db';
import { neonSessionUser } from '@/lib/neon/auth';
import { linkedNeonIdentity } from '@/lib/neon/identity';
import { legacySupabaseUnavailable } from '@/lib/neon/legacy-guard';

export const memberAccess = cache(async function memberAccess() {
  if (isNeonBackend()) {
    const authUser = await neonSessionUser();
    const identity = await linkedNeonIdentity(authUser);
    return {
      supabase: legacySupabaseUnavailable(),
      user: authUser
        ? {
            id: identity?.profileId || authUser.id,
            email: authUser.email,
          }
        : null,
      entitled: identity?.entitled === true,
      editor: identity?.role === 'owner' || identity?.role === 'editor',
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    return { supabase, user: null, entitled: false, editor: false };
  const [{ data: profile }, { data: entitled }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.rpc('has_article_access'),
  ]);
  return {
    supabase,
    user,
    entitled: entitled === true,
    editor: ['owner', 'editor'].includes(profile?.role),
  };
});

import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';

export const memberAccess = cache(async function memberAccess() {
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

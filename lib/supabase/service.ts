import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function storageService() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Storage配信のサーバー設定が未完了です');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

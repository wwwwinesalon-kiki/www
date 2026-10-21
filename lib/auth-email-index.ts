import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Read Auth identities server-side so profiles never need a second email copy. */
export async function readAuthEmailIndex(db: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  let read = 0;
  const perPage = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error || !Array.isArray(data?.users)) throw new Error('auth_users_read_failed');
    for (const user of data.users) {
      if (user.email) emails.add(user.email.trim().toLowerCase());
    }
    read += data.users.length;
    if (data.users.length === 0 || (data.total > 0 && read >= data.total)) return emails;
    // nextPage is supplied by GoTrue even when the server caps perPage below 1000.
    if (data.nextPage === null && data.users.length < perPage) {
      if (data.total > read) throw new Error('auth_users_pagination_incomplete');
      return emails;
    }
  }
  // Never send an invitation if duplicate-email detection may be incomplete.
  throw new Error('auth_users_limit');
}

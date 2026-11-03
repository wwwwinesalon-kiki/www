import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';
import { cache } from 'react';

type NeonAuthServer = ReturnType<typeof createNeonAuth>;

let authServer: NeonAuthServer | undefined;

/** Neon Auth is configured only when the staged backend is selected. */
export function getNeonAuth(): NeonAuthServer {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) {
    throw new Error('Neon Auth の設定が不足しています');
  }
  if (!authServer) {
    authServer = createNeonAuth({
      baseUrl,
      cookies: { secret, sessionDataTtl: 60 },
    });
  }
  return authServer;
}

// React cache is limited to a server render; authentication is never shared
// between users or persisted beyond the request.
export const neonSessionUser = cache(async function neonSessionUser() {
  const result = await getNeonAuth().getSession();
  if (result.error || !result.data?.user) return null;
  return result.data.user;
});

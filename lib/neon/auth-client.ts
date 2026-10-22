'use client';

import { createAuthClient } from '@neondatabase/auth/next';

/** Requests use the same-origin /api/auth proxy, so no auth URL enters the browser. */
export const neonAuthClient = createAuthClient();

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { isNeonBackend } from '@/lib/neon/db';
import { getNeonAuth } from '@/lib/neon/auth';

export async function proxy(request: NextRequest) {
  // Page/API guards still perform the authoritative role and entitlement
  // checks. Neon middleware refreshes cookies only on protected pages.
  const path = request.nextUrl.pathname;
  const protectedPage =
    path === '/admin' ||
    path.startsWith('/admin/') ||
    ((path === '/member' || path.startsWith('/member/')) &&
      ![
        '/member/login',
        '/member/register',
        '/member/verify',
        '/member/reset',
        '/member/setup',
        '/member/auth',
      ].includes(path));
  const response = isNeonBackend()
    ? protectedPage
      ? await getNeonAuth().middleware({ loginUrl: '/member/login' })(request)
      : NextResponse.next({ request })
    : await updateSession(request);
  if (
    /^\/(member|admin|api\/member|api\/admin|api\/media)(\/|$)/.test(
      request.nextUrl.pathname,
    )
  ) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

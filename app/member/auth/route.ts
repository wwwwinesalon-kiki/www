import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/article';
import { isNeonBackend } from '@/lib/neon/db';
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (isNeonBackend()) {
    return NextResponse.redirect(
      new URL('/member/login?error=link', url.origin),
    );
  }
  const supabase = await createClient();
  const code = url.searchParams.get('code');
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (token_hash && (type === 'invite' || type === 'recovery')) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    ok = !error;
  }
  const next =
    url.searchParams.get('next') === '/member/setup'
      ? '/member/setup'
      : safeNext(url.searchParams.get('next'));
  const response = NextResponse.redirect(
    new URL(
      ok ? next : '/member/login?error=link',
      process.env.NEXT_PUBLIC_SITE_URL || url.origin,
    ),
  );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

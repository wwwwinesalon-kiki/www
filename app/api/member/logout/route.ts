import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isNeonBackend } from '@/lib/neon/db';
import { getNeonAuth } from '@/lib/neon/auth';
export async function POST(req: Request) {
  if (isNeonBackend()) await getNeonAuth().signOut();
  else await (await createClient()).auth.signOut();
  const res = NextResponse.redirect(new URL('/member/login', req.url), 303);
  return res;
}

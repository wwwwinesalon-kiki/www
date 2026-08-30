import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL('/member/login', req.url), 303);
  return res;
}

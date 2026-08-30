import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/member/login', req.url), 303);
  res.cookies.set('www_member', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/member',
    maxAge: 0,
  });
  return res;
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/article';
import { isNeonBackend } from '@/lib/neon/db';
import { neonSessionUser } from '@/lib/neon/auth';
export const dynamic = 'force-dynamic';
export default async function ProtectedMemberLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ path?: string[] }>;
}) {
  const user = isNeonBackend()
    ? await neonSessionUser()
    : (await (await createClient()).auth.getUser()).data.user;
  if (!user) {
    const { path = [] } = await params;
    redirect(
      '/member/login?next=' +
        encodeURIComponent(
          safeNext('/member/' + path.map(encodeURIComponent).join('/')),
        ),
    );
  }
  return children;
}

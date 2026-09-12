import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/article';
export const dynamic = 'force-dynamic';
export default async function ProtectedMemberLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ path?: string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

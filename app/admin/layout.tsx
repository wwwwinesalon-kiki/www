import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isNeonBackend } from '@/lib/neon/db';
import { neonSessionUser } from '@/lib/neon/auth';
import { linkedNeonIdentity } from '@/lib/neon/identity';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isNeonBackend()) {
    const user = await neonSessionUser();
    if (!user) redirect('/member/login?next=/admin');
    const identity = await linkedNeonIdentity(user);
    if (!identity || !['owner', 'editor', 'viewer'].includes(identity.role))
      return (
        <main className="access-denied">
          <h1>Access denied</h1>
          <p>このアカウントには管理画面の権限がありません</p>
        </main>
      );
    return children;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/member/login?next=/admin');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['owner', 'editor', 'viewer'].includes(profile.role))
    return (
      <main className="access-denied">
        <h1>Access denied</h1>
        <p>このアカウントには管理画面の権限がありません</p>
      </main>
    );
  return children;
}

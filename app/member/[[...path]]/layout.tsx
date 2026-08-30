import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function ProtectedMemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/member/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();
  if (!profile || profile.status !== 'active')
    redirect('/member/login?status=pending');
  return children;
}

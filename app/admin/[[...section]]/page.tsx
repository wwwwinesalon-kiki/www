import type { Metadata } from 'next';
import AdminDashboard from '@/components/admin-dashboard';
import ArticleAdmin from '@/components/article-admin';
import { createClient } from '@/lib/supabase/server';
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id || '')
    .single();
  if (section?.[0] === 'events' || section?.[0] === 'applications')
    return <AdminDashboard section={section[0]} />;
  return (
    <ArticleAdmin
      id={section?.[0] === 'contents' ? section[1] : undefined}
      canEdit={['owner', 'editor'].includes(profile?.role)}
    />
  );
}

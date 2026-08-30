import type { Metadata } from 'next';
import AdminDashboard from '@/components/admin-dashboard';
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
  return <AdminDashboard section={section?.[0] || ''} />;
}

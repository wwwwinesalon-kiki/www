import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KaihipayControl from '@/components/kaihipay-control';
import { isNeonBackend } from '@/lib/neon/db';
import { linkedNeonIdentity } from '@/lib/neon/identity';

export const metadata:Metadata={title:'会費ペイ連携 | WWW 管理',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function KaihipayAdmin() {
  if (isNeonBackend()) {
    const identity = await linkedNeonIdentity();
    if (!identity) redirect('/member/login');
    if (identity.role !== 'owner') return <main><h1>アクセスできません</h1></main>;
    return <KaihipayControl />;
  }
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect('/member/login');
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();
  if (profile?.role!=='owner') return <main><h1>アクセスできません</h1></main>;
  return <KaihipayControl />;
}

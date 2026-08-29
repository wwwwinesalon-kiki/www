import {cookies} from 'next/headers';import {redirect} from 'next/navigation';import {verifyMemberSession} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function ProtectedMemberLayout({children}:{children:React.ReactNode}){const jar=await cookies();const valid=await verifyMemberSession(jar.get('www_member')?.value,process.env.MEMBER_SESSION_SECRET||'local-preview-secret-change-in-production',process.env.MEMBER_SESSION_VERSION||'1');if(!valid)redirect('/member/login');return children}

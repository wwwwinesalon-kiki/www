import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import MemberVerifyForm from '@/components/member-verify-form';
import { isNeonBackend } from '@/lib/neon/db';

export const metadata: Metadata = {
  title: 'メールアドレスの確認',
  robots: { index: false, follow: false },
};

export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  if (!isNeonBackend()) redirect('/member/login');
  const { email } = await searchParams;
  return (
    <main className="login-page">
      <div className="login-box">
        <p className="eyebrow">MEMBERS ONLY</p>
        <h1>メールアドレスの確認</h1>
        <p>登録したメールに届いた6桁のコードを入力してください</p>
        <MemberVerifyForm initialEmail={email ?? ''} />
        <p>コードの有効期限は10分です 期限切れの場合は再送信してください</p>
        <Link href="/member/login">ログインへ戻る</Link>
      </div>
    </main>
  );
}

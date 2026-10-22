import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import MemberRegisterForm from '@/components/member-register-form';
import { isNeonBackend } from '@/lib/neon/db';

export const metadata: Metadata = {
  title: 'Member Registration',
  robots: { index: false, follow: false },
};

export default function Register() {
  if (!isNeonBackend()) redirect('/member/login');
  return (
    <main className="login-page">
      <div className="login-box">
        <p className="eyebrow">MEMBERS ONLY</p>
        <h1>会員アカウントの作成</h1>
        <p>会費ペイで登録したメールアドレスを入力してください</p>
        <MemberRegisterForm />
        <p>お支払いの確認とメール認証が完了するまで会員記事は閲覧できません</p>
        <Link href="/member/login">ログインへ戻る</Link>
      </div>
    </main>
  );
}

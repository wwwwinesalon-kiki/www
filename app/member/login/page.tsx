import type { Metadata } from 'next';
import Link from 'next/link';
import MemberLoginForm from '@/components/member-login-form';
import { safeNext } from '@/lib/article';
export const metadata: Metadata = {
  title: 'Member Login',
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="login-page">
      <Link href="/" className="brand">
        <span>WWW</span>
        <small>WINE WELCOME WORLD</small>
      </Link>
      <div className="login-box">
        <p className="eyebrow">MEMBERS ONLY</p>
        <h1>おかえりなさい</h1>
        <p>ワインの楽しみ方が広がる読みものへ</p>
        {query.error && (
          <p role="alert">
            案内リンクが無効か期限切れです 再設定メールをお申し込みください
          </p>
        )}
        <MemberLoginForm next={safeNext(query.next)} />
        <p>
          <Link href="/member/reset">パスワードを忘れた方</Link>
        </p>
        <p>初めての方は 入会後に届く初回設定メールをご確認ください</p>
        <p>
          <a href="https://lin.ee/xWYPyBv">
            入会・初回案内のお問い合わせは公式LINEへ
          </a>
        </p>
      </div>
    </main>
  );
}

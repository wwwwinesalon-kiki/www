import MemberLoginForm from '@/components/member-login-form';
import Link from 'next/link';
export default function Reset() {
  return (
    <main className="login-page">
      <div className="login-box">
        <h1>パスワードの再設定</h1>
        <p>入会時に登録したメールアドレスへ案内を送ります</p>
        <MemberLoginForm reset />
        <Link href="/member/login">ログインへ戻る</Link>
      </div>
    </main>
  );
}

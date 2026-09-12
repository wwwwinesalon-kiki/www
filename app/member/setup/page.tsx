import { createClient } from '@/lib/supabase/server';
import PasswordSetup from '@/components/password-setup';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function Setup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="login-page">
      <div className="login-box">
        <h1>初回設定・パスワード設定</h1>
        {user ? (
          <>
            <p>メールの本人確認が完了しました パスワードを設定してください</p>
            <PasswordSetup />
          </>
        ) : (
          <>
            <p>初回案内または再設定メールのリンクからお進みください</p>
            <Link href="/member/reset">再設定メールを申し込む</Link>
          </>
        )}
      </div>
    </main>
  );
}

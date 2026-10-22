import { createClient } from '@/lib/supabase/server';
import PasswordSetup from '@/components/password-setup';
import Link from 'next/link';
import { isNeonBackend } from '@/lib/neon/db';
export const dynamic = 'force-dynamic';
export default async function Setup({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const neon = isNeonBackend();
  const token = neon ? (await searchParams).token : undefined;
  const user = neon
    ? null
    : (await (await createClient()).auth.getUser()).data.user;
  return (
    <main className="login-page">
      <div className="login-box">
        <h1>初回設定・パスワード設定</h1>
        {(neon ? Boolean(token) : Boolean(user)) ? (
          <>
            <p>
              {neon
                ? '案内リンクから新しいパスワードを設定してください'
                : 'メールの本人確認が完了しました パスワードを設定してください'}
            </p>
            <PasswordSetup
              provider={neon ? 'neon' : 'supabase'}
              token={token}
            />
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

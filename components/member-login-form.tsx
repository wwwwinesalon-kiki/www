'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { safeNext } from '@/lib/article';
export default function MemberLoginForm({
  next = '/member',
  reset = false,
}: {
  next?: string;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <form
      className="login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        const form = new FormData(e.currentTarget);
        try {
          const supabase = createClient();
          const emailField = form.get('email');
          const passwordField = form.get('password');
          const email = typeof emailField === 'string' ? emailField : '';
          if (reset) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: location.origin + '/member/auth?next=/member/setup',
            });
            if (error) throw error;
            setMessage(
              '登録済みの場合は再設定の案内を送信します メールをご確認ください',
            );
          } else {
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password: typeof passwordField === 'string' ? passwordField : '',
            });
            if (error) throw error;
            location.assign(safeNext(next));
          }
        } catch {
          setMessage(
            reset
              ? '送信できませんでした 少し待って再試行してください'
              : 'ログインできませんでした メール確認とパスワードをご確認ください',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="email">メールアドレス</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      {!reset && (
        <>
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </>
      )}
      <button className="button" disabled={busy}>
        {busy ? '確認中…' : reset ? '再設定メールを送る' : 'ログイン'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

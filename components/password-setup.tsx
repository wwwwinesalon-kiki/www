'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { neonAuthClient } from '@/lib/neon/auth-client';
export default function PasswordSetup({
  provider = 'supabase',
  token,
}: {
  provider?: 'supabase' | 'neon';
  token?: string;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const passwordField = data.get('password');
        const password = typeof passwordField === 'string' ? passwordField : '';
        if (password !== data.get('confirmation'))
          return setMessage('確認用パスワードが一致しません');
        setBusy(true);
        try {
          if (provider === 'neon' && !token)
            throw new Error('Password reset token is missing');
          const { error } =
            provider === 'neon'
              ? await neonAuthClient.resetPassword({
                  newPassword: password,
                  token: token!,
                })
              : await createClient().auth.updateUser({ password });
          if (error) throw error;
          location.assign(provider === 'neon' ? '/member/login' : '/member');
        } catch {
          setMessage(
            '設定できませんでした 案内メールを開き直すか 再設定をお試しください',
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="password">新しいパスワード</label>
      <input
        id="password"
        name="password"
        type="password"
        minLength={12}
        required
        autoComplete="new-password"
      />
      <label htmlFor="confirmation">確認用パスワード</label>
      <input
        id="confirmation"
        name="confirmation"
        type="password"
        minLength={12}
        required
        autoComplete="new-password"
      />
      <p>12文字以上で設定してください</p>
      <button className="button" disabled={busy}>
        パスワードを設定する
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}

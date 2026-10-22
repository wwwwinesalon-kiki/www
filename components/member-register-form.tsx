'use client';

import { useState } from 'react';
import { neonAuthClient } from '@/lib/neon/auth-client';

export default function MemberRegisterForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  return (
    <form
      className="login-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setMessage('');
        const data = new FormData(event.currentTarget);
        const emailField = data.get('email');
        const passwordField = data.get('password');
        const email =
          typeof emailField === 'string' ? emailField.trim().toLowerCase() : '';
        const password = typeof passwordField === 'string' ? passwordField : '';
        if (password !== data.get('confirmation')) {
          setMessage('確認用パスワードが一致しません');
          return;
        }
        setBusy(true);
        try {
          const { error } = await neonAuthClient.signUp.email({
            name: 'WWW会員',
            email,
            password,
            callbackURL: new URL('/member/login', location.origin).toString(),
          });
          if (error) throw error;
          setComplete(true);
          setMessage(
            '確認メールをご確認ください メール認証後にログインできます',
          );
        } catch {
          setMessage('登録できませんでした 内容を確認して再試行してください');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="register-email">メールアドレス</label>
      <input
        id="register-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        disabled={busy || complete}
      />
      <label htmlFor="register-password">パスワード</label>
      <input
        id="register-password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        disabled={busy || complete}
      />
      <label htmlFor="register-confirmation">確認用パスワード</label>
      <input
        id="register-confirmation"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        disabled={busy || complete}
      />
      <p>12文字以上で設定してください</p>
      {!complete && (
        <button className="button" disabled={busy}>
          {busy ? '登録中…' : 'アカウントを作成'}
        </button>
      )}
      {message && <p role={complete ? 'status' : 'alert'}>{message}</p>}
    </form>
  );
}

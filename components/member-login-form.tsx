'use client';
import { useState } from 'react';
export default function MemberLoginForm() {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  return (
    <form
      className="login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('loading');
        const form = new FormData(e.currentTarget);
        const res = await fetch('/api/member/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: form.get('password') }),
        });
        if (res.ok) location.href = '/member';
        else setState('error');
      }}
    >
      <label htmlFor="password">Member Password</label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="current-password"
        placeholder="パスワードを入力"
      />
      <button className="button" disabled={state === 'loading'}>
        {state === 'loading' ? '確認中…' : 'ログイン'}
      </button>
      {state === 'error' && (
        <p role="alert">
          パスワードを確認してください。入力内容は保持されています。
        </p>
      )}
    </form>
  );
}

'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function MemberLoginForm() {
  const [state, setState] = useState<
    'idle' | 'loading' | 'error' | 'registered'
  >('idle');
  const [register, setRegister] = useState(false);
  return (
    <form
      className="login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('loading');
        const form = new FormData(e.currentTarget);
        const supabase = createClient();
        const email = form.get('email');
        const password = form.get('password');
        if (typeof email !== 'string' || typeof password !== 'string')
          return setState('error');
        const name = form.get('name');
        const { error } = register
          ? await supabase.auth.signUp({
              email,
              password,
              options: { data: { name: typeof name === 'string' ? name : '' } },
            })
          : await supabase.auth.signInWithPassword({ email, password });
        if (error) return setState('error');
        if (register) return setState('registered');
        location.href = '/member';
      }}
    >
      {register && (
        <>
          <label htmlFor="name">お名前</label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder="お名前"
          />
        </>
      )}
      <label htmlFor="email">メールアドレス</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="登録したメールアドレス"
      />
      <label htmlFor="password">パスワード</label>
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
        {state === 'loading' ? '確認中…' : register ? '会員登録' : 'ログイン'}
      </button>
      {state === 'error' && (
        <p role="alert">メールアドレスまたはパスワードを確認してください</p>
      )}
      {state === 'registered' && (
        <output>
          登録を受け付けました　メール確認と運営の承認後にログインできます
        </output>
      )}
      <button
        className="plain-action"
        type="button"
        onClick={() => {
          setRegister(!register);
          setState('idle');
        }}
      >
        {register ? 'ログインへ戻る' : '初めての方はこちら'}
      </button>
    </form>
  );
}

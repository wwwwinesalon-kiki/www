'use client';

import { useState } from 'react';
import Link from 'next/link';
import { neonAuthClient } from '@/lib/neon/auth-client';

export default function MemberVerifyForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');

  const normalizedEmail = email.trim().toLowerCase();

  return (
    <form
      className="login-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!/^\d{6}$/.test(otp)) {
          setMessage('6桁の数字を入力してください');
          return;
        }
        setBusy(true);
        setMessage('');
        try {
          const { error } = await neonAuthClient.emailOtp.verifyEmail({
            email: normalizedEmail,
            otp,
          });
          if (error) throw error;
          setVerified(true);
          setOtp('');
          setMessage('メールアドレスを確認しました ログインしてください');
        } catch {
          setMessage('確認できませんでした コードの有効期限と入力内容をご確認ください');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="verify-email">登録したメールアドレス</label>
      <input
        id="verify-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        disabled={busy || verified}
      />
      {!verified && (
        <>
          <label htmlFor="verify-otp">メールに届いた6桁の確認コード</label>
          <input
            id="verify-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            disabled={busy}
          />
          <button className="button" disabled={busy}>
            {busy ? '確認中…' : 'メールアドレスを確認'}
          </button>
          <button
            type="button"
            disabled={busy || !normalizedEmail}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                const { error } = await neonAuthClient.emailOtp.sendVerificationOtp({
                  email: normalizedEmail,
                  type: 'email-verification',
                });
                if (error) throw error;
                setMessage('新しい確認コードを送信しました メールをご確認ください');
              } catch {
                setMessage('送信できませんでした 少し待って再試行してください');
              } finally {
                setBusy(false);
              }
            }}
          >
            コードを再送信
          </button>
        </>
      )}
      {verified && <Link href="/member/login">ログインへ進む</Link>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}

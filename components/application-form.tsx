'use client';
import { useState } from 'react';
export default function ApplicationForm({ eventId }: { eventId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>(
    'idle',
  );
  return (
    <form
      className="application-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending');
        const data = Object.fromEntries(new FormData(e.currentTarget));
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...data, eventId }),
        });
        if (res.ok) {
          const sessionId =
            localStorage.getItem('www_anonymous_session') ||
            crypto.randomUUID();
          void fetch('/api/analytics', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              eventType: 'event_apply',
              sessionId,
              path: location.pathname,
              entityId: eventId,
            }),
          });
        }
        setState(res.ok ? 'success' : 'error');
      }}
    >
      <h2>参加を申し込む</h2>
      <label>
        お名前
        <input name="name" required />
      </label>
      <label>
        メールアドレス
        <input name="email" type="email" required />
      </label>
      <label>
        LINE表示名
        <input name="lineName" />
      </label>
      <button className="button" disabled={state === 'sending'}>
        {state === 'sending' ? '送信中…' : 'このイベントに申し込む'}
      </button>
      {state === 'success' && (
        <output className="form-success">お申し込みを受け付けました</output>
      )}
      {state === 'error' && (
        <p className="form-error" role="alert">
          送信できませんでした内容は保持されていますもう一度お試しください
        </p>
      )}
    </form>
  );
}

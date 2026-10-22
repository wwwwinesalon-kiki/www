'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Course = { id: number; name: string; billingType: string };
type Issues = {
  invitations: { memberId: string; status: string }[];
  sync: { memberId: string }[];
};

async function readIssues(signal?: AbortSignal): Promise<Issues> {
  const response = await fetch('/api/admin/kaihipay/issues', {
    cache: 'no-store', signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '処理状況を取得できませんでした');
  return data as Issues;
}

export default function KaihipayControl() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [issues, setIssues] = useState<Issues | null>(null);
  const [issuesError, setIssuesError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void readIssues(controller.signal)
      .then((data) => setIssues(data))
      .catch((error) => {
        if (!controller.signal.aborted)
          setIssuesError(error instanceof Error ? error.message : '処理状況を取得できませんでした');
      });
    return () => controller.abort();
  }, []);

  async function refreshIssues() {
    try {
      setIssues(await readIssues());
      setIssuesError('');
    } catch (error) {
      setIssuesError(error instanceof Error ? error.message : '処理状況を取得できませんでした');
    }
  }

  async function run(path: string) {
    setBusy(true);
    setMessage('確認中です');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '実行できませんでした');
      if (Array.isArray(data.courses)) {
        setCourses(data.courses);
        setMessage('コース一覧を取得しました');
      } else {
        setMessage(
          `確認対象 ${data.scanned}件 更新 ${data.updated}件 要確認 ${data.review}件`,
        );
        await refreshIssues();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '実行できませんでした',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="kaihipay-admin">
      <header className="kaihipay-admin-header">
        <Link href="/admin" className="kaihipay-admin-brand">WWW</Link>
        <nav aria-label="管理メニュー">
          <Link href="/admin">記事</Link>
          <Link href="/admin/events">イベント</Link>
          <Link href="/admin/applications">申込</Link>
          <span aria-current="page">会費ペイ</span>
        </nav>
        <Link href="/member" className="kaihipay-admin-member">会員サイト ↗</Link>
      </header>
      <div className="kaihipay-admin-content">
        <div className="kaihipay-admin-toolbar">
          <h1>会費ペイ連携</h1>
          <div className="kaihipay-admin-actions">
            <Link href="/member/login">ログイン画面 ↗</Link>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    new URL('/member/login', location.origin).toString(),
                  );
                  setMessage('ログインURLをコピーしました');
                } catch {
                  setMessage('コピーできませんでした');
                }
              }}
            >
              URLをコピー
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run('/api/admin/kaihipay/check')}
            >
              接続確認
            </button>
            <button
              type="button"
              className="kaihipay-admin-primary"
              disabled={busy}
              onClick={() => void run('/api/admin/kaihipay/sync')}
            >
              入金同期
            </button>
          </div>
        </div>
        <output className="kaihipay-admin-status">{message}</output>
        {courses.length > 0 && (
          <ul className="kaihipay-admin-courses">
            {courses.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span>{c.billingType}</span>
                <code>ID {c.id}</code>
              </li>
            ))}
          </ul>
        )}
        <section className="kaihipay-admin-issues" aria-labelledby="kaihipay-issues-title">
          <div className="kaihipay-admin-issues-heading">
            <h2 id="kaihipay-issues-title">要確認</h2>
            <button type="button" disabled={busy} onClick={() => void refreshIssues()}>更新</button>
          </div>
          {issuesError && <p role="alert">{issuesError}</p>}
          {issues && issues.invitations.length === 0 && issues.sync.length === 0 &&
            <p>現在 要確認の処理はありません</p>}
          {issues && (issues.invitations.length > 0 || issues.sync.length > 0) && (
            <>
              <p>会員番号を会費ペイで照合してください 招待結果が不明な場合は自動再送しません</p>
              <ul>
                {issues.invitations.map((item) => (
                  <li key={`invite-${item.memberId}`}>
                    <span>招待 {item.status === 'sending' ? '送信確認中' : '要確認'}</span>
                    <code>会員番号 {item.memberId}</code>
                  </li>
                ))}
                {issues.sync.map((item) => (
                  <li key={`sync-${item.memberId}`}>
                    <span>同期 要確認</span>
                    <code>会員番号 {item.memberId}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

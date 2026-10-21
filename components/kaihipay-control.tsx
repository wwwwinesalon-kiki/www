'use client';
import { useState } from 'react';
import Link from 'next/link';

type Course = { id: number; name: string; billingType: string };
export default function KaihipayControl() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
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
      </div>
    </main>
  );
}

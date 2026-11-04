'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import KaihipayManagementLinks from '@/components/kaihipay-management-links';
import '@/app/kaihipay-connection.css';

type Course = { id: number; name: string; billingType: string; recurringFee: number | null };
type ConnectionReport = {
  configuration: { checks: { key: string; configured: boolean }[]; missing: string[]; settingsReady: boolean };
  courseVerification: 'not_checked' | 'matched' | 'mismatch' | 'missing_configuration' | 'incomplete_course_list' | 'failed';
  canAttemptSync: boolean;
  tokenAutomation?: { configured: boolean; initialized: boolean; expiresAt: string | null; refreshedAt: string | null; error: string | null };
};
const settingLabels: Record<string, string> = {
  BACKEND_PROVIDER: '保存先の設定', NEON_DATABASE_URL: 'データベース',
  KAIHIPAY_API_TOKEN: '会費ペイAPIトークン', KAIHIPAY_EMAIL_HMAC_SECRET: 'メール照合用の秘密設定',
  KAIHIPAY_MEMBERSHIP_COURSE_ID: '月会費のコースID', KAIHIPAY_EXPECTED_RECURRING_FEE_YEN: '月会費の継続課金額',
  CRON_SECRET: '定期同期用の秘密設定',
};
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
  const [connection, setConnection] = useState<ConnectionReport | null>(null);
  const [connectionError, setConnectionError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/kaihipay/check', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('接続設定を取得できませんでした');
        return response.json() as Promise<ConnectionReport>;
      })
      .then(setConnection)
      .catch(error => {
        if (!controller.signal.aborted) setConnectionError(error instanceof Error ? error.message : '接続設定を取得できませんでした');
      });
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
      if (data.configuration) {
        setConnection(data as ConnectionReport);
        setConnectionError('');
      }
      if (!response.ok) throw new Error(data.error || '実行できませんでした');
      if (Array.isArray(data.courses)) {
        setCourses(data.courses);
        setMessage(data.canAttemptSync ? '接続と月会費コースの照合が完了しました' : '会費ペイへ接続できました 不足設定と月会費コースを確認してください');
      } else {
        setMessage(
          `確認対象 ${data.scanned}件 更新 ${data.updated}件 要確認 ${data.review}件`,
        );
        await refreshIssues();
      }
    } catch (error) {
      if (path.endsWith('/check')) setCourses([]);
      if (path.endsWith('/sync')) setConnection(previous => previous ? { ...previous, canAttemptSync: false } : previous);
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
        <KaihipayManagementLinks />
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
              disabled={busy || !connection?.canAttemptSync}
              onClick={() => void run('/api/admin/kaihipay/sync')}
            >
              入金同期
            </button>
          </div>
        </div>
        <output className="kaihipay-admin-status">{message}</output>
        <section className="kaihipay-connection" aria-label="接続設定">
          <div className="kaihipay-connection-heading">
            <h2>接続設定</h2>
            <span>{connection?.canAttemptSync ? 'コース照合済み' : connection?.courseVerification === 'failed' ? '接続を確認できません' : connection?.configuration.missing.length ? '設定待ち' : '接続確認待ち'}</span>
          </div>
          {connectionError && <p role="alert">{connectionError}</p>}
          {!connection && !connectionError && <p>設定を確認中…</p>}
          {connection && <ul>{connection.configuration.checks.map(check => (
            <li key={check.key}>
              <span>{settingLabels[check.key] || check.key}</span>
              <strong className={check.configured ? 'is-configured' : ''}>{check.configured ? '設定済み' : '未設定・要確認'}</strong>
              {!check.configured && <code>{check.key}</code>}
            </li>
          ))}</ul>}
          {connection?.courseVerification === 'mismatch' && <p role="alert">設定したコースID・コース名・継続課金額が会費ペイの月会費コースと一致していません</p>}
          {connection?.courseVerification === 'incomplete_course_list' && <p role="alert">コース一覧をすべて確認できていないため 同期は開始できません</p>}
          <p>接続確認で月会費コースを照合してから入金同期を実行できます 接続確認で請求は発生しません</p>
        </section>
        <section className="kaihipay-connection" aria-label="APIトークンの自動更新">
          <div className="kaihipay-connection-heading"><h2>APIトークンの自動更新</h2>
            <span>{connection?.tokenAutomation?.configured ? connection.tokenAutomation.initialized ? '設定済み' : '初回接続待ち' : '初回設定待ち'}</span>
          </div>
          {connection?.tokenAutomation?.configured ? <>
            <p>期限の3日前から自動更新します</p>
            {connection.tokenAutomation.expiresAt && <p>自動更新の管理期限 {new Date(connection.tokenAutomation.expiresAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）</p>}
            {connection.tokenAutomation.error && <p role="alert">更新を確認できません API連携用の認証情報を確認してください</p>}
          </> : <p>Netlifyの秘密設定へ KAIHIPAY_API_EMAIL と KAIHIPAY_API_PASSWORD を登録すると有効になります 会費ペイの「API連携」で設定したメールアドレスとパスワードを使用します</p>}
        </section>
        {courses.length > 0 && (
          <ul className="kaihipay-admin-courses">
            {courses.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span>{c.billingType}</span>
                <span>継続課金額（API） {c.recurringFee === null ? '確認できません' : c.recurringFee.toLocaleString('ja-JP') + '円'}</span>
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

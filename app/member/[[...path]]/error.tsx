'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="article-shell">
      <h1>記事を読み込めませんでした</h1>
      <p>通信状況を確認して再試行してください</p>
      <button onClick={reset}>再試行</button>
    </main>
  );
}

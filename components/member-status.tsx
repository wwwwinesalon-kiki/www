import Link from 'next/link';
export default function MemberStatus() {
  return (
    <section className="article-shell">
      <h1>ご利用状況の確認が必要です</h1>
      <p>ログインは完了していますが 記事の閲覧資格を確認できません</p>
      <p>
        入会手続きがお済みの場合は 初回案内の確認
        または公式LINEへお問い合わせください
      </p>
      <a className="button" href="https://lin.ee/xWYPyBv">
        公式LINEで確認する
      </a>
      <p>
        <Link href="/member/account">アカウントの案内</Link>
      </p>
      <form action="/api/member/logout" method="post">
        <button>ログアウト</button>
      </form>
    </section>
  );
}

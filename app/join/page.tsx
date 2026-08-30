import { SiteHeader, SiteFooter } from '@/components/site-chrome';
export default function Join() {
  return (
    <>
      <SiteHeader />
      <main className="join-page">
        <p className="eyebrow">JOIN WWW</p>
        <h1>
          次の一杯を、
          <br />
          新しい出会いと。
        </h1>
        <p>
          まずは公式LINEを追加してください。活動のご案内と、会費ペイでの入会手続きをお送りします。
        </p>
        <a className="button" href={process.env.LINE_JOIN_URL || '#'}>
          LINEでWWWを追加する
        </a>
        <ol>
          <li>
            <b>01</b>公式LINEを追加
          </li>
          <li>
            <b>02</b>会費ペイで手続き
          </li>
          <li>
            <b>03</b>Member Siteへ
          </li>
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}

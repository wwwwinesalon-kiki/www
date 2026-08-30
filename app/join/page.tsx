import { SiteHeader, SiteFooter } from '@/components/site-chrome';
export default function Join() {
  return (
    <>
      <SiteHeader />
      <main className="join-page">
        <p className="eyebrow">JOIN WWW</p>
        <h1>
          次の一杯を
          <br />
          新しい出会いと
        </h1>
        <p>
          まずは公式LINEを追加してください<br />活動のご案内と入会手続きをお送りします
        </p>
        <a
          className="line-cta line-cta-inline"
          href="https://lin.ee/xWYPyBv"
        >
          <span className="line-cta-mark">LINE</span>
          <span className="line-cta-copy">
            <small>入会手続きはこちら</small>
            <strong>公式LINEを開く</strong>
          </span>
          <span className="line-cta-arrow">→</span>
        </a>
        <ol>
          <li>
            <b>01</b>公式LINEを追加
          </li>
          <li>
            <b>02</b>案内に沿って登録
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

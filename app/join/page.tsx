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
          月額3,300円（税込）でWWWのすべての体験へ
          <br />
          まずは公式LINEからお申し込みください
        </p>
        <a className="line-cta line-cta-inline" href="https://lin.ee/xWYPyBv">
          <span className="line-cta-mark">LINE</span>
          <span className="line-cta-copy">
            <small>入会手続きはこちら</small>
            <strong>公式LINEを開く</strong>
          </span>
          <span className="line-cta-arrow">→</span>
        </a>
        <ol>
          <li>
            <b>01</b>
            <span>
              公式LINEを追加<small>活動内容と入会方法をご案内します</small>
            </span>
          </li>
          <li>
            <b>02</b>
            <span>
              会員登録とお支払い
              <small>案内に沿って登録を完了してください</small>
            </span>
          </li>
          <li>
            <b>03</b>
            <span>
              Member Siteへ<small>確認後にログイン情報をお届けします</small>
            </span>
          </li>
        </ol>
        <section
          className="join-benefits"
          aria-labelledby="join-benefits-title"
        >
          <p className="eyebrow">MEMBERSHIP</p>
          <h2 id="join-benefits-title">会員になるとできること</h2>
          <div>
            <article>
              <strong>FIELD</strong>
              <p>余市の畑から写真と声をお届け</p>
            </article>
            <article>
              <strong>NOMIKAI</strong>
              <p>少人数のワイン勉強会へ参加</p>
            </article>
            <article>
              <strong>TABLE</strong>
              <p>日々の発行レシピ研究を読む</p>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

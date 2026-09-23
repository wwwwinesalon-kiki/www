import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { MEMBERSHIP_SIGNUP_URL, MEMBERSHIP_TOTAL_LABEL } from '@/lib/membership-policy';
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
          月額の支払総額は{MEMBERSHIP_TOTAL_LABEL}です
          <br />
          イベント参加費はすべて別料金です
        </p>
        <a className="line-cta line-cta-inline" href={MEMBERSHIP_SIGNUP_URL}>
          <span className="line-cta-mark">JOIN</span>
          <span className="line-cta-copy">
            <small>入会手続きはこちら</small>
            <strong>会員登録へ進む</strong>
          </span>
          <span className="line-cta-arrow">→</span>
        </a>
        <ol>
          <li>
            <b>01</b>
            <span>
              会員登録とお支払い<small>申込フォームで手続きを行います</small>
            </span>
          </li>
          <li>
            <b>02</b>
            <span>
              招待メールを確認
              <small>支払い確認後に会員サイトへご案内します</small>
            </span>
          </li>
          <li>
            <b>03</b>
            <span>
              Member Siteへ<small>ご自身でパスワードを設定してログインします</small>
            </span>
          </li>
        </ol>
        <p>記事はお支払い済みの会費の対象月末まで閲覧できます</p>
        <p>月末のご入会もその月の末日までです</p>
        <p><a href="https://lin.ee/xWYPyBv">お問い合わせは公式LINEへ</a></p>
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
              <p>会員限定のワイン勉強会に申込 参加費は別料金</p>
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

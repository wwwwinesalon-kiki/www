import LegalPage from '@/components/legal-page';
export default function Contact() {
  return (
    <LegalPage eyebrow="CONTACT" title="お問い合わせ">
      <h2>WWWへのご連絡</h2>
      <p>
        参加イベント会費ペイでのお支払い会員情報については公式LINEまたは運営メールへお問い合わせください
      </p>
      <p>
        <a
          className="line-cta line-cta-inline"
          href="https://lin.ee/xWYPyBv"
        >
          <span className="line-cta-mark">LINE</span>
          <span className="line-cta-copy">
            <small>お問い合わせはこちら</small>
            <strong>公式LINEを開く</strong>
          </span>
          <span className="line-cta-arrow">→</span>
        </a>
      </p>
      <p>
        <a href={`mailto:${process.env.CONTACT_EMAIL || 'harusanx@gmail.com'}`}>
          {process.env.CONTACT_EMAIL || 'harusanx@gmail.com'}
        </a>
      </p>
      <p className="legal-note">
        決済内容のお問い合わせではカード番号を送らず氏名・会費ペイに登録したメールアドレス・決済日をお知らせください
      </p>
    </LegalPage>
  );
}

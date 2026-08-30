import LegalPage from '@/components/legal-page';
export default function Contact() {
  return (
    <LegalPage eyebrow="CONTACT" title="お問い合わせ">
      <h2>WWWへのご連絡</h2>
      <p>
        参加、イベント、会費ペイでのお支払い、会員情報については、公式LINEまたは運営メールへお問い合わせください。
      </p>
      <p>
        <a className="button" href={process.env.LINE_JOIN_URL || '#'}>
          公式LINEを開く
        </a>
      </p>
      <p>
        <a href={`mailto:${process.env.CONTACT_EMAIL || 'harusanx@gmail.com'}`}>
          {process.env.CONTACT_EMAIL || 'harusanx@gmail.com'}
        </a>
      </p>
      <p className="legal-note">
        決済内容のお問い合わせでは、カード番号を送らず、氏名・会費ペイに登録したメールアドレス・決済日をお知らせください。
      </p>
    </LegalPage>
  );
}

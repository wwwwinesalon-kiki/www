import { SiteHeader, SiteFooter } from '@/components/site-chrome';
const faqs = [
  [
    'どんなコミュニティですか？',
    'ワインをきっかけに、つくる人・届ける人・楽しむ人がつながる女性中心のコミュニティです。',
  ],
  [
    'ワインに詳しくなくても参加できますか？',
    'もちろんです。知識よりも、知りたい・楽しみたい気持ちを大切にしています。',
  ],
  [
    '会費について教えてください。',
    '最新の会費と入会手続きはJOINページからご確認ください。',
  ],
];
export default function Faq() {
  return (
    <>
      <SiteHeader />
      <main className="public-page">
        <p className="eyebrow">FAQ</p>
        <h1>よくある質問</h1>
        <div className="faq-list">
          {faqs.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>
                {q}
                <span>＋</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

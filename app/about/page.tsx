import Image from 'next/image';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

const partners = [
  { name: 'ドメーヌモン', person: '山中敦生様', image: '/images/about/partners/domaine-mont.png', href: 'https://domainemont.com/', note: '余市の登地区でブドウと向き合い土地の個性を映すワインを造る生産者' },
  { name: '山田堂', person: '山田雄一様', image: '/images/about/partners/yamadado-new.png', href: 'https://yamadado.jp/', note: '日々の食卓に寄り添う上質なテーブルワインを目指す余市の小さなワイナリー' },
  { name: 'ドメーヌ・タカヒコ', person: '曽我貴彦様', image: '/images/about/partners/takahiko-new.png', href: 'https://www.takahiko.co.jp/', note: '余市の風土とピノ・ノワールの可能性を追い続けるワイナリー' },
  { name: 'たかまつとおる', person: 'Special Wine Partner', image: '/images/about/partners/takamatsu-new.png', href: 'https://www.town.yoichi.hokkaido.jp/sangyou/machidukuri/chiikiokoshikyouryokutaiR401.html', note: '世界で経験を重ね余市のワインと地域の魅力をつなぐマスターソムリエ' },
];

const experiences = ['ワイナリー訪問', '生産者との交流', '畑訪問', '収穫体験', 'FIELDツアー', '特別な食事会'];
const tableIdeas = ['ワイン×料理のペアリング', '簡単レシピ', '余市の旬×ワイン', '自分へのご褒美', 'ホームパーティー', 'シェフとのコラボレーション'];

export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="about-page">
        <section className="about-intro">
          <p className="eyebrow">ABOUT WWW</p>
          <h1>ワインの楽しみ方を<br />もっと自由に</h1>
          <div className="about-intro-grid">
            <div className="about-copy"><p>ワインはただ飲むだけではもったいない</p><p>生産者の思いや育った畑のこと料理と合わせる楽しさを知ると<br />いままでより何倍も何杯も楽しむことが出来ます</p><p>Wine Work Womenでは余市ワインを入口に<br /><strong>作り手・畑・食・人のつながりを感じられる一歩踏み込んだワインの楽しみ方</strong>を届けます</p></div>
            <Image src="/images/www/20260624/68.jpg" alt="ワインを楽しむグラス" width={1920} height={1280} priority />
          </div>
        </section>

        <section className="about-section about-people">
          <div className="about-section-head"><span>01</span><p>PEOPLE</p><h2>作り手を知る</h2></div>
          <div className="about-lead-grid"><Image src="/images/www/20260624/20.jpg" alt="余市ワインが並ぶ店内" width={1920} height={1280} /><div className="about-copy"><h3>このワインをつくった人に<br />会いたくなる</h3><p>ワインの味だけでは見えてこない作り手の考え方や日常ワインづくりへの想いを紹介します</p><p>プロフィールやインタビューに加えその人に関する最新の出来事やNEWSも蓄積<br />一本のワインの向こう側にいる「人」を知り自分が好きなワインを深掘りしていきましょう</p><ul><li>生産者プロフィール</li><li>10分インタビュー</li><li>ワインづくりへの考え方</li><li>最新NEWS</li><li>関連する畑・ワイン・イベントのご紹介</li></ul></div></div>
          <h3 className="partner-title">ご協力いただいている皆様</h3>
          <div className="partner-grid">{partners.map((partner) => <a className="partner-card" href={partner.href} target="_blank" rel="noreferrer" key={partner.name}><Image src={partner.image} alt={`${partner.name} ${partner.person}`} width={760} height={520} /><div><small>{partner.name}</small><h4>{partner.person}</h4><p>{partner.note}</p><span>公式情報を見る ↗</span></div></a>)}</div>
        </section>

        <section className="about-section"><div className="about-section-head"><span>02</span><p>NOMIKAI</p><h2>一緒に飲む</h2></div><div className="about-lead-grid reverse"><Image src="/images/www/20260624/5.jpg" alt="ワインを囲み乾杯する参加者" width={1920} height={1280} /><div className="about-copy"><h3>飲み会という名の<br />ワイン勉強会</h3><p>WWWは講義を聞くだけの勉強会ではありません</p><p>ワインを飲みながら「この香りって何だろう？」「どうしてこの味になるんだろう？」「この料理とはどう合わせる？」<br />そんな会話から自然にワインへの理解が深まっていく時間を目指します</p><p>少人数だからこそ作り手や参加者との距離も近く<br /><strong>学ぶために飲むのではなく楽しく飲み会していたら詳しくなっていた</strong></p><p>そんな場を目指します</p></div></div></section>

        <section className="about-section"><div className="about-section-head"><span>03</span><p>ACCESS</p><h2>現地に入る</h2></div><div className="about-lead-grid"><Image src="/images/www/20260624/9.jpg" alt="余市の現地で過ごすワインの時間" width={1920} height={1280} /><div className="about-copy"><h3>見るだけではなく<br />ワインの現場へ</h3><p>ワイナリー訪問畑への訪問収穫など通常は外に開かれていないリアルな圃場に立ち入る<br />貴重な体験を生産者の皆様ご協力の元実施しています</p><p><strong>余市をきっかけにワインを楽しみ尽くしてほしい</strong><br />そんなきっかけになることを目指しています</p><ul>{experiences.map((item) => <li key={item}>{item}</li>)}</ul><small>開催内容・定員は季節や生産者の状況によって変わります</small></div></div></section>

        <section className="about-section"><div className="about-section-head"><span>04</span><p>TABLE</p><h2>家で楽しむ</h2></div><div className="about-lead-grid reverse"><Image src="/images/www/20260624/24.jpg" alt="ワインに合わせた料理" width={1920} height={1280} /><div className="about-copy"><h3>ワインのある食卓を<br />もっと気軽に</h3><p>難しい知識がなくても家でワインをもっと楽しめるように</p><p>余市Café &amp; Barを営むオーナーKanaがワインとのペアリングにこだわった大人気レシピを随時公開</p><p>「季節の食材を使ったレシピ」「自分へのご褒美料理」「ホームパーティーのアイデア」などワイン専門レシピをご紹介</p><ul>{tableIdeas.map((item) => <li key={item}>{item}</li>)}</ul><p>「知った」で終わらず<br /><strong>実際に家でやってみるところまで</strong>がWWWです</p></div></div></section>

        <section className="about-section about-field"><div className="about-section-head"><span>05</span><p>FIELD</p><h2>畑の様子を覗く</h2></div><div className="about-lead-grid"><Image src="/images/about/field-2.jpg" alt="森に囲まれた余市のブドウ畑" width={482} height={323} /><div className="about-copy"><h3>畑の日常に触れる</h3><p>WWWではオーナーKanaが実際に余市の畑を訪れ<br />その日の畑の様子を随時更新</p><blockquote><small>FIELDの一次情報</small><strong>現地の写真×生産者へのヒアリング<br />×その場について語る音声</strong></blockquote><p>「余市に行ってみたい」と思える距離感をつくります</p></div></div></section>
      </main>
      <SiteFooter />
    </>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import PublicMenu from '@/components/public-menu';

const gallery = [
  ['/images/www/gathering.webp', 'ワインを囲むひととき', 'left'],
  ['/images/www/bottles.webp', 'つくり手のワイン', 'center'],
  ['/images/www/women.webp', '会話を楽しむ女性たち', 'center'],
  ['/images/www/gathering.webp', 'テーブルを囲む時間', 'center'],
  ['/images/www/women.webp', 'ワインがつなぐ出会い', 'right'],
  ['/images/www/gathering.webp', '料理とワイン', 'right'],
  ['/images/www/bottles.webp', '夜のワインバー', 'left'],
  ['/images/www/landscape.webp', 'WWWの物語', 'center'],
  ['/images/www/women.webp', '日常にある豊かさ', 'left'],
];

export const dynamic = 'force-dynamic';
export default function Home() {
  return (
    <main className="public-home">
      <PublicMenu />
      <section className="home-hero" aria-label="Wine Work Women">
        <Image
          src="/images/www/landscape.webp"
          alt="海辺の風景を描いた線画"
          width={1672}
          height={941}
          priority
        />
        <h1>WWW</h1>
      </section>
      <section className="home-story" aria-label="WWWのはじまり">
        <p>「最近飲むことが増えた」</p>
        <p>「もう少し深く知ってみたい」</p>
        <p>ワイン熱が上がってきた</p>
        <p>そんな女性の皆様に</p>
      </section>
      <section className="home-gallery" aria-label="WWWのギャラリー">
        {gallery.map(([src, alt, position], index) => (
          <Link
            href={index < 3 ? '/about' : index < 6 ? '/events' : '/news'}
            key={`${alt}-${index}`}
          >
            <Image
              src={src}
              alt={alt}
              width={600}
              height={420}
              style={{ objectPosition: position }}
            />
          </Link>
        ))}
      </section>
      <section className="home-concept">
        <p className="concept-kicker">WWW...?</p>
        <article>
          <Image
            src="/images/www/gathering.webp"
            alt="グラス越しのワイン会"
            width={900}
            height={600}
          />
          <div>
            <p className="concept-number">一</p>
            <h2>ワイン造りを知る</h2>
            <p>
              美味しいワインとは。想いが詰まった一本の向こうにある、土地や造り手の物語を訪ねます。
            </p>
          </div>
        </article>
        <article>
          <Image
            src="/images/www/bottles.webp"
            alt="並べられたワインボトル"
            width={900}
            height={600}
          />
          <div>
            <p className="concept-number">二</p>
            <h2>
              飲み会という名の
              <br />
              ワイン勉強会
            </h2>
            <p>
              料理と会話を囲みながら、香りや味わいの違いを気軽に楽しむ時間です。知識より、感じたことを大切に。
            </p>
          </div>
        </article>
        <article>
          <Image
            src="/images/www/women.webp"
            alt="ワインを囲んで語らう女性たち"
            width={900}
            height={600}
          />
          <div>
            <p className="concept-name">Wine Work Women</p>
            <h2>
              ワインから、
              <br />
              仕事と暮らしをつなぐ。
            </h2>
            <p>
              つくる人、届ける人、楽しむ人。WWWは、ワインをきっかけに女性たちの新しい出会いを育てるコミュニティです。
            </p>
          </div>
        </article>
        <Link href="/join" className="line-cta">
          <span>申込や詳細は</span>公式LINE
        </Link>
      </section>
    </main>
  );
}

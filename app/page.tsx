import Link from 'next/link';
import Image from 'next/image';
import PublicMenu from '@/components/public-menu';
import { publicEvents, visibleContents } from '@/lib/data';

const gallery = [
  ['/images/www/20260624/9.jpg', '石蔵の入口から見えるワイン会', 'center'],
  ['/images/www/20260624/20.jpg', '余市のワインが並ぶ店内', 'center'],
  ['/images/www/20260624/33.jpg', '食卓で料理を囲む時間', 'center'],
  ['/images/www/20260624/28.jpg', '石蔵で開かれるワイン会', 'center'],
  ['/images/www/20260624/24.jpg', '余市の食材を使った料理', 'center'],
  ['/images/www/20260624/30.jpg', 'ワインと一緒に味わう料理', 'center'],
  ['/images/www/20260624/68.jpg', '光を映すワイングラス', 'center'],
  ['/images/www/20260624/18.jpg', '料理とワインを味わう時間', 'center'],
  ['/images/www/20260624/11.jpg', '小さな石ぐらKiKiの外観', 'center'],
];

export const dynamic = 'force-dynamic';
export default async function Home() {
  const [events, contents] = await Promise.all([
    publicEvents(),
    visibleContents(false),
  ]);
  const upcoming = events.slice(0, 3),
    featured = contents.slice(0, 3);
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
          <div key={`${alt}-${index}`}>
            <Image
              src={src}
              alt={alt}
              width={2048}
              height={1365}
              quality={95}
              style={{ objectPosition: position }}
            />
          </div>
        ))}
      </section>
      {(upcoming.length > 0 || featured.length > 0) && (
        <section className="home-updates" aria-labelledby="updates-title">
          <p className="concept-kicker">CURRENT WWW</p>
          <h2 id="updates-title">WWW TOPICS</h2>
          <div className="update-columns">
            <div>
              <p className="update-label">NEXT EVENT</p>
              {upcoming.length
                ? upcoming.map((event) => (
                    <Link
                      className="update-row"
                      href={`/events/${event.slug}`}
                      key={event.id}
                    >
                      <time>
                        {event.start_at.slice(0, 10).replaceAll('-', '.')}
                      </time>
                      <strong>{event.title}</strong>
                      <span>
                        {event.registration_enabled
                          ? event.applications >= event.capacity &&
                            event.waitlist_enabled
                            ? 'キャンセル待ち'
                            : '受付中'
                          : '受付終了'}
                      </span>
                    </Link>
                  ))
                : null}
              {upcoming.length > 0 && (
                <Link href="/events" className="more-link">
                  EVENTをすべて見る <b>→</b>
                </Link>
              )}
            </div>
            <div>
              <p className="update-label">LATEST STORIES</p>
              {featured.length
                ? featured.map((content) => (
                    <Link
                      className="update-row"
                      href={`/news/${content.slug}`}
                      key={content.id}
                    >
                      <time>
                        {content.published_at
                          ?.slice(0, 10)
                          .replaceAll('-', '.') || 'NEW'}
                      </time>
                      <strong>{content.title}</strong>
                      <span>{content.is_new ? 'NEW' : content.type}</span>
                    </Link>
                  ))
                : null}
              {featured.length > 0 && (
                <Link href="/news" className="more-link">
                  NEWSをすべて見る <b>→</b>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
      <section className="home-concept">
        <p className="concept-kicker">www...?</p>
        <article>
          <Image
            src="/images/www/20260624/34.jpg"
            alt="グラス越しのワイン会"
            width={2048}
            height={1365}
            quality={95}
          />
          <div>
            <h2>ワイン造りを知る</h2>
            <div className="concept-copy">
              <p>美味しいワインは長い時間と手間をかけて造られ...</p>
              <p>「それは知ってる。」</p>
              <p>聞くことがなかった聞ける場所がなかった</p>
              <p>かけた想いやこだわりを実際の生産者から聞いてみませんか？</p>
            </div>
          </div>
        </article>
        <article>
          <Image
            src="/images/www/20260624/5.jpg"
            alt="ワイン会で乾杯する参加者"
            width={2048}
            height={1365}
            quality={95}
          />
          <div>
            <h2>
              飲み会という名の
              <br />
              ワイン勉強会
            </h2>
            <div className="concept-copy">
              <p>
                場所は余市町の石蔵のカフェ&amp;バーで余市産旬の食材と一緒にワインの勉強会。
              </p>
              <p>
                実際に造り手の皆さんやワインソムリエなど普段はお会いできない特別講師を招いて
              </p>
              <p>
                気軽に参加できるワイン勉強会（という名の飲み会）を定期的に開催しています
              </p>
            </div>
          </div>
        </article>
        <article className="profile-article">
          <Image
            src="/images/www/20260624/8.jpg"
            alt="小さな石ぐらKiKiで語らうKana Ninomiya"
            width={2048}
            height={1365}
            quality={95}
          />
          <div>
            <h2>Kana Ninomiya</h2>
            <div className="concept-copy profile-copy">
              <p>
                北海道余市町で、小さな石ぐらKiKi Café &amp;
                Barを営みながら、食とワインを通じたコミュニティづくりに取り組んでいます。
              </p>
              <p>
                これまで東京で接客・店舗運営に携わり、その後、結婚・子育てを経て故郷の北海道へ。
              </p>
              <p>
                現在は飲食店運営のほか、地域活動にも関わりながら、人と人、人と地域をつなぐ場づくりを続けています。
              </p>
              <p>余市には、世界に誇るワインと生産者がいます。</p>
              <p>
                しかし、その価値が十分に伝わり、次のファンへとつながる機会はまだ多くありません。WWWは、そんな余市のワイン文化への新しい入口として生まれました。
              </p>
              <p>
                知識や経験の有無に関係なく、「少し興味がある」「もっと知ってみたい」そんな人たちが集い、学び、語り合いながら、余市という土地の魅力に触れられる場所です。
              </p>
              <p>
                私はワインは人と土地をつなぐ文化だと考えています。ワインをきっかけに人がつながり、人がつながることで地域が育つ。
              </p>
              <p>
                WWWを通じて、余市の未来のワイン文化を次の世代へつないでいきたいと思っています。
              </p>
            </div>
          </div>
        </article>
        <a href="https://lin.ee/xWYPyBv" className="line-cta">
          <span className="line-cta-mark">LINE</span>
          <span className="line-cta-copy">
            <small>申込や詳細はこちら</small>
            <strong>公式LINEを開く</strong>
          </span>
          <span className="line-cta-arrow">→</span>
        </a>
      </section>
    </main>
  );
}

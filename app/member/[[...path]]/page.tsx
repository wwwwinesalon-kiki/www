import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { contentBySlug, publicEvents, visibleContents } from '@/lib/data';
export const metadata: Metadata = {
  title: 'Member Site',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
const copy: Record<string, [string, string]> = {
  people: ['PEOPLE', 'この人に会いたいから始まる物語'],
  field: ['FIELD', '畑から届くいまだけの声'],
  table: ['TABLE', 'ワインのある食卓をもっと自由に'],
  news: ['NEWS', 'WWWからのお知らせ'],
  events: ['EVENT', '次に会える場所'],
  archive: ['ARCHIVE', 'これまでの物語をたどる'],
  account: ['ACCOUNT', '会員情報とお支払いについて'],
};
const memberFeatures = [
  {
    label: 'FIELD',
    title: '余市の畑から届く声',
    href: '/member/field',
    text: '現地の写真と生産者へのヒアリングと音声',
  },
  {
    label: 'NOMIKAI',
    title: '次に一緒に飲む日',
    href: '/member/events',
    text: '初回は2026年10月31日 定員6名',
  },
  {
    label: 'TABLE',
    title: '日々の発行レシピ研究',
    href: '/member/table',
    text: '音声とレシピで家の食卓までつなぎます',
  },
];
export default async function MemberPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params,
    key = path[0] || '';
  if (path[1]) {
    const selected = await contentBySlug(path[1], true);
    if (!selected)
      return (
        <>
          <SiteHeader member />
          <main className="member-page">
            <h1>コンテンツが見つかりません</h1>
          </main>
          <SiteFooter />
        </>
      );
    return (
      <>
        <SiteHeader member />
        <article className="story">
          <p className="eyebrow">{selected.type}</p>
          <h1>{selected.title}</h1>
          <p className="lead">{selected.summary}</p>
          {selected.cover_image && (
            <Image
              src={selected.cover_image}
              alt=""
              width={1200}
              height={675}
              unoptimized
            />
          )}
          <div className="story-body">
            {selected.body.split('\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {selected.audio && <audio controls src={selected.audio} />}
        </article>
        <SiteFooter />
      </>
    );
  }
  const [label, title] = copy[key] || ['MEMBER HOME', 'ワインの向こう側へ'];
  if (!key) {
    return (
      <>
        <SiteHeader member />
        <main className="member-page">
          <div className="member-hero">
            <p className="eyebrow">{label}</p>
            <h1>{title}</h1>
            <p>女性とワインと楽しみ方をつなぐ会員だけの場所</p>
          </div>
          <section className="member-feature-grid" aria-label="会員コンテンツ">
            {memberFeatures.map((feature) => (
              <Link
                href={feature.href}
                key={feature.label}
                className="member-feature-card"
              >
                <span>{feature.label}</span>
                <h2>{feature.title}</h2>
                <p>{feature.text}</p>
                <b>見る →</b>
              </Link>
            ))}
          </section>
          <section className="member-program-note">
            <p className="eyebrow">DAILY VOICE</p>
            <h2>朝の声から広がるWWW</h2>
            <p>
              毎晩お届けする3つのテーマから翌朝の音声を選び
              <br />
              会員サイトとInstagramとThreadsへ展開します
            </p>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }
  if (key === 'events') {
    const events = await publicEvents(true);
    return (
      <>
        <SiteHeader member />
        <main className="member-page">
          <div className="member-hero">
            <p className="eyebrow">{label}</p>
            <h1>{title}</h1>
          </div>
          <section className="content-grid">
            {events.length ? (
              events.map((item, i) => (
                <Link
                  key={item.id}
                  href={`/events/${item.slug}`}
                  className="content-card"
                >
                  <div className={`content-visual tone-${i % 4}`}>EVENT</div>
                  <p className="eyebrow">EVENT</p>
                  <h2>{item.title}</h2>
                  <p>
                    {item.start_at.slice(0, 10)} · {item.venue}
                  </p>
                </Link>
              ))
            ) : (
              <p>公開中のイベントはありません</p>
            )}
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }
  if (key === 'account') {
    return (
      <>
        <SiteHeader member />
        <main className="member-page">
          <div className="member-hero">
            <p className="eyebrow">{label}</p>
            <h1>{title}</h1>
          </div>
          <section className="account-panel">
            <h2>会費・登録内容の確認</h2>
            <p>
              月額会費は3,300円（税込）です
              <br />
              登録内容やお支払いの確認は公式LINEからご案内します
            </p>
            <p>
              登録状況が分からない場合は登録したお名前とメールアドレスを添えてお問い合わせください
            </p>
            <div className="legal-actions">
              <Link className="button" href="/contact">
                お問い合わせ
              </Link>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }
  const type = key && key !== 'archive' ? key.toUpperCase() : undefined;
  let contents = await visibleContents(true, type);
  if (key === 'archive') contents = contents.filter((c) => !c.is_new);
  return (
    <>
      <SiteHeader member />
      <main className="member-page">
        <div className="member-hero">
          <p className="eyebrow">{label}</p>
          <h1>{title}</h1>
          <p>つくる人土地食卓をつなぐ会員だけの読みものと体験</p>
        </div>
        <section className="content-grid">
          {contents.length ? (
            contents.map((item, i) => (
              <Link
                key={item.id}
                href={`/member/${item.type.toLowerCase()}/${item.slug}`}
                className="content-card"
              >
                <div className={`content-visual tone-${i % 4}`}>
                  {item.type}
                </div>
                <p className="eyebrow">{item.type}</p>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
              </Link>
            ))
          ) : (
            <p>コンテンツはありません</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

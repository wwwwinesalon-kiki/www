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
  people: ['PEOPLE', 'この人に会いたい、から始まる物語。'],
  field: ['FIELD', '畑から届く、いまだけの声。'],
  table: ['TABLE', 'ワインのある食卓を、もっと自由に。'],
  news: ['NEWS', 'WWWからのお知らせ。'],
  events: ['EVENT', '次に会える場所。'],
  archive: ['ARCHIVE', 'これまでの物語をたどる。'],
};
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
  const [label, title] = copy[key] || ['MEMBER HOME', 'ワインの向こう側へ。'];
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
              <p>公開中のイベントはありません。</p>
            )}
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
          <p>つくる人、土地、食卓をつなぐ、会員だけの読みものと体験。</p>
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
            <p>まだコンテンツがありません。</p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

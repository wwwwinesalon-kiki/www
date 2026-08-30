import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { visibleContents } from '@/lib/data';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function News() {
  const contents = await visibleContents(false, 'NEWS');
  return (
    <>
      <SiteHeader />
      <main className="public-page">
        <p className="eyebrow">NEWS</p>
        <h1>お知らせ</h1>
        <div className="news-list">
          {contents.length ? (
            contents.map((c) => (
              <article key={c.id}>
                <time>{c.published_at?.slice(0, 10) || '公開日未設定'}</time>
                <span>{c.type}</span>
                <h2>
                  <Link href={`/news/${c.slug}`}>{c.title}</Link>
                </h2>
                <p>{c.summary}</p>
              </article>
            ))
          ) : (
            <p>お知らせはありません</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

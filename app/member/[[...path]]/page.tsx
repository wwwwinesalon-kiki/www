import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import ArticleBody from '@/components/article-body';
import MemberStatus from '@/components/member-status';
import { contentBySlug, publicEvents, visibleContents } from '@/lib/data';
import { memberAccess } from '@/lib/member-access';
import { PRIMARY_CATEGORIES } from '@/lib/article';
import { MEMBERSHIP_TOTAL_LABEL } from '@/lib/membership-policy';
export const metadata: Metadata = {
  title: '会員記事',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function MemberPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const key = path[0] || '';
  const access = await memberAccess();
  if (key === 'account')
    return (
      <>
        <SiteHeader member />
        <main className="article-shell">
          <h1>アカウントのご案内</h1>
          <p>
            月額の支払総額は{MEMBERSHIP_TOTAL_LABEL}です
            契約と支払方法の確認・退会は会費ペイが管理しています
          </p>
          <p>記事の閲覧はお支払い済みの会費の対象月末までです イベント参加費は別料金です</p>
          <p>手続きが分からない場合は公式LINEへお問い合わせください</p>
          <a href="https://lin.ee/xWYPyBv" className="button">
            公式LINE
          </a>
          <p>
            <Link href="/member/reset">パスワード再設定</Link>
          </p>
        </main>
      </>
    );
  if (!access.entitled)
    return (
      <>
        <SiteHeader member />
        <MemberStatus />
        {access.editor && (
          <p className="article-shell">
            <Link href="/admin">記事管理・管理者プレビューへ</Link>
          </p>
        )}
      </>
    );
  if (path.length > 2) notFound();
  if (path[1]) {
    const article = await contentBySlug(path[1], true);
    if (!article) notFound();
    return (
      <>
        <SiteHeader member />
        <article className="article-shell">
          <Link href="/member">← 記事一覧へ</Link>
          <p className="eyebrow">{article.type}</p>
          <h1>{article.title}</h1>
          {article.cover_image && (
            <Image
              unoptimized
              src={article.cover_image}
              alt={article.cover_alt || article.title}
              width={1200}
              height={800}
              className="article-cover"
            />
          )}
          <ArticleBody body={article.body} format={article.body_format} />
          <Link href="/member">← 記事一覧へ</Link>
        </article>
        <SiteFooter member />
      </>
    );
  }
  if (key === 'events') {
    const events = await publicEvents(true);
    return (
      <>
        <SiteHeader member />
        <main className="article-shell">
          <h1>EVENT</h1>
          <p>既存のイベント案内</p>
          {events.length ? (
            events.map((e) => (
              <p key={e.id}>
                <Link href={'/events/' + e.slug}>{e.title}</Link>
              </p>
            ))
          ) : (
            <p>公開中のイベントはありません</p>
          )}
        </main>
      </>
    );
  }
  const all = await visibleContents(true);
  const categories = Array.from(
    new Set([...PRIMARY_CATEGORIES, ...all.map((c) => c.type)]),
  );
  const selected = key && key !== 'archive' ? key.toUpperCase() : '';
  const articles = selected ? all.filter((c) => c.type === selected) : all;
  return (
    <>
      <SiteHeader member />
      <main className="article-shell">
        <p className="eyebrow">WINE WELCOME WORLD</p>
        <h1>ワインの楽しみ方が広がる読みもの</h1>
        <nav aria-label="記事カテゴリ">
          <Link href="/member" aria-current={!selected ? 'page' : undefined}>
            すべて
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={'/member/' + c.toLowerCase()}
              aria-current={selected === c ? 'page' : undefined}
            >
              {c}
            </Link>
          ))}
        </nav>
        <section className="article-grid">
          {articles.length ? (
            articles.map((c) => (
              <Link
                prefetch={false}
                href={'/member/' + c.type.toLowerCase() + '/' + c.slug}
                key={c.id}
              >
                {c.cover_image && (
                  <Image
                    unoptimized
                    src={c.cover_image}
                    alt={c.cover_alt || c.title}
                    width={600}
                    height={400}
                  />
                )}
                <p>{c.type}</p>
                <h2>{c.title}</h2>
              </Link>
            ))
          ) : (
            <p>記事は準備中です 公開までお待ちください</p>
          )}
        </section>
      </main>
      <SiteFooter member />
    </>
  );
}

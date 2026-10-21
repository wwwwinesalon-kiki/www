import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import ArticleBody from '@/components/article-body';
import MemberStatus from '@/components/member-status';
import { contentBySlug, publicEvents, upcomingMemberEvents, visibleContents } from '@/lib/data';
import { memberAccess } from '@/lib/member-access';
import { PRIMARY_CATEGORIES } from '@/lib/article';
import type { ContentView } from '@/lib/data';
import { MEMBERSHIP_TOTAL_LABEL } from '@/lib/membership-policy';
import '../../member-portal-refresh.css';
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
        <main className="article-shell member-article-page">
          <h1>アカウントのご案内</h1>
          <p>
            月額の支払総額は{MEMBERSHIP_TOTAL_LABEL}です
            契約と支払方法の確認・退会は会費ペイが管理しています
          </p>
          <p>
            記事の閲覧はお支払い済みの会費の対象月末までです
            イベント参加費は別料金です
          </p>
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
        <article className="article-shell member-article-page member-story">
          <Link className="member-back-link" href="/member">
            ← 記事一覧へ
          </Link>
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
          <Link className="member-back-link" href="/member">
            ← 記事一覧へ
          </Link>
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
        <main className="article-shell member-article-page member-events-page">
          <p className="eyebrow">MEMBER / NOMIKAI</p>
          <h1>イベントと飲み会</h1>
          <p>
            イベントは会費とは別料金です 詳細と申込方法は各案内をご確認ください
          </p>
          {events.length ? (
            events.map((e) => (
              <article className="member-event" key={e.id}>
                <p className="eyebrow">
                  {new Date(e.start_at).toLocaleDateString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <h2>
                  <Link href={'/events/' + e.slug}>{e.title}</Link>
                </h2>
                <p>{e.venue}</p>
                <Link href={'/events/' + e.slug}>詳細を見る →</Link>
              </article>
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
  if (key && key !== 'archive' && !categories.includes(selected)) notFound();
  const articles = selected ? all.filter((c) => c.type === selected) : all;
  const upcoming = !key ? await upcomingMemberEvents(2) : [];
  const sections = [
    {
      type: 'FIELD',
      label: '畑のいまを知る',
      description: '余市の畑から届く記録と作り手の声',
      image: '/images/about/field-2.jpg',
    },
    {
      type: 'TABLE',
      label: '家で楽しむ',
      description: '日々の発行レシピ研究とワインのある食卓',
      image: '/images/www/20260624/30.jpg',
    },
    {
      type: 'PEOPLE',
      label: '作り手を知る',
      description: '一本のワインの向こうにいる人たち',
      image: '/images/www/20260624/33.jpg',
    },
  ];
  return (
    <>
      <SiteHeader member />
      <main className="article-shell member-portal">
        <section
          className={
            'member-welcome ' +
            (key ? 'member-welcome-list' : 'member-welcome-home')
          }
        >
          <span className="member-welcome-art" aria-hidden="true" />
          <div className="member-welcome-copy">
            <p className="eyebrow">WWW / MEMBER</p>
            <h1>
              {selected
                ? selected
                : key === 'archive'
                  ? 'すべての読みもの'
                  : 'ワインのある日々へ'}
            </h1>
            <p>
              {selected
                ? '気になる記事から ゆっくりお楽しみください'
                : '畑のこと 作り手のこと 食卓のこと　余市のワインをもっと身近に'}
            </p>
          </div>
        </section>
        <div className="member-portal-content">
          {!key && (
            <>
              <section className="member-block" aria-labelledby="latest-title">
                <div className="member-section-heading">
                  <div>
                    <p className="eyebrow">LATEST</p>
                    <h2 id="latest-title">新しく届いた記事</h2>
                  </div>
                  <Link className="member-text-link" href="/member/archive">
                    すべての記事を見る <span aria-hidden="true">→</span>
                  </Link>
                </div>
                <div className="member-card-grid">
                  {all.length ? (
                    all
                      .slice(0, 3)
                      .map((c) => <MemberCard key={c.id} article={c} />)
                  ) : (
                    <p className="member-empty">
                      新しい記事を準備中です　公開されるとここに表示されます
                    </p>
                  )}
                </div>
              </section>
              <section className="member-block" aria-labelledby="explore-title">
                <div className="member-section-heading">
                  <div>
                    <p className="eyebrow">EXPLORE</p>
                    <h2 id="explore-title">テーマから探す</h2>
                  </div>
                </div>
                <div className="member-category-grid">
                  {sections.map((section) => (
                    <Link
                      key={section.type}
                      href={'/member/' + section.type.toLowerCase()}
                      className="member-category"
                    >
                      <span className="member-category-art" aria-hidden="true">
                        <Image
                          src={section.image}
                          alt=""
                          fill
                          sizes="(max-width: 760px) 100vw, 33vw"
                        />
                      </span>
                      <span className="member-category-copy">
                        <span>{section.type}</span>
                        <strong>{section.label}</strong>
                        <small>{section.description}</small>
                        <em aria-hidden="true">→</em>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
              <section
                className="member-block member-nomikai"
                aria-labelledby="event-title"
              >
                <div className="member-nomikai-copy">
                  <p className="eyebrow">NOMIKAI / EVENT</p>
                  <h2 id="event-title">一緒に楽しむ</h2>
                  <p className="member-nomikai-lead">
                    ワインを囲み 人が出会い 語り合う
                  </p>
                  {upcoming.length ? (
                    <ul className="member-upcoming-list">
                      {upcoming.map((event) => (
                        <li key={event.id}>
                          <Link href={'/events/' + event.slug}>
                            {event.title} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="member-nomikai-status">
                      次の開催案内を準備中です
                    </p>
                  )}
                  <small>参加費は月会費とは別料金です</small>
                </div>
                <div className="member-nomikai-art" aria-hidden="true">
                  <Image
                    src="/images/www/20260624/34.jpg"
                    alt=""
                    fill
                    sizes="(max-width: 760px) 100vw, 40vw"
                  />
                </div>
                <div className="member-nomikai-action">
                  <Link href="/member/events">
                    イベント一覧 <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </section>
            </>
          )}
          {key && (
            <>
              <nav className="member-filter" aria-label="記事カテゴリ">
                <Link
                  href="/member/archive"
                  aria-current={key === 'archive' ? 'page' : undefined}
                >
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
              <section className="member-card-grid" aria-label="記事一覧">
                {articles.length ? (
                  articles.map((c) => <MemberCard key={c.id} article={c} />)
                ) : (
                  <p className="member-empty">このテーマの記事は準備中です</p>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <SiteFooter member />
    </>
  );
}

function MemberCard({ article }: { article: ContentView }) {
  return (
    <Link
      prefetch={false}
      className="member-card"
      href={'/member/' + article.type.toLowerCase() + '/' + article.slug}
    >
      {article.cover_image ? (
        <Image
          unoptimized
          src={article.cover_image}
          alt={article.cover_alt || article.title}
          width={600}
          height={400}
        />
      ) : (
        <span className="member-card-placeholder">WWW</span>
      )}
      <span className="member-card-copy">
        <small>
          {article.type}
          {article.published_at
            ? ' / ' +
              new Date(article.published_at).toLocaleDateString('ja-JP', {
                timeZone: 'Asia/Tokyo',
              })
            : ''}
        </small>
        <strong>{article.title}</strong>
        {article.summary && <span>{article.summary}</span>}
        <em>
          記事を読む <span aria-hidden="true">→</span>
        </em>
      </span>
    </Link>
  );
}

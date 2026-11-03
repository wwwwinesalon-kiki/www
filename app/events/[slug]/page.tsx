import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { eventBySlug } from '@/lib/data';
import ApplicationForm from '@/components/application-form';
import { memberAccess } from '@/lib/member-access';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
const eventDate = (value: string, withTime = false) =>
  new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } as const : {}),
  });
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const access = await memberAccess();
  const e = await eventBySlug(slug) ||
    (access.entitled || access.editor ? await eventBySlug(slug, true) : null);
  if (!e) return {};
  const description = `${eventDate(e.start_at)} ${e.venue}で開催するWWWイベント`;
  return {
    title: e.title,
    description,
    robots: e.public_visible ? undefined : { index: false, follow: false },
    openGraph: {
      title: e.title,
      description,
      images: e.cover_image ? [e.cover_image] : [],
    },
    twitter: {
      title: e.title,
      description,
      images: e.cover_image ? [e.cover_image] : [],
    },
  };
}
export default async function EventDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const access = await memberAccess();
  const e = await eventBySlug(slug) ||
    (access.entitled || access.editor ? await eventBySlug(slug, true) : null);
  if (!e) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.start_at,
    endDate: e.end_at,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: e.venue },
    offers: {
      '@type': 'Offer',
      price: e.price,
      priceCurrency: 'JPY',
      availability: e.registration_enabled
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
    },
  };
  return (
    <>
      <SiteHeader />
      <main className="event-detail">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <p className="eyebrow">WWW EVENT</p>
        <h1>{e.title}</h1>
        <div
          className="wide-visual"
          style={
            e.cover_image
              ? { backgroundImage: `url(${e.cover_image})` }
              : undefined
          }
        >
          {e.cover_image ? '' : e.venue}
        </div>
        <div className="event-detail-grid">
          <article>
            <dl>
              <div>
                <dt>DATE</dt>
                <dd>
                  {eventDate(e.start_at, true)}–{eventDate(e.end_at, true)}（日本時間）
                </dd>
              </div>
              <div>
                <dt>VENUE</dt>
                <dd>{e.venue}</dd>
              </div>
              <div>
                <dt>FEE</dt>
                <dd>¥{e.price.toLocaleString()}</dd>
              </div>
              <div>
                <dt>CAPACITY</dt>
                <dd>
                  {e.capacity}名
                </dd>
              </div>
            </dl>
            <h2>{e.description || 'イベント詳細'}</h2>
            {e.items_to_bring && (
              <>
                <h3>持ち物</h3>
                <p>{e.items_to_bring}</p>
              </>
            )}
            {e.precautions && (
              <>
                <h3>注意事項</h3>
                <p>{e.precautions}</p>
              </>
            )}
          </article>
          {e.registration_enabled && access.entitled ? (
            <ApplicationForm eventId={e.id} />
          ) : e.registration_enabled ? (
            <p>お申し込みには会員ログインが必要です <Link href="/member/login">ログインする</Link></p>
          ) : (
            <p>現在受付を停止しています</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { publicEvents } from '@/lib/data';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function Events() {
  const events = await publicEvents();
  return (
    <>
      <SiteHeader />
      <main className="public-page">
        <p className="eyebrow">EVENTS</p>
        <h1>会う　味わう　つながる</h1>
        <div className="event-list">
          {events.length ? (
            events.map((e, i) => (
              <Link key={e.id} href={`/events/${e.slug}`}>
                <div className={`content-visual tone-${i % 4}`}>EVENT</div>
                <div>
                  <time>{e.start_at.slice(0, 10)}</time>
                  <h2>{e.title}</h2>
                  <p>
                    {e.venue} · {e.applications}/{e.capacity}名
                  </p>
                  <span
                    className={`badge ${e.registration_enabled ? 'success' : ''}`}
                  >
                    {e.registration_enabled ? '受付中' : '受付終了'}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <p>公開イベントはありません</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

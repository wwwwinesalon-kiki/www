'use client';
import { useEffect } from 'react';
export default function AnalyticsTracker() {
  useEffect(() => {
    let id = localStorage.getItem('www_anonymous_session');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('www_anonymous_session', id);
    }
    const path = location.pathname,
      eventType = path.startsWith('/events/')
        ? 'event_detail_view'
        : 'page_view';
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventType,
        sessionId: id,
        path,
        entityId: path.startsWith('/events/') ? path.split('/')[2] : undefined,
      }),
    });
  }, []);
  return null;
}

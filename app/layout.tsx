import type { Metadata } from 'next';
import './globals.css';
import './articles.css';
import AnalyticsTracker from '@/components/analytics-tracker';
import WineRippleBackground from '@/components/wine-ripple-background';
import JoinUsCta from '@/components/join-us-cta';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3000'),
  ),
  title: {
    default: 'Wine Work Women｜ワインから人生を豊かに',
    template: '%s｜Wine Work Women',
  },
  description: 'ワインをきっかけに女性たちの仕事と暮らしがつながるコミュニティ',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Wine Work Women',
    description: 'ワインから人生をちょっと豊かに',
    type: 'website',
    locale: 'ja_JP',
  },
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        <WineRippleBackground />
        <AnalyticsTracker />
        <div className="site-content">{children}</div>
        <JoinUsCta />
      </body>
    </html>
  );
}

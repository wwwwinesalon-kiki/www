import type { Metadata } from 'next';
import './globals.css';
import AnalyticsTracker from '@/components/analytics-tracker';
import WineRippleBackground from '@/components/wine-ripple-background';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://wine-work-women.example.com',
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
    <html lang="ja">
      <body>
        <WineRippleBackground />
        <AnalyticsTracker />
        <div className="site-content">{children}</div>
      </body>
    </html>
  );
}

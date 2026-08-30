import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import AnalyticsTracker from '@/components/analytics-tracker';
import WineRippleBackground from '@/components/wine-ripple-background';

const sans = Noto_Sans_JP({ variable: '--font-sans-jp', subsets: ['latin'] });
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL || 'https://wine-work-women.example.com',
  ),
  title: {
    default: 'Wine Work Women｜ワインから人生を豊かに',
    template: '%s｜Wine Work Women',
  },
  description:
    'ワインをきっかけに、女性たちの仕事と暮らしがつながるコミュニティ。',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Wine Work Women',
    description: 'ワインから、人生をちょっと豊かに。',
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
      <body className={sans.variable}>
        <WineRippleBackground />
        <AnalyticsTracker />
        <div className="site-content">{children}</div>
      </body>
    </html>
  );
}

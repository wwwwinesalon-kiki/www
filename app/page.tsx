import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <Link href="/" className="brand"><span>WWW</span><small>WINE WORK WOMEN</small></Link>
        <nav aria-label="メインナビゲーション">
          <Link href="/about">ABOUT</Link><Link href="/news">NEWS</Link><Link href="/events">EVENT</Link><Link href="/faq">FAQ</Link>
        </nav>
        <Link href="/join" className="button compact">JOIN US <ArrowRight size={15}/></Link>
      </header>
      <section className="hero">
        <p className="eyebrow">WINE CONNECTS US</p>
        <h1>ワインから、<br/>人生をちょっと豊かに。</h1>
        <p className="hero-copy">つくる人、届ける人、楽しむ人。ワインをきっかけに、女性たちの仕事と暮らしがつながるコミュニティです。</p>
        <div className="hero-actions"><Link href="/join" className="button">WWWに参加する <ArrowRight size={17}/></Link><Link href="/about" className="text-link">私たちについて</Link></div>
        <div className="wine-orbit" aria-hidden="true"><span>WWW</span></div>
      </section>
      <section className="event-band">
        <div><p className="eyebrow">NEXT EVENT</p><h2>余市の畑と、秋のテーブル</h2></div>
        <div className="event-meta"><span><CalendarDays size={18}/> 2026.09.19 SAT</span><span><MapPin size={18}/> 北海道・余市</span></div>
        <Link href="/events/yoichi-autumn-table" className="round-link" aria-label="イベント詳細"><ArrowRight/></Link>
      </section>
      <section className="intro"><p className="eyebrow">OUR COMMUNITY</p><h2>知るほどに、会いたくなる。<br/>会うほどに、好きになる。</h2><p>畑の声、つくり手の物語、食卓のアイデア。WWWは、ワインの向こう側にいる人と土地を、日々の暮らしへ届けます。</p></section>
    </main>
  );
}

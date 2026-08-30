'use client';
import Link from 'next/link';
export default function PublicMenu() {
  return (
    <details className="public-menu">
      <summary aria-label="メニューを開く">
        <i />
        <i />
        <i />
      </summary>
      <nav aria-label="公開ページメニュー">
        <Link href="/">TOP</Link>
        <Link href="/about">ABOUT</Link>
        <Link href="/news">NEWS</Link>
        <Link href="/events">EVENT</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/join">JOIN</Link>
        <Link href="/contact">CONTACT</Link>
      </nav>
    </details>
  );
}

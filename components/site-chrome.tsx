import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
export function SiteHeader({ member = false }: { member?: boolean }) {
  return (
    <header className="site-header">
      <Link href={member ? '/member' : '/'} className="brand">
        <span>WWW</span>
        <small>WINE WORK WOMEN</small>
      </Link>
      <nav aria-label={member ? '会員ナビゲーション' : 'メインナビゲーション'}>
        {member ? (
          <>
            <Link href="/member/people">PEOPLE</Link>
            <Link href="/member/field">FIELD</Link>
            <Link href="/member/table">TABLE</Link>
            <Link href="/member/news">NEWS</Link>
            <Link href="/member/events">EVENT</Link>
            <Link href="/member/archive">ARCHIVE</Link>
            <Link href="/member/account">ACCOUNT</Link>
          </>
        ) : (
          <>
            <Link href="/about">ABOUT</Link>
            <Link href="/news">NEWS</Link>
            <Link href="/events">EVENT</Link>
            <Link href="/faq">FAQ</Link>
          </>
        )}
      </nav>
      {member ? (
        <form action="/api/member/logout" method="post">
          <button className="plain-action">ログアウト</button>
        </form>
      ) : (
        <Link href="/join" className="button compact">
          JOIN US <ArrowRight size={15} />
        </Link>
      )}
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="brand">
        <span>WWW</span>
        <small>WINE WORK WOMEN</small>
      </div>
      <p>ワインから、人生をちょっと豊かに。</p>
      <div>
        <Link href="/about">ABOUT</Link>
        <Link href="/events">EVENT</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/contact">CONTACT</Link>
        <Link href="/privacy">PRIVACY</Link>
        <Link href="/terms">TERMS</Link>
        <Link href="/tokusho">LEGAL</Link>
        <Link href="/member/login">MEMBER LOGIN</Link>
      </div>
      <small>© 2026 WINE WORK WOMEN</small>
    </footer>
  );
}

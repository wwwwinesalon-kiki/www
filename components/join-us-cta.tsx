'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function WineGlassIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 76" aria-hidden="true">
      <g transform="rotate(-13 26 38)" fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M13 8h26c0 18-4.8 28-13 28S13 26 13 8Z" strokeWidth="1.35" />
        <path d="M15.5 22c7.2 2.6 13.8 2.6 21 0" strokeWidth="1.1" />
        <path d="M26 36v27M17 68h18" strokeWidth="1.35" />
      </g>
    </svg>
  );
}

export default function JoinUsCta() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const update = () => {
      setPastHero(window.scrollY > window.innerHeight * 0.72);
      setFill(Math.min(100, Math.max(0, (window.scrollY / (window.innerHeight * 0.55)) * 100)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  if (pathname.startsWith('/admin') || pathname.startsWith('/member') || pathname === '/join') return null;

  const show = isMobile || (pathname === '/' && pastHero);
  const style = { '--wine-fill': `${isMobile ? fill : 0}%` } as CSSProperties;

  return (
    <Link href="/join" className={`floating-join${show ? ' is-visible' : ''}`} style={style}>
      <WineGlassIcon className="floating-join-glass" />
      <span>
        <small>WINE WORK WOMEN</small>
        <strong>JOIN US</strong>
      </span>
    </Link>
  );
}

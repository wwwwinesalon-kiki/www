import { SiteFooter, SiteHeader } from '@/components/site-chrome';
export default function LegalPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="public-page legal-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <section>{children}</section>
      </main>
      <SiteFooter />
    </>
  );
}

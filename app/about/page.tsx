import { SiteHeader, SiteFooter } from '@/components/site-chrome';
export default function About() {
  return (
    <>
      <SiteHeader />
      <main className="public-page">
        <p className="eyebrow">ABOUT WWW</p>
        <h1>
          ワインを通して、
          <br />
          仕事と暮らしをつなぐ。
        </h1>
        <div className="wide-visual">WINE · WORK · WOMEN</div>
        <section>
          <h2>私たちが大切にしていること</h2>
          <p>
            知ること、会うこと、味わうこと。その体験の積み重ねが、日々の選択を少し豊かにすると信じています。
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

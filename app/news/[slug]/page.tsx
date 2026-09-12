import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { contentBySlug } from '@/lib/data';
import ArticleBody from '@/components/article-body';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params,
    c = await contentBySlug(slug, false);
  return c
    ? {
        title: c.title,
        description: c.summary || undefined,
        openGraph: {
          title: c.title,
          description: c.summary || undefined,
          images: c.cover_image ? [{ url: c.cover_image }] : [],
        },
      }
    : { title: 'お知らせが見つかりません' };
}
export default async function PublicStory({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    c = await contentBySlug(slug, false);
  if (!c) notFound();
  return (
    <>
      <SiteHeader />
      <article className="story public-story">
        <p className="eyebrow">{c.type}</p>
        <time>{c.published_at?.slice(0, 10)}</time>
        <h1>{c.title}</h1>
        <p className="lead">{c.summary}</p>
        {c.cover_image && (
          <Image
            src={c.cover_image}
            alt=""
            width={1200}
            height={675}
            unoptimized
          />
        )}
        <ArticleBody body={c.body} format={c.body_format} />
      </article>
      <SiteFooter />
    </>
  );
}

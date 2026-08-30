import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL || 'https://wine-work-women.example.com';
  return [
    '',
    '/about',
    '/news',
    '/events',
    '/faq',
    '/join',
    '/contact',
    '/privacy',
    '/terms',
    '/tokusho',
  ].map((path) => ({
    url: base + path,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}

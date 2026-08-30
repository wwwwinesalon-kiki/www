import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/member/', '/api/'],
    },
    sitemap: `${process.env.SITE_URL || 'https://wine-work-women.example.com'}/sitemap.xml`,
  };
}

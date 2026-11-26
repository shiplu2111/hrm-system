import type { MetadataRoute } from 'next';
import { getSiteUrl, isIndexableProduction } from '../lib/seo';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  if (!isIndexableProduction()) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/platform/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

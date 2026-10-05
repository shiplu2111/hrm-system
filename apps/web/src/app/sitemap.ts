import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/features', '/pricing', '/about', '/contact', '/privacy', '/terms'].map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: path === '' || path === '/pricing' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.9 : 0.6,
  }));
}

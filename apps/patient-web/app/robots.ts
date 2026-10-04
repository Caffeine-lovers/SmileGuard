import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smileguard.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/forgot-password'],
        disallow: [
          '/dashboard',
          '/appointments',
          '/billing',
          '/analysis',
          '/documents',
          '/profile',
          '/treatments',
          '/bio-data',
          '/api/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

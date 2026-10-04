import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SmileGuard Patient Portal',
    short_name: 'SmileGuard',
    description: 'AI-powered dental care and appointment management portal',
    start_url: '/login',
    display: 'standalone',
    background_color: '#F4F7F6',
    theme_color: '#10B981',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon.svg',
        sizes: '180x180',
        type: 'image/svg+xml',
      },
    ],
  };
}

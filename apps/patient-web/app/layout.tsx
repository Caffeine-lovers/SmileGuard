import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const defaultUrl = process.env.NEXT_PUBLIC_APP_URL
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'https://smileguard.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: 'SmileGuard Patient Portal | AI-Powered Dental Care',
    template: '%s | SmileGuard',
  },
  description:
    'Clinical dental appointment booking, real-time schedule management, and AI-powered oral health analysis for SmileGuard patients.',
  keywords: [
    'SmileGuard',
    'dental portal',
    'patient appointments',
    'dental clinic',
    'AI oral health',
    'dental diagnostics',
  ],
  authors: [{ name: 'SmileGuard Clinical Team' }],
  creator: 'SmileGuard',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-icon.svg' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: defaultUrl,
    title: 'SmileGuard Patient Portal',
    description:
      'Clinical dental appointment booking and AI-powered oral health analysis.',
    siteName: 'SmileGuard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmileGuard Patient Portal',
    description:
      'Clinical dental appointment booking and AI-powered oral health analysis.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#10B981',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className="font-sans antialiased bg-[#F4F7F6] text-[#0F172A] min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

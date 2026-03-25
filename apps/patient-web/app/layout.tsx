import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmileGuard Patient Portal',
  description: 'Dental appointment booking and AI-powered oral health analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

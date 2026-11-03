'use client';

import LegalFooter from '@/components/legal/LegalFooter';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-bg-screen to-brand-primary/10">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 bg-brand-primary">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-text-on-avatar mb-4">SmileGuard</h1>
          <p className="text-text-on-avatar/80 text-lg">
            Your trusted partner for dental health
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-md">{children}</div>
        <LegalFooter />
      </div>
    </div>
  );
}

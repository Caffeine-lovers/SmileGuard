import Link from 'next/link';
import type { ReactNode } from 'react';
import Wordmark from '@/components/ui/Wordmark';

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="w-6 h-6 rounded-md" />
            <Wordmark className="text-xl font-black text-brand-primary tracking-tight" />
          </Link>
          <nav className="flex gap-4 text-sm font-semibold text-slate-600">
            <Link href="/terms" className="hover:text-brand-primary">Terms</Link>
            <Link href="/privacy" className="hover:text-brand-primary">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6">{title}</h1>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import { CalendarPlus, LogOut } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { currentUser, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAuthTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== 'patient')) {
      router.push('/login');
    }
  }, [currentUser?.id, currentUser?.role, loading, router]);

  const handleLogout = async () => {
    try {
      await logout();
      // Small delay to ensure auth state is cleared
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect even if logout fails
      router.push('/login');
    }
  };

  // Full-screen wizard view for onboarding - always render immediately
  if (pathname === '/onboarding') {
    return <main className="min-h-screen">{children}</main>;
  }

  if (loading && !authTimedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-300 border-b-emerald-600"></div>
      </div>
    );
  }

  if (loading && authTimedOut && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-bg-screen">
        <div className="skeuo-panel p-8 max-w-sm w-full border-2 border-slate-300">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">Connecting Session...</h2>
          <p className="text-xs text-slate-600 mb-5">Establishing secure clinical session with your profile.</p>
          <button
            onClick={() => router.push('/login')}
            className="skeuo-btn-primary py-2.5 px-4 text-xs uppercase tracking-wider w-full mb-3"
          >
            Go to Login
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-emerald-700 font-semibold hover:underline"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg-screen">
      <header className="bg-bg-surface shadow-sm border-b border-border-card sticky top-0 z-50">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-2xl font-bold text-brand-primary">
              SmileGuard
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link 
                href="/dashboard" 
                className={`font-medium transition hover:text-brand-primary ${pathname === '/dashboard' ? 'text-brand-primary' : 'text-text-primary'}`}
              >
                Dashboard
              </Link>
              <Link 
                href="/billing" 
                className={`font-medium transition hover:text-brand-primary ${pathname === '/billing' ? 'text-brand-primary' : 'text-text-primary'}`}
              >
                Billing
              </Link>
              <Link 
                href="/analysis" 
                className={`font-medium transition hover:text-brand-primary ${pathname === '/analysis' ? 'text-brand-primary' : 'text-text-primary'}`}
              >
                Analysis
              </Link>
              <Link 
                href="/treatments" 
                className={`font-medium transition hover:text-brand-primary ${pathname === '/treatments' ? 'text-brand-primary' : 'text-text-primary'}`}
              >
                Treatments
              </Link>
              <Link 
                href="/documents" 
                className={`font-medium transition hover:text-brand-primary ${pathname === '/documents' ? 'text-brand-primary' : 'text-text-primary'}`}
              >
                Documents
              </Link>
              <Link 
                href="/profile" 
                className={`font-medium transition hover:text-brand-primary ${pathname === '/profile' ? 'text-brand-primary' : 'text-text-primary'}`}
              >
                Profile
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/appointments" 
              className="skeuo-btn-primary py-2 px-3.5 text-xs uppercase tracking-wider hidden md:inline-flex"
            >
              <span className="flex items-center gap-2">
                <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Book an Appointment</span>
              </span>
            </Link>
            <span className="text-xs font-semibold text-slate-600 hidden md:block">
              {currentUser.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="skeuo-btn-secondary py-2 px-3 text-xs uppercase tracking-wider text-red-600 hover:text-red-700"
            >
              <span className="flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Logout</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}

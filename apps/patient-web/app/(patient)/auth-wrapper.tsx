'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import type { ReactNode } from 'react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { currentUser, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'patient') {
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
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/appointments" 
              className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg transition font-medium text-sm hidden md:block"
            >
              Book an Appointment
            </Link>
            <span className="text-sm text-text-secondary hidden md:block">
              {currentUser.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 bg-brand-danger hover:bg-brand-danger/90 text-text-on-danger rounded-lg transition font-medium"
            >
              Logout
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

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@smileguard/shared-hooks';
import type { ReactNode } from 'react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { currentUser, loading, logout } = useAuth();
  const router = useRouter();

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'patient') {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              SmileGuard
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium transition">
                Dashboard
              </Link>
              <Link href="/appointments" className="text-gray-700 hover:text-blue-600 font-medium transition">
                Appointments
              </Link>
              <Link href="/billing" className="text-gray-700 hover:text-blue-600 font-medium transition">
                Billing
              </Link>
              <Link href="/analysis" className="text-gray-700 hover:text-blue-600 font-medium transition">
                Analysis
              </Link>
              <Link href="/treatments" className="text-gray-700 hover:text-blue-600 font-medium transition">
                Treatments
              </Link>
              <Link href="/documents" className="text-gray-700 hover:text-blue-600 font-medium transition">
                Documents
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block">
              {currentUser.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium"
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

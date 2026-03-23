'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { useEffect } from 'react';
import Link from 'next/link';

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated or not a patient
    if (!loading && (!currentUser || currentUser.role !== 'patient')) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'patient') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600">SmileGuard</h1>
          <p className="text-sm text-gray-500 mt-1">Patient Portal</p>
        </div>

        <nav className="p-4 space-y-2">
          <Link href="/dashboard" className="block px-4 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600">
            Dashboard
          </Link>
          <Link href="/appointments" className="block px-4 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600">
            Appointments
          </Link>
          <Link href="/billing" className="block px-4 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600">
            Billing
          </Link>
          <Link href="/analysis" className="block px-4 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600">
            AI Analysis
          </Link>
          <Link href="/treatments" className="block px-4 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600">
            Treatments
          </Link>
          <Link href="/documents" className="block px-4 py-2 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600">
            Documents
          </Link>
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <button
            onClick={() => {
              // TODO: implement logout
              router.push('/auth/login');
            }}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="flex justify-between items-center px-8 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Welcome, {currentUser.name}
            </h2>
            <div className="text-sm text-gray-600">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

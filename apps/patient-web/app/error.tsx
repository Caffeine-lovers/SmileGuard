'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SmileGuard Error Boundary] Uncaught error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="skeuo-panel p-8 max-w-md w-full text-center border-2 border-slate-300">
        <div className="w-14 h-14 bg-red-50 rounded-sm border-2 border-red-300 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <AlertTriangle className="w-7 h-7 text-red-600" />
        </div>
        <span className="skeuo-badge mb-2 bg-red-100 text-red-800 border-red-300">
          Application Error
        </span>
        <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mt-2 mb-2">
          Service Interrupted
        </h2>
        <p className="text-xs font-semibold text-slate-600 mb-6 uppercase tracking-wider">
          An unexpected issue occurred while rendering this page.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="skeuo-btn-primary py-2.5 px-5 text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/dashboard"
            className="py-2.5 px-5 text-xs uppercase tracking-wider font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm inline-flex items-center justify-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

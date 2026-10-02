'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[SmileGuard Global Error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-100 min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="bg-white border-2 border-slate-300 rounded-sm p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2 uppercase">System Fault</h2>
          <p className="text-xs text-slate-600 mb-6 font-semibold">
            A critical system error occurred. Please refresh or attempt recovery.
          </p>
          <button
            onClick={() => reset()}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-6 rounded-xs text-xs uppercase tracking-wider transition-colors"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}

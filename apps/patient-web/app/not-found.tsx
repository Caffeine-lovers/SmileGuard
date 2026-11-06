import Link from 'next/link';
import { Stethoscope, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="skeuo-panel p-10 max-w-md w-full text-center border-2 border-slate-300">
        <div className="w-16 h-16 bg-emerald-50 rounded-sm border-2 border-emerald-300 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Stethoscope className="w-8 h-8 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">
          Page Not Found
        </h1>
        <p className="text-sm font-semibold text-slate-600 mb-6">
          This page doesn&apos;t exist or has moved.
        </p>
        <Link 
          href="/dashboard"
          className="skeuo-btn-primary py-2.5 px-6 text-xs uppercase tracking-wider inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Receipt,
  Calendar,
  LayoutDashboard,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export default function BillingCancelledPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-sm p-4 sm:p-6 text-white border-2 border-slate-950 shadow-md w-full">
        <div className="flex items-center gap-3 mb-1">
          <span className="skeuo-badge text-[10px] text-amber-950 bg-amber-300 border-amber-400">
            <AlertTriangle className="w-3 h-3 text-amber-950" />
            Transaction Aborted
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
          Payment Cancelled
        </h1>
        <p className="text-slate-300 text-xs font-semibold tracking-wide uppercase mt-0.5">
          Ivy King Dental Clinic &bull; Accounts & Settlement Notice
        </p>
      </div>

      {/* Main Cancellation Card */}
      <div className="skeuo-panel p-6 md:p-8 border-2 border-amber-300 bg-amber-50/30 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-sm bg-amber-100 border-2 border-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
              No Charges Were Made
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your PayMongo checkout session was cancelled. No money was deducted from your credit card, debit card, GCash, Maya, or bank account.
            </p>
          </div>
        </div>

        {/* Audit Details */}
        <div className="skeuo-card p-5 bg-white border-2 border-slate-300 rounded-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-slate-600" />
            Clinical Ledger Status
          </h3>
          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-600">Procedure Booking:</span>
              <span className="font-bold text-slate-900">Active &bull; Retained on Schedule</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-600">Settlement Status:</span>
              <span className="font-bold text-amber-700 uppercase">Pending Due</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="font-semibold text-slate-600">Payment Gateway:</span>
              <span className="font-mono font-bold text-slate-800">PayMongo (Session Closed)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            You can settle this procedure online at any time before your appointment, or arrange settlement directly with clinic staff upon arrival.
          </p>
        </div>

        {/* Quick Action Navigation */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link
            href="/billing"
            className="skeuo-btn-primary py-2.5 px-5 text-xs uppercase tracking-wider w-full sm:w-auto text-center"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Retry Invoice Payment</span>
          </Link>
          <Link
            href="/appointments"
            className="skeuo-btn-secondary py-2.5 px-4 text-xs uppercase tracking-wider w-full sm:w-auto text-center"
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>View Appointments</span>
          </Link>
          <Link
            href="/dashboard"
            className="skeuo-btn-secondary py-2.5 px-4 text-xs uppercase tracking-wider w-full sm:w-auto text-center"
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
            <span>Patient Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Security Reassurance */}
      <div className="text-center text-[11px] font-semibold text-slate-500 flex items-center justify-center gap-1.5 uppercase tracking-wide">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Transactions are secured and monitored under BSP payment regulations.
      </div>
    </div>
  );
}

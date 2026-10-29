'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';
import { getPatientAppointments, withTimeout } from '@/lib/appointmentService';
import { 
  CheckCircle2, 
  Calendar, 
  XCircle, 
  ClipboardList, 
  ArrowLeft,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';

export default function TreatmentsPage() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) {
      setLoadingData(false);
      return;
    }

    const userId = currentUser.id;

    async function fetchTreatments() {
      setLoadingData(true);
      try {
        const appts = await withTimeout(getPatientAppointments(userId), 2500, []);
        const sorted = (appts || []).sort(
          (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
        );
        setAppointments(sorted);
      } catch (err) {
        console.error('Error fetching treatments:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchTreatments();
  }, [currentUser?.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="skeuo-badge skeuo-badge-mint">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Completed
          </span>
        );
      case 'scheduled':
        return (
          <span className="skeuo-badge bg-emerald-50 text-emerald-800 border-emerald-400">
            <Calendar className="w-3 h-3 text-emerald-700" />
            Scheduled
          </span>
        );
      case 'declined':
        return (
          <span className="skeuo-badge bg-amber-50 text-amber-700 border-amber-300">
            <XCircle className="w-3 h-3 text-amber-600" />
            Declined
          </span>
        );
      case 'no-show':
      case 'cancelled':
        return (
          <span className="skeuo-badge bg-red-50 text-red-700 border-red-300">
            <XCircle className="w-3 h-3 text-red-600" />
            {status === 'no-show' ? 'No Show' : 'Cancelled'}
          </span>
        );
      default:
        return (
          <span className="skeuo-badge skeuo-badge-slate">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-4 sm:p-6 text-white border-2 border-emerald-950 shadow-md">
        <span className="skeuo-badge skeuo-badge-mint text-[9px] sm:text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400 mb-2">
          <ShieldCheck className="w-3 h-3 text-emerald-950" />
          Clinical Chart
        </span>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight">Treatment Records</h1>
        <p className="text-emerald-100 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5">
          Chronological ledger of dental procedures, cleanings & consultations
        </p>
      </div>

      <div className="skeuo-panel p-3.5 sm:p-6 border-2 border-slate-300">
        {loadingData ? (
          <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-sm">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-b-emerald-600 mx-auto mb-2"></div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading clinical ledger...</p>
          </div>
        ) : appointments.length > 0 ? (
          <div className="space-y-2.5 sm:space-y-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="skeuo-card p-3 sm:p-4 rounded-sm border-2 border-slate-300 flex flex-col gap-2.5 sm:gap-3"
              >
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">{appointment.service}</h3>
                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-500 font-mono mt-0.5">
                        <span>{new Date(appointment.appointment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>•</span>
                        <span>{appointment.appointment_time || 'General slot'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="self-start xs:self-auto shrink-0">
                    {getStatusBadge(appointment.status)}
                  </div>
                </div>

                {appointment.notes && (
                  <div className="bg-slate-50 rounded-xs p-2.5 sm:p-3 border border-slate-200 text-xs">
                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Attending Dentist Notes:</p>
                    <p className="text-slate-800 leading-relaxed font-medium text-xs">{appointment.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center bg-slate-50 rounded-sm border-2 border-dashed border-slate-300">
            <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">No recorded dental treatments</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Completed procedures will be logged here</p>
            <Link href="/appointments" className="skeuo-btn-primary py-2 px-4 text-xs uppercase">
              Schedule First Visit
            </Link>
          </div>
        )}
      </div>

      <div>
        <Link href="/dashboard" className="skeuo-btn-secondary py-2 px-4 text-xs uppercase tracking-wider">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

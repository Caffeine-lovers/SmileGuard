'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';
import { getPatientAppointments } from '@/lib/appointmentService';
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
  const { currentUser, loading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;

    const userId = currentUser.id;

    async function fetchTreatments() {
      setLoadingData(true);
      try {
        const appts = await getPatientAppointments(userId);
        const sorted = appts.sort(
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

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-b-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-6 text-white border-2 border-emerald-950 shadow-md">
        <span className="skeuo-badge skeuo-badge-mint text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400 mb-2">
          <ShieldCheck className="w-3 h-3 text-emerald-950" />
          Clinical Chart
        </span>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">Treatment Records</h1>
        <p className="text-emerald-100 text-xs font-semibold tracking-wide uppercase mt-0.5">
          Chronological ledger of dental procedures, cleanings & consultations
        </p>
      </div>

      <div className="skeuo-panel p-6 border-2 border-slate-300">
        {appointments.length > 0 ? (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="skeuo-card p-4 rounded-sm border-2 border-slate-300 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-sm bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{appointment.service}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
                        <span>{new Date(appointment.appointment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span>•</span>
                        <span>{appointment.appointment_time || 'General slot'}</span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(appointment.status)}
                </div>

                {appointment.notes && (
                  <div className="bg-slate-50 rounded-xs p-3 border border-slate-200 text-xs">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Attending Dentist Notes:</p>
                    <p className="text-slate-800 leading-relaxed font-medium">{appointment.notes}</p>
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

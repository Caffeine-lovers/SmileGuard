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
  Stethoscope,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { getServicePrice } from '@/lib/pricing';
import { formatAppointmentTime, formatDuration, formatMinutes, getServiceDuration, toMinutes } from '@/lib/scheduling';
import { DEFAULT_CLINIC_NAME } from '@/lib/clinic';

export default function TreatmentsPage() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

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
        setCurrentPage(1);
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
      case 'pending':
        return (
          <span className="skeuo-badge bg-amber-50 text-amber-700 border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Approval
          </span>
        );
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
    <div className="py-3 sm:py-4 md:py-6 space-y-4 sm:space-y-6">
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
        <div>
          <div className="space-y-2.5 sm:space-y-3">
            {appointments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((appointment) => (
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
                        <span>{formatAppointmentTime(appointment.appointment_time) || 'General slot'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="self-start xs:self-auto shrink-0 flex items-center gap-2">
                    {getStatusBadge(appointment.status)}
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === appointment.id ? null : appointment.id ?? null)}
                      aria-expanded={expandedId === appointment.id}
                      className="skeuo-btn-secondary px-2.5 py-1 text-[11px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <span>{expandedId === appointment.id ? 'Hide details' : 'View details'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedId === appointment.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {expandedId === appointment.id && (() => {
                  const services = (appointment.service || '').split(',').map((x) => x.trim()).filter(Boolean);
                  const duration = getServiceDuration(appointment.service);
                  const start = appointment.appointment_time ? toMinutes(appointment.appointment_time) : NaN;
                  const timeRange = Number.isFinite(start)
                    ? `${formatMinutes(start)} – ${formatMinutes(start + duration)}`
                    : appointment.appointment_time ? formatAppointmentTime(appointment.appointment_time) : '—';
                  const fee = appointment.price ?? services.reduce((sum, name) => sum + getServicePrice(name), 0);
                  const rows: [string, string][] = [
                    ['Date', new Date(appointment.appointment_date).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })],
                    ['Time', timeRange],
                    ['Duration', formatDuration(duration)],
                    ['Clinic', appointment.clinic_name || DEFAULT_CLINIC_NAME],
                    ['Fee', `₱${fee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
                    ['Requested on', appointment.created_at ? new Date(appointment.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'],
                  ];
                  return (
                    <div className="border-t border-slate-200 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1.5">
                        {rows.map(([label, value]) => (
                          <div key={label} className="flex justify-between gap-4">
                            <span className="text-slate-500">{label}</span>
                            <span className="font-semibold text-slate-900 text-right">{value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" /> Procedures
                        </p>
                        <ul className="space-y-1">
                          {services.map((name) => (
                            <li key={name} className="flex justify-between bg-slate-50 border border-slate-200 rounded-xs px-2 py-1">
                              <span className="font-medium text-slate-800">{name}</span>
                              <span className="text-slate-500">{getServiceDuration(name)} min</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {['pending', 'PENDING', 'scheduled'].includes(appointment.status) && (
                            <Link href="/dashboard" className="skeuo-btn-secondary px-2.5 py-1 text-[11px] uppercase tracking-wider">
                              <Building2 className="w-3 h-3" /> <span>Reschedule / Cancel</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {appointment.notes && (
                  <div className="bg-slate-50 rounded-xs p-2.5 sm:p-3 border border-slate-200 text-xs">
                    <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Attending Dentist Notes:</p>
                    <p className="text-slate-800 leading-relaxed font-medium text-xs">{appointment.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {appointments.length > 0 && (
            <div className="mt-5 pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-500">
                Showing <span className="font-bold text-slate-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="font-bold text-slate-800">
                  {Math.min(currentPage * ITEMS_PER_PAGE, appointments.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800">{appointments.length}</span> treatment records
              </p>

              {Math.ceil(appointments.length / ITEMS_PER_PAGE) > 1 ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="skeuo-btn-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: Math.ceil(appointments.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 text-xs font-bold rounded-xs transition flex items-center justify-center ${
                          currentPage === page
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/80 bg-white/70 border border-slate-300'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(appointments.length / ITEMS_PER_PAGE), p + 1))}
                    disabled={currentPage === Math.ceil(appointments.length / ITEMS_PER_PAGE)}
                    className="skeuo-btn-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs font-semibold">
                  Page 1 of 1
                </div>
              )}
            </div>
          )}
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

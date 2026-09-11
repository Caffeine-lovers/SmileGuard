'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import StatCard from '@/components/dashboard/StatCard';
import AppointmentCard from '@/components/dashboard/AppointmentCard';
import { getPatientAppointments, getDoctorName } from '@/lib/appointmentService';
import { calculateOutstandingBalance } from '@/lib/outstandingBalanceService';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';
import { 
  Calendar, 
  CreditCard, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Stethoscope, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function PatientDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'pending'>('scheduled');
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      router.push('/login');
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        if (!currentUser?.id) return;
        const userId = currentUser.id;
        const [appts, balance] = await Promise.all([
          getPatientAppointments(userId),
          calculateOutstandingBalance(userId),
        ]);

        setAppointments(appts);
        setOutstandingBalance(balance);

        // Fetch doctor names
        const doctorIds = Array.from(new Set(
          appts
            .map(a => a.dentist_id)
            .filter((id): id is string => Boolean(id))
        ));

        const names: Record<string, string> = {};
        await Promise.all(
          doctorIds.map(async (docId) => {
            const name = await getDoctorName(docId);
            if (name) names[docId] = name;
          })
        );
        setDoctorNames(names);
      } catch (err) {
        console.error('[PatientDashboard] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser, authLoading, router]);

  if (authLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="skeuo-panel p-12 text-center max-w-md mx-auto border-2 border-slate-300">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-b-emerald-600 mx-auto mb-3"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Initializing Clinic Session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const scheduledAppointments = appointments.filter(apt => apt.dentist_id !== null);
  const pendingAppointments = appointments.filter(apt => apt.dentist_id === null);

  return (
    <div className="p-4 md:p-6 min-h-screen max-w-5xl mx-auto space-y-6">
      {/* Clinic Header Banner - Skeumorphic Mint Green */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-7 text-white border-2 border-emerald-950 shadow-md relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-white/30"></div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-sm border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Stethoscope className="w-8 h-8 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="skeuo-badge skeuo-badge-mint text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-950" />
                  SmileGuard Patient Portal
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">{currentUser?.name}</h1>
              <p className="text-emerald-100 text-xs font-semibold tracking-wide uppercase mt-0.5">
                Dental Chart & Treatment Registry
              </p>
            </div>
          </div>

          <Link
            href="/appointments"
            className="skeuo-btn-primary py-2.5 px-4 text-xs uppercase tracking-wider shrink-0 hidden sm:inline-flex"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Book Appointment</span>
            </span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Calendar className="w-6 h-6 text-emerald-700" />} 
          number={loading ? '...' : appointments.length} 
          label="Registered Appointments" 
        />
        <StatCard 
          icon={<CreditCard className="w-6 h-6 text-emerald-700" />} 
          number={loading ? '...' : `₱${outstandingBalance.toFixed(2)}`} 
          label="Outstanding Balance" 
          href="/billing" 
        />
        <StatCard 
          icon={<Clock className="w-6 h-6 text-emerald-700" />} 
          number={loading ? '...' : formatDate(appointments[0]?.appointment_date ?? '')} 
          label="Next Scheduled Visit" 
        />
      </div>

      {/* Appointments Management Panel */}
      <div className="skeuo-panel p-6 border-2 border-slate-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b-2 border-slate-200">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
              Your Clinical Appointments
            </h2>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
              Review upcoming visits and confirmed bookings
            </p>
          </div>

          <div className="flex gap-1.5 p-1 bg-slate-200/80 border border-slate-300 rounded-sm">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-3.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition ${
                activeTab === 'scheduled'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scheduled ({scheduledAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Pending</span>
              {pendingAppointments.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-xs text-[10px] font-black">
                  {pendingAppointments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
            Fetching appointment ledger...
          </div>
        ) : activeTab === 'scheduled' ? (
          scheduledAppointments.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-sm">
              <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 uppercase">No scheduled appointments</p>
              <p className="text-xs text-slate-500 mt-1">Book your next regular dental check-up</p>
              <Link href="/appointments" className="skeuo-btn-primary mt-4 py-2 px-4 text-xs uppercase">
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Book Visit</span>
                </span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scheduledAppointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  name={apt.dentist_id ? doctorNames[apt.dentist_id] || 'Attending Dentist' : 'General Service'}
                  service={apt.service}
                  date={apt.appointment_date}
                  time={apt.appointment_time}
                />
              ))}
            </div>
          )
        ) : (
          pendingAppointments.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-sm">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 uppercase">No pending requests</p>
              <p className="text-xs text-slate-500 mt-1">All your bookings have been reviewed by the clinic</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingAppointments.map((apt) => (
                <div key={apt.id} className="skeuo-card p-4 border-2 border-amber-300 bg-amber-50/40 rounded-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="skeuo-badge skeuo-badge-amber text-[10px] mb-2">Pending Confirmation</span>
                      <p className="font-black text-sm text-slate-900">{apt.service}</p>
                      <p className="text-xs text-slate-600 mt-0.5">Date: {apt.appointment_date} at {apt.appointment_time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Quick Navigation Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/appointments" className="skeuo-btn-secondary p-3.5 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span>Book Appointment</span>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
        </Link>
        <Link href="/billing" className="skeuo-btn-secondary p-4 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span>Billing & Payments</span>
          <ChevronRight className="w-4 h-4 text-emerald-700" />
        </Link>
        <Link href="/profile" className="skeuo-btn-secondary p-4 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span>Medical Profile</span>
          <ChevronRight className="w-4 h-4 text-emerald-700" />
        </Link>
      </div>
    </div>
  );
}

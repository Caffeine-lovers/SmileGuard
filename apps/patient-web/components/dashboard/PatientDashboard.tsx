'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import StatCard from '@/components/dashboard/StatCard';
import AppointmentCard from '@/components/dashboard/AppointmentCard';
import DoctorProfileModal from '@/components/dashboard/DoctorProfileModal';
import { getPatientAppointments, getDoctorDetails, withTimeout } from '@/lib/appointmentService';
import { calculateOutstandingBalance, fetchClinicLookup } from '@/lib/outstandingBalanceService';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';
import { isPendingAppointment, isCancelledAppointment } from '@/lib/database';
import InteractiveTour from '@/components/tour/InteractiveTour';
import { 
  Calendar,
  Compass, 
  CreditCard, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Stethoscope, 
  ChevronRight,
  Building2,
  Sparkles,
  CalendarX,
  X
} from 'lucide-react';

export default function PatientDashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'pending' | 'cancelled'>('scheduled');
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [doctorPictures, setDoctorPictures] = useState<Record<string, string>>({});
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isCancellingAppt, setIsCancellingAppt] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const handleCancelAppointment = async (apptId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment request?')) return;
    setIsCancellingAppt(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', apptId);

      if (error) throw error;
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: 'cancelled' } : a));
      setSelectedAppointment(null);
      alert('Your appointment has been cancelled.');
    } catch (err: any) {
      console.error('Error cancelling appointment:', err);
      alert(`Could not cancel appointment: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCancellingAppt(false);
    }
  };


  useEffect(() => {
    if (!currentUser?.id) return;
    const storageKey = `smileguard_patient_tour_completed_${currentUser.id}`;
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      const timer = setTimeout(() => {
        setIsTourOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.id]);
  

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'pending' || tabParam === 'scheduled' || tabParam === 'cancelled') {
        setActiveTab(tabParam);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    async function fetchData() {
      setLoading(true);
      try {
        if (!currentUser?.id) return;
        const userId = currentUser.id;

        const [appts, balance, clinicLookup] = await Promise.all([
          withTimeout(getPatientAppointments(userId), 5000, []),
          withTimeout(calculateOutstandingBalance(userId), 5000, 0),
          withTimeout(fetchClinicLookup(), 5000, { clinicMap: new Map(), defaultClinic: null }),
        ]);

        const { clinicMap, defaultClinic } = clinicLookup;
        const enrichedAppts = (appts || []).map((a) => {
          const clinic = (a.dentist_id ? clinicMap.get(a.dentist_id) : null) || defaultClinic;
          return {
            ...a,
            clinic_name: clinic?.clinic_name || "Kyler's Clinic",
          };
        });

        setAppointments(enrichedAppts);
        setOutstandingBalance(balance);

        // If no scheduled visits exist but pending requests do, default to the pending tab
        const pendingCount = (enrichedAppts || []).filter(isPendingAppointment).length;
        const scheduledCount = (enrichedAppts || []).filter(
          (apt) => !isPendingAppointment(apt) && !isCancelledAppointment(apt)
        ).length;
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (!params.get('tab') && scheduledCount === 0 && pendingCount > 0) {
            setActiveTab('pending');
          }
        }

        // Fetch doctor names and pictures with fast timeout
        const doctorIds = Array.from(new Set(
          (appts || [])
            .map(a => a.dentist_id)
            .filter((id): id is string => Boolean(id))
        ));

        const names: Record<string, string> = {};
        const pictures: Record<string, string> = {};
        await Promise.all(
          doctorIds.map(async (docId) => {
            const details = await withTimeout(
              getDoctorDetails(docId),
              1500,
              { name: null, profilePictureUrl: null }
            );
            if (details.name) names[docId] = details.name;
            if (details.profilePictureUrl) pictures[docId] = details.profilePictureUrl;
          })
        );
        setDoctorNames(names);
        setDoctorPictures(pictures);
      } catch (err) {
        console.error('[PatientDashboard] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser?.id, router]);

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Categorise strictly by appointments.status (see migration 032):
  //   pending   → awaiting clinic approval
  //   cancelled → cancelled / declined
  //   scheduled → everything the clinic has approved (scheduled, completed, no-show)
  const pendingAppointments = appointments.filter(isPendingAppointment);
  const cancelledAppointments = appointments.filter(isCancelledAppointment);
  const scheduledAppointments = appointments.filter(
    (apt) => !isPendingAppointment(apt) && !isCancelledAppointment(apt)
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const nextVisit = scheduledAppointments
    .filter(apt => apt.status === 'scheduled' && apt.appointment_date >= todayStr)
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0];

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen max-w-5xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* Clinic Header Banner - Skeumorphic Mint Green */}
      <div data-tour="profile-header" className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-4 sm:p-6 md:p-7 text-white border-2 border-emerald-950 shadow-md relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-white/30"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div data-tour="profile-card" className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 rounded-sm border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              <Stethoscope className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {currentUser?.pwd_status === 'approved' && (
                  <span className="skeuo-badge skeuo-badge-mint text-[9px] sm:text-[10px] text-emerald-900 bg-emerald-100 border-emerald-300 font-bold">
                    ✓ Verified {currentUser?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'}
                  </span>
                )}
                {currentUser?.pwd_status === 'pending' && (
                  <span className="skeuo-badge text-[9px] sm:text-[10px] text-amber-900 bg-amber-100 border-amber-300 font-bold">
                    ⏳ PWD Verification Pending
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight truncate">
                {currentUser?.name || 'Patient'}
              </h1>
              <p className="text-emerald-100 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5 truncate">
                Dental Chart & Treatment Registry
              </p>
            </div>
          </div>

          <div data-tour="guide-controls" className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t border-white/10 sm:border-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsTourOpen(true)}
              className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-xs font-bold uppercase tracking-wider rounded border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Take Interactive UI Spotlight Tour"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-300" />
              <span>Tour UI</span>
            </button>

            <Link
              href="/onboarding"
              className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-xs font-bold uppercase tracking-wider rounded border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
              title="View Full Onboarding Wizard"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Guide</span>
            </Link>

            {/* Mobile Book Visit CTA (Visible on mobile, hidden on desktop where header has Book Appointment) */}
            <Link
              href="/appointments"
              data-tour="book-visit-btn"
              className="!inline-flex md:!hidden skeuo-btn-primary py-2 px-3 sm:py-2.5 sm:px-3.5 text-xs uppercase tracking-wider shrink-0 items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Book Visit</span>
            </Link>


          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div data-tour="stats-grid" className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard 
          icon={<Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700" />} 
          number={loading ? '...' : appointments.length} 
          label="Registered Appointments" 
        />
        <StatCard 
          icon={<CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700" />} 
          number={loading ? '...' : `₱${outstandingBalance.toFixed(2)}`} 
          label="Outstanding Balance" 
          href="/billing" 
        />
        <StatCard 
          icon={<Clock className="w-6 h-6 text-emerald-700" />} 
          number={loading ? '...' : formatDate(nextVisit?.appointment_date ?? 'None scheduled')} 
          label="Next Scheduled Visit" 
        />
      </div>

      {/* Appointments Management Panel */}
      <div data-tour="appointments-panel" className="skeuo-panel p-4 sm:p-6 border-2 border-slate-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-5 pb-4 border-b-2 border-slate-200">
          <div>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
              Your Clinical Appointments
            </h2>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
              Review upcoming visits and confirmed bookings
            </p>
          </div>

          <div className="w-full sm:w-auto flex overflow-x-auto no-scrollbar gap-1 sm:gap-1.5 p-1 bg-slate-200/80 border border-slate-300 rounded-sm">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3.5 py-1.5 rounded-sm text-[11px] sm:text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
                activeTab === 'scheduled'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 bg-white/60'
              }`}
            >
              Scheduled ({scheduledAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3.5 py-1.5 rounded-sm text-[11px] sm:text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 bg-white/60'
              }`}
            >
              Pending ({pendingAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3.5 py-1.5 rounded-sm text-[11px] sm:text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
                activeTab === 'cancelled'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 bg-white/60'
              }`}
            >
              Cancelled ({cancelledAppointments.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading appointments...</p>
          </div>
        ) : activeTab === 'scheduled' ? (
          scheduledAppointments.length === 0 ? (
            <div className="text-center py-12 bg-white/40 border-2 border-dashed border-slate-300 rounded-sm p-4">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-black uppercase text-slate-700 tracking-tight">No Scheduled Visits</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Book an appointment with a clinic to keep your teeth healthy.</p>
              <Link 
                href="/appointments" 
                className="skeuo-btn-primary text-xs px-3 py-1.5 mt-3 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book Now</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scheduledAppointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  name={apt.dentist_id ? doctorNames[apt.dentist_id] || 'Attending Dentist' : (apt.clinic_name || "Kyler's Clinic")}
                  avatarUrl={apt.dentist_id ? doctorPictures[apt.dentist_id] : undefined}
                  service={apt.service}
                  date={apt.appointment_date}
                  time={apt.appointment_time}
                  status={apt.status}
                  clinicName={apt.clinic_name}
                  onClick={() => setSelectedAppointment(apt)}
                  onDoctorClick={apt.dentist_id ? () => setSelectedDoctorId(apt.dentist_id) : undefined}
                />
              ))}
            </div>
          )
        ) : activeTab === 'pending' ? (
          pendingAppointments.length === 0 ? (
            <div className="text-center py-12 bg-white/40 border-2 border-dashed border-slate-300 rounded-sm p-4">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-black uppercase text-slate-700 tracking-tight">No Pending Requests</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">All your booking requests have been processed by the clinic.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingAppointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  name={apt.dentist_id ? doctorNames[apt.dentist_id] || 'Attending Dentist' : (apt.clinic_name || "Kyler's Clinic")}
                  avatarUrl={apt.dentist_id ? doctorPictures[apt.dentist_id] : undefined}
                  service={apt.service}
                  date={apt.appointment_date}
                  time={apt.appointment_time}
                  status="pending"
                  clinicName={apt.clinic_name}
                  onClick={() => setSelectedAppointment(apt)}
                  onDoctorClick={apt.dentist_id ? () => setSelectedDoctorId(apt.dentist_id) : undefined}
                />
              ))}
            </div>
          )
        ) : (
          cancelledAppointments.length === 0 ? (
            <div className="text-center py-12 bg-white/40 border-2 border-dashed border-slate-300 rounded-sm p-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-black uppercase text-slate-700 tracking-tight">No Cancelled Appointments</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">You have no cancelled or declined bookings on record.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cancelledAppointments.map((apt) => (
                <div key={apt.id} className="skeuo-card p-4 border-2 border-slate-300 bg-slate-50/60 rounded-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`skeuo-badge text-[10px] ${apt.status === 'declined' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                          {apt.status === 'declined' ? 'Declined by Clinic' : 'Cancelled'}
                        </span>
                        {apt.clinic_name && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-xs">
                            <Building2 className="w-3 h-3 text-slate-600" />
                            {apt.clinic_name}
                          </span>
                        )}
                      </div>
                      <p className="font-black text-sm text-slate-900">{apt.service}</p>
                      <p className="text-xs text-slate-600 mt-0.5">Date: {apt.appointment_date} at {apt.appointment_time}</p>
                      {apt.dentist_id && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {doctorPictures[apt.dentist_id] && (
                            <img
                              src={doctorPictures[apt.dentist_id]}
                              alt="Doctor"
                              className="w-4 h-4 rounded-full object-cover border border-slate-300 shrink-0"
                            />
                          )}
                          <p className="text-[11px] text-slate-500 font-semibold">
                            Doctor:{' '}
                            <button
                              type="button"
                              onClick={() => setSelectedDoctorId(apt.dentist_id)}
                              className="text-slate-800 font-bold hover:text-emerald-700 hover:underline transition-colors"
                              title="View doctor details"
                            >
                              {doctorNames[apt.dentist_id] || 'Attending Dentist'}
                            </button>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Quick Navigation Footer - Hidden on mobile per convention, scaled on desktop */}
      <div className="hidden md:grid md:grid-cols-4 gap-3 lg:gap-5">
        <Link href="/appointments" data-tour="quick-appointments" className="skeuo-btn-secondary p-3.5 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span>Book Appointment</span>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
        </Link>
        <Link href="/analysis" data-tour="quick-analysis" className="skeuo-btn-secondary p-3.5 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>AI Oral Screening</span>
          </span>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
        </Link>
        <Link href="/billing" data-tour="quick-billing" className="skeuo-btn-secondary p-3.5 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span>Billing & Payments</span>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
        </Link>
        <Link href="/profile" data-tour="quick-profile" className="skeuo-btn-secondary p-3.5 justify-between text-xs uppercase tracking-wider text-slate-800">
          <span>Medical Profile</span>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
        </Link>
      </div>

      {/* Doctor Profile Viewing Modal */}
      <DoctorProfileModal
        doctorId={selectedDoctorId}
        onClose={() => setSelectedDoctorId(null)}
      />


      {/* Appointment Details & Management Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="skeuo-panel max-w-md w-full p-5 sm:p-6 border-2 border-slate-300 relative bg-white">
            <button
              onClick={() => setSelectedAppointment(null)}
              className="absolute top-4 right-4 p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className={`skeuo-badge text-[10px] uppercase font-bold ${
                selectedAppointment.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isPendingAppointment(selectedAppointment)
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}>
                {isPendingAppointment(selectedAppointment) ? 'Pending Clinic Review' : selectedAppointment.status}
              </span>
              <span className="text-xs text-slate-500 font-semibold uppercase">Visit Details</span>
            </div>

            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-1">
              {selectedAppointment.service}
            </h3>
            <p className="text-xs font-bold text-emerald-800 mb-4 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {selectedAppointment.clinic_name || "Kyler's Clinic"}
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-3.5 space-y-2 text-xs mb-5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-bold text-slate-900">{selectedAppointment.appointment_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Scheduled Time:</span>
                <span className="font-bold text-slate-900">{selectedAppointment.appointment_time}</span>
              </div>
              {selectedAppointment.dentist_id && doctorNames[selectedAppointment.dentist_id] && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Attending Specialist:</span>
                  <span className="font-bold text-slate-900">{doctorNames[selectedAppointment.dentist_id]}</span>
                </div>
              )}
              {selectedAppointment.notes && (
                <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                  &quot;{selectedAppointment.notes}&quot;
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              {selectedAppointment.status !== 'cancelled' && selectedAppointment.status !== 'completed' && (
                <>
                  <button
                    onClick={() => handleCancelAppointment(selectedAppointment.id!)}
                    disabled={isCancellingAppt}
                    className="flex-1 py-2 px-3 border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-sm transition flex items-center justify-center gap-1.5"
                  >
                    <CalendarX className="w-3.5 h-3.5" />
                    <span>{isCancellingAppt ? 'Cancelling...' : 'Cancel Visit'}</span>
                  </button>
                  <Link
                    href={`/appointments?service=${encodeURIComponent(selectedAppointment.service)}`}
                    className="flex-1 py-2 px-3 skeuo-btn-secondary text-xs uppercase tracking-wider text-center"
                    onClick={() => setSelectedAppointment(null)}
                  >
                    Reschedule
                  </Link>
                </>
              )}
              <button
                onClick={() => setSelectedAppointment(null)}
                className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-sm transition text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive In-App Tour Overlay */}
      <InteractiveTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        storageKey={`smileguard_patient_tour_completed_${currentUser?.id || 'guest'}`}
      />
    </div>
  );
}

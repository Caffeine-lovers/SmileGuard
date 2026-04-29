'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import StatCard from '@/components/dashboard/StatCard';
import AppointmentCard from '@/components/dashboard/AppointmentCard';
import { getPatientAppointments, getDoctorName } from '@/lib/appointmentService';
import { calculateOutstandingBalance } from '@/lib/outstandingBalanceService';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';

export default function PatientDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'pending'>('scheduled');
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [appointmentRules, setAppointmentRules] = useState<any | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAppointmentForCancel, setSelectedAppointmentForCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const fetchAppointmentRules = async () => {
      try {
        const { data, error } = await supabase
          .from('appointment_rules')
          .select('*')
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        setAppointmentRules(data || null);
      } catch (error) {
        console.error('Error fetching appointment rules:', error);
        setAppointmentRules(null);
      }
    };

    fetchAppointmentRules();
  }, []);

  useEffect(() => {
    console.log("[PatientDashboard] Effect triggered:", { authLoading, currentUserId: currentUser?.id });
    
    // If auth is still initializing, wait
    if (authLoading) {
      console.log("[PatientDashboard] Auth still loading...");
      return;
    }

    // If user is not authenticated, redirect to login immediately
    if (!currentUser) {
      console.warn("[PatientDashboard] No current user, redirecting to login");
      router.push('/login');
      return;
    }

    console.log("[PatientDashboard] User authenticated, fetching dashboard data...");

    // User is authenticated, fetch dashboard data
    async function fetchData() {
      setLoading(true);
      try {
        if (!currentUser?.id) return;
        const userId = currentUser.id;
        console.log("[PatientDashboard] Starting data fetch for user:", userId);
        const [appts, balance] = await Promise.all([
          getPatientAppointments(userId),
          calculateOutstandingBalance(userId),
        ]);
        console.log("[PatientDashboard] Data fetched successfully:", { appointmentsCount: appts.length, balance });
        
        // Filter only scheduled appointments and sort them by date (assuming they are returned in some order or need sorting)
        const scheduledAppts = appts.filter(apt => 
          apt.status === 'scheduled' || 
          apt.status === 'Scheduled' || 
          apt.status === 'confirmed' || 
          apt.status === 'pending'
        );
        // Sort by date (ascending)
        scheduledAppts.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

        console.log("[PatientDashboard] Scheduled/Confirmed appointments:", scheduledAppts.length);
        setAppointments(scheduledAppts);
        setOutstandingBalance(balance);
      } catch (err) {
        console.error('[PatientDashboard] Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser, authLoading, router]);

  // Fetch doctor names for scheduled appointments
  useEffect(() => {
    const fetchDoctorNames = async () => {
      const scheduledAppts = appointments.filter(apt => apt.dentist_id !== null);
      const names: Record<string, string> = {};

      for (const apt of scheduledAppts) {
        if (apt.dentist_id && !doctorNames[apt.dentist_id]) {
          try {
            const doctorName = await getDoctorName(apt.dentist_id);
            console.log(`[PatientDashboard] Fetched doctor name for ${apt.dentist_id}:`, doctorName);
            if (doctorName) {
              names[apt.dentist_id] = doctorName;
            } else {
              console.warn(`[PatientDashboard] No doctor name found for dentist_id: ${apt.dentist_id}`);
            }
          } catch (error) {
            console.error(`[PatientDashboard] Error fetching doctor name for ${apt.dentist_id}:`, error);
          }
        }
      }

      if (Object.keys(names).length > 0) {
        console.log('[PatientDashboard] Setting doctor names:', names);
        setDoctorNames(prev => ({ ...prev, ...names }));
      }
    };

    if (appointments.length > 0) {
      fetchDoctorNames();
    }
  }, [appointments, doctorNames]);

  const handleCancelClick = (appointment: Appointment) => {
    setSelectedAppointmentForCancel(appointment);
    setShowCancelModal(true);
  };

  const handleRescheduleClick = (appointment: Appointment) => {
    // TODO: Implement reschedule functionality
    alert('Reschedule feature coming soon!');
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointmentForCancel) return;
    
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', selectedAppointmentForCancel.id);

      if (error) throw error;

      // Remove from state
      setAppointments(prev => prev.filter(apt => apt.id !== selectedAppointmentForCancel.id));
      setShowCancelModal(false);
      setSelectedAppointmentForCancel(null);
      alert('Appointment cancelled successfully');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    } finally {
      setIsCancelling(false);
    }
  };

  const calculateCancellationFee = (appointmentDate: string): { fee: number; isWithinGracePeriod: boolean; isWithinCancellationWindow: boolean } => {
    if (!appointmentRules) {
      return { fee: 0, isWithinGracePeriod: false, isWithinCancellationWindow: false };
    }

    const now = new Date();
    const apptDate = new Date(appointmentDate);
    const hoursDifference = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If within grace period, no fee
    if (appointmentRules.grace_period_enabled && hoursDifference <= appointmentRules.grace_period_hours) {
      return { fee: 0, isWithinGracePeriod: true, isWithinCancellationWindow: true };
    }

    // If still within cancellation window, charge fee
    if (hoursDifference <= appointmentRules.cancellation_window_hours) {
      return { fee: appointmentRules.cancellation_fee_amount || 0, isWithinGracePeriod: false, isWithinCancellationWindow: true };
    }

    // Past cancellation window
    return { fee: 0, isWithinGracePeriod: false, isWithinCancellationWindow: false };
  };

  // Show loading only while auth is initializing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If no user, don't render (will redirect to login)
  if (!currentUser) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Separate scheduled and pending appointments
  const scheduledAppointments = appointments.filter(apt => apt.dentist_id !== null);
  const pendingAppointments = appointments.filter(apt => apt.dentist_id === null);

  return (
    <div className="p-4 md:p-6 bg-bg-screen min-h-screen max-w-5xl mx-auto">
      <div className="bg-brand-cyan rounded-2xl p-8 mb-8 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-4xl">🦷</div>
          <div>
            <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Welcome back</p>
            <h1 className="text-3xl font-bold">{currentUser?.name}</h1>
            <p className="text-white/80 text-sm mt-1">Your dental health is in good hands</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard icon="" number={appointments.length} label="Total Appointments" accent="border-brand-primary" />
        <StatCard icon="" number={`₱${outstandingBalance.toFixed(2)}`} label="Outstanding Balance" accent="border-brand-primary" href="/billing" />
        <StatCard icon="" number={formatDate(appointments[0]?.appointment_date ?? '')} label="Next Appointment" accent="border-brand-primary" />
      </div>
    
      <div className="bg-bg-surface rounded-2xl shadow-sm border border-border-card p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-text-primary">Appointments</h2>
          <div className="flex gap-2 bg-bg-notes rounded-xl p-1">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Pending Requests
              {pendingAppointments.length > 0 && (
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  activeTab === 'pending' ? 'bg-white/30' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {pendingAppointments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Scheduled Appointments Tab */}
        {activeTab === 'scheduled' && (
          <>
            {scheduledAppointments.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                {scheduledAppointments.map((apt, index) => (
                  <div key={apt.id} className="flex gap-4 items-stretch">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 relative">
                        {index + 1}
                      </div>
                      {index < scheduledAppointments.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <AppointmentCard
                        name={apt.dentist_id && doctorNames[apt.dentist_id] ? doctorNames[apt.dentist_id] : 'Assigned Doctor'}
                        service={apt.service}
                        time={apt.appointment_time}
                        date={formatDate(apt.appointment_date)}
                        onCancel={() => handleCancelClick(apt)}
                        onReschedule={() => handleRescheduleClick(apt)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-text-secondary font-medium">No upcoming scheduled appointments</p>
                <Link href="/appointments" className="text-brand-primary text-sm font-medium mt-2 inline-block hover:underline">
                  Book your first appointment →
                </Link>
              </div>
            )}
          </>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 'pending' && (
          <>
            {pendingAppointments.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                {pendingAppointments.map((apt, index) => (
                  <div key={apt.id} className="flex gap-4 items-stretch">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 relative">
                        {index + 1}
                      </div>
                      {index < pendingAppointments.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="bg-bg-notes rounded-xl p-4 border border-yellow-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{apt.service}</p>
                            <p className="text-xs text-text-secondary mt-1">{formatDate(apt.appointment_date)} at {apt.appointment_time}</p>
                            {apt.notes && <p className="text-xs text-text-secondary mt-2 italic">Notes: {apt.notes}</p>}
                          </div>
                          <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                            Pending
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-text-secondary font-medium">No pending appointment requests</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel Appointment Modal */}
      {showCancelModal && selectedAppointmentForCancel && appointmentRules && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Cancel Appointment
              </h2>
              <p className="text-red-100 text-sm mt-2">Review cancellation policy before proceeding</p>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Appointment Details */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-2">Appointment Details</p>
                <p className="text-sm font-semibold text-gray-900">{selectedAppointmentForCancel.service}</p>
                <p className="text-xs text-gray-600 mt-1">{formatDate(selectedAppointmentForCancel.appointment_date)} at {selectedAppointmentForCancel.appointment_time}</p>
              </div>

              {/* Cancellation Rules */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cancellation Policy</p>
                
                {(() => {
                  const { fee, isWithinGracePeriod, isWithinCancellationWindow } = calculateCancellationFee(selectedAppointmentForCancel.appointment_date);

                  if (isWithinGracePeriod) {
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-green-900">✓ Within Grace Period</p>
                        <p className="text-xs text-green-700 mt-1">
                          You can cancel for free within {appointmentRules.grace_period_hours} hours of booking.
                        </p>
                        <p className="text-sm font-bold text-green-900 mt-2">Cancellation Fee: FREE</p>
                      </div>
                    );
                  }

                  if (isWithinCancellationWindow) {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm font-semibold text-yellow-900">⏱️ Cancellation Fee Applies</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          You are still within the {appointmentRules.cancellation_window_hours} hour cancellation window. A fee will be charged.
                        </p>
                        <p className="text-sm font-bold text-yellow-900 mt-2">Cancellation Fee: ₱{fee}</p>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-red-900">❌ Past Cancellation Window</p>
                      <p className="text-xs text-red-700 mt-1">
                        The cancellation window has passed. You can no longer cancel this appointment.
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Policy Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-900 uppercase mb-2">Policy Summary</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Cancel up to <span className="font-bold">{appointmentRules.cancellation_window_hours}h</span> before appointment</li>
                  {appointmentRules.grace_period_enabled && (
                    <li>• Free cancellation within <span className="font-bold">{appointmentRules.grace_period_hours}h</span> of booking</li>
                  )}
                  <li>• Late cancellation fee: <span className="font-bold">₱{appointmentRules.cancellation_fee_amount}</span></li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isCancelling}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling || (() => {
                    const { isWithinCancellationWindow } = calculateCancellationFee(selectedAppointmentForCancel.appointment_date);
                    return !isWithinCancellationWindow;
                  })()}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

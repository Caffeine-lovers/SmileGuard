'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuth } from '@smileguard/shared-hooks';
import StatCard from '@/components/dashboard/StatCard';
import AppointmentCard from '@/components/dashboard/AppointmentCard';
import ReschedAppointment from '@/components/appointments/ReschedAppointment';
import { getPatientAppointments, getDoctorName } from '@/lib/appointmentService';
import { calculateOutstandingBalance } from '@/lib/outstandingBalanceService';
import { fetchAppointmentRules, calculateCancellationFee } from '@/lib/appointmentRule';
import { getBillings } from '@/lib/paymentService';
import Link from 'next/link';
import type { Appointment, Billing } from '@/lib/database';
import type { AppointmentRule } from '@/lib/appointmentRule';

export default function PatientDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'pending'>('scheduled');
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [appointmentRules, setAppointmentRules] = useState<AppointmentRule | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointmentForReschedule, setSelectedAppointmentForReschedule] = useState<Appointment | null>(null);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [openPendingMenu, setOpenPendingMenu] = useState<string | null>(null);
  const [pendingMenuCoords, setPendingMenuCoords] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const loadAppointmentRules = async () => {
      const rules = await fetchAppointmentRules();
      setAppointmentRules(rules);
    };

    loadAppointmentRules();
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
      try {
        if (!currentUser?.id) return;
        const userId = currentUser.id;
        console.log("[PatientDashboard] Starting data fetch for user:", userId);
        const [appts, balance, billingData] = await Promise.all([
          getPatientAppointments(userId),
          calculateOutstandingBalance(userId),
          getBillings(userId),
        ]);
        console.log("[PatientDashboard] Data fetched successfully:", { appointmentsCount: appts.length, balance });
        
        // Filter only scheduled appointments and sort them by date (assuming they are returned in some order or need sorting)
        const scheduledAppts = appts.filter(apt =>
          apt.status === 'scheduled'
        );
        // Sort by date (ascending)
        scheduledAppts.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

        console.log("[PatientDashboard] Scheduled/Confirmed appointments:", scheduledAppts.length);
        setAppointments(scheduledAppts);
        setOutstandingBalance(balance);
        setBillings(billingData);
      } catch (err) {
        console.error('[PatientDashboard] Error fetching dashboard data:', err);
      }
    }

    fetchData();
  }, [currentUser, authLoading, router]);

  // Close pending menu when clicking outside
  useEffect(() => {
    if (!openPendingMenu) return;
    
    const handleOutsideClick = () => setOpenPendingMenu(null);
    
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('scroll', handleOutsideClick, true);
    window.addEventListener('resize', handleOutsideClick);
    
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleOutsideClick, true);
      window.removeEventListener('resize', handleOutsideClick);
    };
  }, [openPendingMenu]);

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
    console.log('[PatientDashboard] Cancel clicked for appointment:', {
      id: appointment.id,
      service: appointment.service,
      status: appointment.status,
      date: appointment.appointment_date,
    });

    if (!appointmentRules) {
      console.log('[PatientDashboard] No appointment rules, navigating to billing without fee calculation');
      router.push(`/billing?appointmentId=${appointment.id}&action=cancel`);
      return;
    }

    const { fee } = calculateCancellationFee(appointment, appointmentRules);
    console.log('[PatientDashboard] Calculated cancellation fee:', fee);
    
    const params = new URLSearchParams();
    params.append('appointmentId', appointment.id || '');
    params.append('action', 'cancel');
    params.append('cancellationFee', fee.toString());
    params.append('appointmentData', JSON.stringify({
      id: appointment.id,
      service: appointment.service,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
    }));
    
    console.log('[PatientDashboard] Navigating to billing with params:', {
      appointmentId: appointment.id,
      action: 'cancel',
      cancellationFee: fee,
      hasAppointmentData: true,
    });
    
    router.push(`/billing?${params.toString()}`);
  };

  const handleRescheduleClick = (appointment: Appointment) => {
    setSelectedAppointmentForReschedule(appointment);
    setShowRescheduleModal(true);
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

  const getAppointmentPaymentStatus = (appointmentId: string | undefined): 'paid' | 'pending' => {
    if (!appointmentId) return 'pending';
    const billing = billings.find(b => b.appointment_id === appointmentId);
    return billing?.payment_status === 'paid' ? 'paid' : 'pending';
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
                {scheduledAppointments.map((apt, index) => {
                  const paymentStatus = getAppointmentPaymentStatus(apt.id);
                  return (
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
                          paymentStatus={paymentStatus}
                          onCancel={() => handleCancelClick(apt)}
                        />
                      </div>
                    </div>
                  );
                })}
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
                {pendingAppointments.map((apt, index) => {
                  const paymentStatus = getAppointmentPaymentStatus(apt.id);
                  const isMenuOpen = openPendingMenu === apt.id;
                  
                  const toggleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    if (isMenuOpen) {
                      setOpenPendingMenu(null);
                      return;
                    }
                    const button = e.currentTarget;
                    const rect = button.getBoundingClientRect();
                    setPendingMenuCoords({
                      top: rect.bottom + window.scrollY + 4,
                      right: window.innerWidth - rect.right - window.scrollX
                    });
                    setOpenPendingMenu(apt.id || null);
                  };

                  return (
                    <div key={apt.id} className="flex gap-4 items-stretch">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 relative">
                          {index + 1}
                        </div>
                        {index < pendingAppointments.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1" />}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="bg-bg-notes rounded-xl p-4 border border-yellow-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded whitespace-nowrap">
                                  Request Pending
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  paymentStatus === 'paid'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {paymentStatus === 'paid' ? '✓ Paid' : 'Payment Pending'}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-text-primary mt-2">{apt.service}</p>
                              <p className="text-xs text-text-secondary mt-1">{formatDate(apt.appointment_date)} at {apt.appointment_time}</p>
                              {apt.notes && <p className="text-xs text-text-secondary mt-2 italic">Notes: {apt.notes}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={toggleMenu}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isMenuOpen ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>
                            
                            {isMenuOpen && typeof document !== 'undefined' && createPortal(
                              <div 
                                className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[140px] overflow-hidden"
                                style={{
                                  top: `${pendingMenuCoords.top}px`,
                                  right: `${pendingMenuCoords.right}px`,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRescheduleClick(apt);
                                    setOpenPendingMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-gray-100"
                                >
                                  Reschedule
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelClick(apt);
                                    setOpenPendingMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                >
                                  Cancel Request
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-text-secondary font-medium">No pending appointment requests</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reschedule Appointment Modal */}
      <ReschedAppointment
        isOpen={showRescheduleModal}
        appointment={selectedAppointmentForReschedule}
        appointmentRules={appointmentRules}
        onClose={() => {
          setShowRescheduleModal(false);
          setSelectedAppointmentForReschedule(null);
        }}
      />
    </div>
  );
}

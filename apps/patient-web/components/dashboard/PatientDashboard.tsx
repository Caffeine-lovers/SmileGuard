'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import StatCard from '@/components/dashboard/StatCard';
import AppointmentCard from '@/components/dashboard/AppointmentCard';
import { getPatientAppointments } from '@/lib/appointmentService';
import { calculateOutstandingBalance } from '@/lib/outstandingBalanceService';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';

export default function PatientDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);

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
          <h2 className="text-lg font-bold text-text-primary">Upcoming Scheduled Appointments</h2>
        </div>
        {appointments.length > 0 ? (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {appointments.map((apt, index) => (
              <div key={apt.id} className="flex gap-4 items-stretch">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0 z-10 relative">
                    {index + 1}
                  </div>
                  {index < appointments.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 my-1" />}
                </div>
                <div className="flex-1 pb-1">
                  <AppointmentCard
                    name="Your Doctor"
                    service={apt.service}
                    time={apt.appointment_time}
                    date={formatDate(apt.appointment_date)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-text-secondary font-medium">No upcoming appointments</p>
            <Link href="/appointments" className="text-brand-primary text-sm font-medium mt-2 inline-block hover:underline">
              Book your first appointment →
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}

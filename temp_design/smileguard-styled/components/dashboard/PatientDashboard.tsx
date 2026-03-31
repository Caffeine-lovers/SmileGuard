'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import StatCard from '@/components/dashboard/StatCard';
import AppointmentCard from '@/components/dashboard/AppointmentCard';
import { getPatientAppointments } from '@/lib/appointmentService';
import { getBalance } from '@/lib/paymentService';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';

export default function PatientDashboard() {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser === undefined) return; // still initializing

    if (!currentUser) {
      setLoading(false); // not logged in, stop spinner
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        const [appts, bal] = await Promise.all([
          getPatientAppointments(currentUser!.id),
          getBalance(currentUser!.id),
        ]);
        setAppointments(appts.slice(0, 5));
        setBalance(bal);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser?.id]);

  if (loading && !appointments.length && balance === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {/* FIX: border-blue-600 → border-brand-primary */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="p-4 md:p-6 bg-bg-screen min-h-screen max-w-5xl mx-auto">
      {/*
        FIX: bg-brand-cyan → bg-brand-primary
        Guidelines: brand-cyan (#29ABE2) is reserved for screen/page headings only.
        Large filled surfaces (hero banners, cards) use brand-primary (#3DAAB8).
      */}
      <div className="bg-brand-primary rounded-2xl p-8 mb-8 text-white shadow-sm">
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
        <StatCard icon="📋" number={appointments.length} label="Total Appointments" accent="border-brand-primary" />
        <StatCard icon="💳" number={`₱${balance.toFixed(2)}`} label="Outstanding Balance" accent="border-brand-primary" href="/billing" />
        <StatCard icon="📅" number={formatDate(appointments[0]?.appointment_date ?? '')} label="Next Appointment" accent="border-brand-primary" />
      </div>
    
      <div className="bg-bg-surface rounded-2xl shadow-sm border border-border-card p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-text-primary">Upcoming Appointments</h2>
        </div>
        {appointments.length > 0 ? (
          <div className="space-y-1">
            {appointments.map((apt, index) => (
              <div key={apt.id} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  {/*
                    FIX: bg-blue-100 text-blue-600 → bg-brand-primary/10 text-brand-primary
                    Off-brand blue replaced with the brand teal token.
                  */}
                  <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  {/* FIX: bg-gray-100 → bg-border-card (uses design token, not raw gray) */}
                  {index < appointments.length - 1 && <div className="w-0.5 h-full bg-border-card mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <AppointmentCard
                    name="Your Doctor"
                    service={apt.service}
                    time={apt.appointment_time}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">🗓️</p>
            <p className="text-text-secondary font-medium">No appointments yet</p>
            <Link href="/appointments" className="text-text-link text-sm font-medium mt-1 inline-block hover:underline">Book your first appointment →</Link>
          </div>
        )}
      </div>

    </div>
  );
}

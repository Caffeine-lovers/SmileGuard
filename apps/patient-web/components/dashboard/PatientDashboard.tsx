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
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'None scheduled') return 'None scheduled';
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="p-6 md:p-10 bg-slate-50 min-h-screen max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-4xl">🦷</div>
          <div>
            <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">Welcome back</p>
            <h1 className="text-3xl font-bold">{currentUser?.name}</h1>
            <p className="text-blue-100 text-sm mt-1">Your dental health is in good hands</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard icon="📋" number={appointments.length} label="Total Appointments" accent="border-blue-500" />
        <StatCard icon="💳" number={`₱${balance.toFixed(2)}`} label="Outstanding Balance" accent="border-emerald-500" />
        <StatCard icon="📅" number={formatDate(appointments[0]?.appointment_date ?? '')} label="Next Appointment" accent="border-violet-500" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-800">Upcoming Appointments</h2>
          <Link href="/appointments" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        {appointments.length > 0 ? (
          <div className="space-y-1">
            {appointments.map((apt, index) => (
              <div key={apt.id} className="flex gap-4 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  {index < appointments.length - 1 && <div className="w-0.5 h-full bg-gray-100 mt-1" />}
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
            <p className="text-gray-500 font-medium">No appointments yet</p>
            <Link href="/appointments" className="text-blue-600 text-sm font-medium mt-1 inline-block hover:underline">Book your first appointment →</Link>
          </div>
        )}
      </div>

    </div>
  );
}

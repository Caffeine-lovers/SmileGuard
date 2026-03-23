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
    if (!currentUser) return;

    async function fetchData() {
      setLoading(true);
      try {
        if (!currentUser) return;
        const [appts, bal] = await Promise.all([
          getPatientAppointments(currentUser.id),
          getBalance(currentUser.id),
        ]);
        setAppointments(appts.slice(0, 5)); // Show recent 5
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">
        Welcome, {currentUser?.name}!
      </h1>
      <p className="text-gray-600 mb-8">Your dental health dashboard</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard number={appointments.length} label="Appointments" />
        <StatCard number={`₱${balance.toFixed(2)}`} label="Outstanding Balance" />
        <StatCard number="3" label="Days Until Next Appointment" />
      </div>

      {/* Appointments Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Recent Appointments</h2>
          <Link
            href="/appointments"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All →
          </Link>
        </div>

        {appointments.length > 0 ? (
          <div>
            {appointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                name="Dr. Smith"
                service={apt.service}
                time={apt.appointment_time}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-600 py-4">No appointments scheduled yet.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/appointments"
          className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center font-medium transition"
        >
          📅 Book Now
        </Link>
        <Link
          href="/billing"
          className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-center font-medium transition"
        >
          💰 Pay Bill
        </Link>
        <Link
          href="/analysis"
          className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-center font-medium transition"
        >
          🦷 AI Analysis
        </Link>
        <Link
          href="/treatments"
          className="bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-lg text-center font-medium transition"
        >
          🔧 Treatments
        </Link>
      </div>
    </div>
  );
}

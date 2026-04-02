'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@smileguard/shared-hooks';
import Link from 'next/link';
import type { Appointment } from '@/lib/database';
import { getPatientAppointments } from '@/lib/appointmentService';

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  'no-show': 'bg-red-100 text-red-800',
  scheduled: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function TreatmentsPage() {
  const { currentUser, loading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;

    async function fetchTreatments() {
      setLoadingData(true);
      try {
        const appts = await getPatientAppointments(currentUser!.id);
        // Sort by appointment_date descending (most recent first)
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

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      completed: '✓',
      scheduled: '📅',
      'no-show': '✗',
      cancelled: '⊘',
    };
    return icons[status] || '•';
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Treatment History</h1>
        <p className="text-gray-600 mb-8">Track your dental appointments and treatments</p>

        <div className="space-y-4">
          {appointments.length > 0 ? (
            appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-l-4 border-blue-500"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{appointment.service}</h3>
                    <p className="text-gray-600">Appointment</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[appointment.status]}`}>
                    {getStatusIcon(appointment.status)} {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium text-gray-800">
                      {new Date(appointment.appointment_date).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-medium text-gray-800">{appointment.appointment_time || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Service Type</p>
                    <p className="font-medium text-gray-800">{appointment.service}</p>
                  </div>
                </div>

                {appointment.notes && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-semibold mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{appointment.notes}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500 mb-4">No treatment history yet</p>
              <Link href="/appointments" className="text-blue-600 hover:text-blue-700 font-medium">
                Book your first appointment →
              </Link>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

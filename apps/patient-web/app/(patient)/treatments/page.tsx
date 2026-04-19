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

    const userId = currentUser.id;

    async function fetchTreatments() {
      setLoadingData(true);
      try {
        const appts = await getPatientAppointments(userId);
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
    <div className="min-h-screen bg-bg-screen">
      <div className="max-w-2xl mx-auto p-4 md:p-6 md:pt-10">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">Treatment History</h1>
        <p className="text-sm text-text-secondary mb-8">Track your dental appointments and treatments</p>

        <div className="bg-bg-surface rounded-xl shadow-sm border border-border-card overflow-hidden">
          {appointments.length > 0 ? (
            <div className="divide-y divide-border-card">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-5 hover:bg-slate-50 transition-colors flex flex-col gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 w-2 h-10 rounded-full flex-shrink-0 ${
                      appointment.status === 'completed' ? 'bg-green-500' : 
                      appointment.status === 'scheduled' ? 'bg-blue-500' : 
                      appointment.status === 'no-show' ? 'bg-red-500' : 'bg-gray-400'
                    }`}></div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <h3 className="text-lg font-bold text-text-primary">{appointment.service}</h3>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusColors[appointment.status]}`}>
                          {getStatusIcon(appointment.status)} {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-text-secondary mt-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Date:</span>
                          <span className="text-text-primary">
                            {new Date(appointment.appointment_date).toLocaleDateString('en-PH', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="hidden sm:block w-1 h-1 rounded-full bg-border-active"></div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Time:</span> 
                          <span className="text-text-primary">{appointment.appointment_time || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="ml-6 bg-gray-50/80 rounded-md p-3 border border-blue-50/50">
                      <p className="text-[11px] text-text-secondary font-bold uppercase mb-1 tracking-wide">Doctor's Notes</p>
                      <p className="text-sm text-text-primary leading-relaxed">{appointment.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-text-secondary mb-3">No treatment history yet</p>
              <Link href="/appointments" className="text-brand-primary text-sm font-medium hover:underline">
                Book your first appointment →
              </Link>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-6">
          <Link href="/dashboard" className="text-brand-primary text-sm font-medium hover:underline flex items-center gap-1">
            <span>←</span> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

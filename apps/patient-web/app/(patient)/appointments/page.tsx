'use client';

import dynamic from 'next/dynamic';
import ScheduleBlockoutView from '@/components/appointments/ScheduleBlockoutView';

const BookAppointment = dynamic(
  () => import('@/components/appointments/BookAppointment'),
  { loading: () => <div className="p-8 text-center">Loading...</div> }
);

export default function AppointmentsPage() {
  return (
    <div className="min-h-screen bg-bg-screen">
      <div className="px-4 py-8">
        <div className="max-w-7xl mx-auto mb-8">
          <h1 className="text-[32px] font-bold leading-[32px] text-brand-primary mb-2">📅 Manage Appointments</h1>
          <p className="text-base leading-6 text-text-secondary">View your scheduled appointments and book new ones</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 px-2">
          {/* Appointments Sidebar (Left) - Compact View */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">
              <div className="bg-bg-surface rounded-card shadow-lg border border-border-card p-4">
                <h2 className="text-xl font-bold leading-[30px] text-text-primary mb-3">Upcoming</h2>
                <ScheduleBlockoutView compact />
              </div>
            </div>
          </div>

          {/* Book Appointment (Center) - Main Form */}
          <div className="lg:col-span-3">
            <div className="sticky top-8 shadow-lg rounded-card">
              <BookAppointment />
            </div>
          </div>

          {/* Empty space on right for balance */}
          <div className="lg:col-span-1" />
        </div>
      </div>
    </div>
  );
}

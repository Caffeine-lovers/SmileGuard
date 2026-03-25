'use client';

import dynamic from 'next/dynamic';

const BookAppointment = dynamic(
  () => import('@/components/appointments/BookAppointment'),
  { loading: () => <div className="p-8 text-center">Loading...</div> }
);

export default function AppointmentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Book an Appointment</h1>
        <p className="text-gray-600 mb-8">Schedule a visit with our dental professionals</p>
        <BookAppointment />
      </div>
    </div>
  );
}

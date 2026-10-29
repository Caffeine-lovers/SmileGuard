'use client';

import { useRouter } from 'next/navigation';
import BookAppointment from '@/components/appointments/BookAppointment';

export default function AppointmentsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-bg-screen">
      <div className="max-w-6xl mx-auto">
        <BookAppointment onSuccess={() => router.push('/dashboard')} />
      </div>
    </div>
  );
}

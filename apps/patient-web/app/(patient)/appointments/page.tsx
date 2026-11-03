'use client';

import { useRouter } from 'next/navigation';
import BookAppointment from '@/components/appointments/BookAppointment';

export default function AppointmentsPage() {
  const router = useRouter();

  return (
    <div className="py-4 sm:py-6">
      <BookAppointment onSuccess={() => router.push('/dashboard?tab=pending')} />
    </div>
  );
}

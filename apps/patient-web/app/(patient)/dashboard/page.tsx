'use client';

import dynamic from 'next/dynamic';

const PatientDashboard = dynamic(
  () => import('@/components/dashboard/PatientDashboard'),
  { loading: () => <div className="p-8 text-center">Loading...</div> }
);

export default function DashboardPage() {
  return <PatientDashboard />;
}

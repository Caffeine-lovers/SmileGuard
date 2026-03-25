'use client';

import Link from 'next/link';

interface Treatment {
  id: string;
  name: string;
  date: string;
  status: 'completed' | 'ongoing' | 'scheduled';
  dentist: string;
  notes: string;
}

const mockTreatments: Treatment[] = [
  {
    id: '1',
    name: 'Root Canal Treatment',
    date: '2024-01-15',
    status: 'completed',
    dentist: 'Dr. Maria Santos',
    notes: 'Successfully completed. Follow-up in 3 months.',
  },
  {
    id: '2',
    name: 'Teeth Whitening',
    date: '2024-02-20',
    status: 'ongoing',
    dentist: 'Dr. John Reyes',
    notes: 'Session 2 of 3. Results visible already.',
  },
  {
    id: '3',
    name: 'Cavity Filling',
    date: '2024-03-10',
    status: 'scheduled',
    dentist: 'Dr. Maria Santos',
    notes: 'Waiting for appointment confirmation.',
  },
];

const statusColors: Record<Treatment['status'], string> = {
  completed: 'bg-green-100 text-green-800',
  ongoing: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-yellow-100 text-yellow-800',
};

export default function TreatmentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Treatment History</h1>
        <p className="text-gray-600 mb-8">Track your dental treatments and progress</p>

        <div className="space-y-4">
          {mockTreatments.map((treatment) => (
            <div key={treatment.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">{treatment.name}</h3>
                  <p className="text-gray-600">by {treatment.dentist}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[treatment.status]}`}>
                  {treatment.status.charAt(0).toUpperCase() + treatment.status.slice(1)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium text-gray-800">{new Date(treatment.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{treatment.notes}</p>
              </div>
            </div>
          ))}
        </div>

        {mockTreatments.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500 mb-4">No treatments recorded yet</p>
            <Link href="/appointments" className="text-blue-600 hover:text-blue-700 font-medium">
              Book your first appointment →
            </Link>
          </div>
        )}

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

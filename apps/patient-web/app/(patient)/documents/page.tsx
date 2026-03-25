'use client';

import Link from 'next/link';

interface Document {
  id: string;
  name: string;
  type: 'xray' | 'prescription' | 'report' | 'insurance';
  date: string;
  size: string;
  dentist: string;
}

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'Panoramic X-Ray',
    type: 'xray',
    date: '2024-01-15',
    size: '2.4 MB',
    dentist: 'Dr. Maria Santos',
  },
  {
    id: '2',
    name: 'Post-Root Canal Report',
    type: 'report',
    date: '2024-01-15',
    size: '1.1 MB',
    dentist: 'Dr. Maria Santos',
  },
  {
    id: '3',
    name: 'Whitening Prescription',
    type: 'prescription',
    date: '2024-02-20',
    size: '0.8 MB',
    dentist: 'Dr. John Reyes',
  },
  {
    id: '4',
    name: 'Insurance Claim Form',
    type: 'insurance',
    date: '2024-02-15',
    size: '1.5 MB',
    dentist: 'Clinic Admin',
  },
];

const typeIcons: Record<Document['type'], string> = {
  xray: '🖼️',
  prescription: '📋',
  report: '📄',
  insurance: '📊',
};

const typeLabels: Record<Document['type'], string> = {
  xray: 'X-Ray',
  prescription: 'Prescription',
  report: 'Report',
  insurance: 'Insurance',
};

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Medical Documents</h1>
        <p className="text-gray-600 mb-8">View and download your dental records</p>

        <div className="space-y-3">
          {mockDocuments.map((doc) => (
            <div key={doc.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="text-3xl">{typeIcons[doc.type]}</div>
                <div>
                  <h3 className="font-semibold text-gray-800">{doc.name}</h3>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>{typeLabels[doc.type]}</span>
                    <span>•</span>
                    <span>{new Date(doc.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">by {doc.dentist}</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                Download
              </button>
            </div>
          ))}
        </div>

        {mockDocuments.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500 mb-4">No documents available yet</p>
            <p className="text-sm text-gray-600">Your dental records and reports will appear here</p>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
          <p className="font-semibold mb-2">Need help?</p>
          <p>
            Your medical documents are securely stored and encrypted. You can download them anytime for your personal records or
            to share with other healthcare providers.
          </p>
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

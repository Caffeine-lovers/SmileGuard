'use client';

import Link from 'next/link';
import { Image as ImageIcon, FileText, FileSpreadsheet, ShieldCheck, Download, ArrowLeft } from 'lucide-react';

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

const typeLabels: Record<Document['type'], string> = {
  xray: 'Diagnostic X-Ray',
  prescription: 'Medical Prescription',
  report: 'Clinical Report',
  insurance: 'Insurance Claim',
};

function getDocIcon(type: Document['type']) {
  switch (type) {
    case 'xray':
      return <ImageIcon className="w-5 h-5 text-emerald-700" />;
    case 'prescription':
      return <FileText className="w-5 h-5 text-emerald-700" />;
    case 'report':
      return <FileSpreadsheet className="w-5 h-5 text-emerald-700" />;
    case 'insurance':
      return <ShieldCheck className="w-5 h-5 text-emerald-700" />;
  }
}

export default function DocumentsPage() {
  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 rounded-sm p-4 sm:p-6 text-white border-2 border-emerald-950 shadow-md">
        <span className="skeuo-badge skeuo-badge-mint text-[9px] sm:text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400 mb-2">
          <ShieldCheck className="w-3 h-3 text-emerald-950" />
          Encrypted Medical Records
        </span>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight">Clinical Documents</h1>
        <p className="text-emerald-100 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5">
          Secure diagnostic images, prescriptions & treatment reports
        </p>
      </div>

      <div className="skeuo-panel p-3.5 sm:p-6 border-2 border-slate-300 space-y-2.5 sm:space-y-3">
        {mockDocuments.map((doc) => (
          <div
            key={doc.id}
            className="skeuo-card p-3 sm:p-4 rounded-sm border-2 border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
          >
            <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 flex-1 min-w-0 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-sm bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0">
                {getDocIcon(doc.type)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{doc.name}</h3>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">
                  <span className="font-bold text-emerald-700 uppercase text-[9px] sm:text-[10px]">{typeLabels[doc.type]}</span>
                  <span>•</span>
                  <span className="font-mono">{new Date(doc.date).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className="font-mono">{doc.size}</span>
                  <span className="hidden xs:inline">•</span>
                  <span className="hidden xs:inline">Attending: {doc.dentist}</span>
                </div>
              </div>
            </div>

            <button className="skeuo-btn-secondary px-3 py-1.5 text-xs uppercase tracking-wider shrink-0 self-end sm:self-auto">
              <Download className="w-3.5 h-3.5 text-slate-700" />
              <span>Export</span>
            </button>
          </div>
        ))}
      </div>

      {/* Info Notice */}
      <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-sm text-xs text-emerald-900 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold uppercase tracking-wide">HIPAA-Compliant Diagnostic Storage</p>
          <p className="mt-0.5 text-emerald-800">
            All files are end-to-end encrypted. Documents remain accessible indefinitely for subsequent consultations and dental transfers.
          </p>
        </div>
      </div>

      <div>
        <Link href="/dashboard" className="skeuo-btn-secondary py-2 px-4 text-xs uppercase tracking-wider">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

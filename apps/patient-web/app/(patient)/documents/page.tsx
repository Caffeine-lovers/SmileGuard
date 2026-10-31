'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Image as ImageIcon, 
  FileText, 
  FileSpreadsheet, 
  ShieldCheck, 
  Download, 
  ArrowLeft, 
  Eye, 
  X, 
  CheckCircle2, 
  FileCheck2,
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: 'xray' | 'prescription' | 'report' | 'insurance';
  ownership: 'patient' | 'clinic';
  date: string;
  size: string;
  dentist: string;
  claimNumber?: string;
  hmoProvider?: string;
}

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'Panoramic Digital X-Ray (Full Arch)',
    type: 'xray',
    ownership: 'patient',
    date: '2024-01-15',
    size: '2.4 MB',
    dentist: 'Dr. Maria Santos',
  },
  {
    id: '2',
    name: 'Post-Root Canal Treatment Clinical Record',
    type: 'report',
    ownership: 'clinic',
    date: '2024-01-15',
    size: '1.1 MB',
    dentist: 'Dr. Maria Santos',
  },
  {
    id: '3',
    name: 'Post-Op Antibiotics & Whitening Prescription',
    type: 'prescription',
    ownership: 'patient',
    date: '2024-02-20',
    size: '0.8 MB',
    dentist: 'Dr. John Reyes',
  },
  {
    id: '4',
    name: 'PhilHealth Dental Claim Form (CF-2)',
    type: 'insurance',
    ownership: 'patient',
    date: '2024-02-15',
    size: '1.5 MB',
    dentist: 'Clinic Admin & Dr. Kyler',
    claimNumber: 'PH-2024-098821',
    hmoProvider: 'PhilHealth (Philippine Health Insurance Corporation)',
  },
];

const typeLabels: Record<Document['type'], string> = {
  xray: 'Diagnostic Radiograph',
  prescription: 'Medical Prescription',
  report: 'Clinical Chart Record',
  insurance: 'Insurance Claim Document',
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
      return <FileCheck2 className="w-5 h-5 text-emerald-700" />;
  }
}

// Official PhilHealth Emblem SVG Component
function PhilHealthLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} relative flex items-center justify-center shrink-0`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs">
        <circle cx="50" cy="50" r="48" fill="#008751" stroke="#FFD700" strokeWidth="4" />
        <circle cx="50" cy="50" r="41" fill="#FFFFFF" />
        {/* Yellow sunburst rays */}
        <path d="M50 15 L50 25 M50 75 L50 85 M15 50 L25 50 M75 50 L85 50 M25 25 L32 32 M68 68 L75 75 M25 75 L32 68 M68 32 L75 25" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" />
        {/* Green Health Cross */}
        <rect x="42" y="28" width="16" height="44" rx="2" fill="#008751" />
        <rect x="28" y="42" width="44" height="16" rx="2" fill="#008751" />
        {/* Center Golden Caduceus / Tooth Emblem */}
        <circle cx="50" cy="50" r="7" fill="#FFD700" />
      </svg>
    </div>
  );
}

export default function DocumentsPage() {
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const handleDownload = (doc: Document) => {
    alert(`Preparing download for "${doc.name}" (${doc.size}). Your file is encrypted under RA 10173 standards.`);
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 rounded-sm p-4 sm:p-6 text-white border-2 border-emerald-950 shadow-md">
        <span className="skeuo-badge skeuo-badge-mint text-[9px] sm:text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400 mb-2">
          <ShieldCheck className="w-3 h-3 text-emerald-950" />
          RA 10173 Sensitive Health Records
        </span>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight">Clinical Documents & Claims</h1>
        <p className="text-emerald-100 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5">
          Philippine Health Insurance claims, diagnostic radiographs & clinical prescriptions
        </p>
      </div>

      {/* Documents List */}
      <div className="skeuo-panel p-3.5 sm:p-6 border-2 border-slate-300 space-y-2.5 sm:space-y-3">
        {mockDocuments.map((doc) => (
          <div
            key={doc.id}
            onClick={() => setSelectedDoc(doc)}
            className="skeuo-card p-3 sm:p-4 rounded-sm border-2 border-slate-300 hover:border-emerald-500 hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
          >
            <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 flex-1 min-w-0 w-full">
              {doc.type === 'insurance' ? (
                <PhilHealthLogo className="w-10 h-10 sm:w-11 sm:h-11" />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-sm bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0 group-hover:bg-emerald-100 transition">
                  {getDocIcon(doc.type)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-800 transition">
                    {doc.name}
                  </h3>
                  {doc.ownership === 'patient' ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Patient Diagnostic Copy
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs bg-slate-200 text-slate-800 border border-slate-300">
                      Clinic Official Record
                    </span>
                  )}
                  {doc.type === 'insurance' && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-xs bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      PhilHealth Accredited
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 mt-1 font-medium">
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

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDoc(doc);
                }}
                className="skeuo-btn-secondary px-2.5 py-1.5 text-xs uppercase tracking-wider flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-slate-700" />
                <span>View</span>
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(doc);
                }}
                className="skeuo-btn-primary px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span>Export</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Regulatory Compliance & Data Privacy Notice */}
      <div className="p-4 sm:p-5 bg-emerald-50/70 border-2 border-emerald-400 rounded-sm text-xs text-emerald-950 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
          <h4 className="font-black uppercase tracking-wider text-emerald-900">
            Philippine RA 10173 & Healthcare Privacy Compliance
          </h4>
        </div>
        <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
          <strong>Republic Act No. 10173 (Data Privacy Act of 2012):</strong> All dental charts, intra-oral radiographs, and medical treatment records are legally classified as Sensitive Personal Health Information (SPHI). In compliance with Philippine National Privacy Commission (NPC) circulars and HIPAA standards, all documents are end-to-end encrypted with zero unauthorized third-party disclosure.
        </p>
      </div>

      <div>
        <Link href="/dashboard" className="skeuo-btn-secondary py-2 px-4 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>

      {/* Document Preview & Claim Details Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="skeuo-panel max-w-lg w-full p-5 sm:p-6 border-2 border-slate-300 relative bg-white">
            <button
              onClick={() => setSelectedDoc(null)}
              className="absolute top-4 right-4 p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Insurance Claim Form with Authentic Logo */}
            {selectedDoc.type === 'insurance' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 pb-3 border-b-2 border-slate-200">
                  <PhilHealthLogo className="w-14 h-14" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300">
                      Official Claim Document
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1">
                      {selectedDoc.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Republic of the Philippines • Department of Health</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Provider:</span>
                    <span className="font-bold text-slate-900">{selectedDoc.hmoProvider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Claim Reference No:</span>
                    <span className="font-mono font-bold text-emerald-800">{selectedDoc.claimNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Filing Date:</span>
                    <span className="font-bold text-slate-900">{new Date(selectedDoc.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Document Ownership:</span>
                    <span className="font-bold text-emerald-700">Patient Diagnostic Copy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Attending Dental Surgeon:</span>
                    <span className="font-bold text-slate-900">{selectedDoc.dentist}</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-[11px] text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Authenticated PhilHealth Claim ready for reimbursement or clinic presentation.</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-200">
                  <div className="w-12 h-12 rounded-sm bg-emerald-100 border border-emerald-400 flex items-center justify-center shrink-0">
                    {getDocIcon(selectedDoc.type)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-300">
                      {selectedDoc.ownership === 'patient' ? 'Patient Copy' : 'Official Clinic Record'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1">
                      {selectedDoc.name}
                    </h3>
                    <p className="text-xs text-slate-500">{typeLabels[selectedDoc.type]}</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date Generated:</span>
                    <span className="font-bold text-slate-900">{new Date(selectedDoc.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">File Size:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedDoc.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Issued by:</span>
                    <span className="font-bold text-slate-900">{selectedDoc.dentist}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ownership Type:</span>
                    <span className="font-bold text-slate-900">
                      {selectedDoc.ownership === 'patient' 
                        ? 'Patient Diagnostic Copy (Exportable)' 
                        : 'Official Clinic Archive (View-Only Record)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-2.5 pt-4 border-t border-slate-200 mt-4">
              <button
                type="button"
                onClick={() => handleDownload(selectedDoc)}
                className="flex-1 skeuo-btn-primary py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export PDF / DICOM</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

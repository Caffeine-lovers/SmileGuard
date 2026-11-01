'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileCheck2,
  ShieldCheck,
  Download,
  ArrowLeft,
  Eye,
  X,
  Receipt,
  ScanLine,
  IdCard,
  ClipboardList,
  UploadCloud,
  Trash2,
  Printer,
} from 'lucide-react';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import type { Appointment, Billing } from '@/lib/database';
import { getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';
import { getIdCredentialUrl } from '@/lib/idCredentials';
import { listScans, summarizeFindings, formatCondition, type ScanRecord } from '@/lib/scanHistory';
import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORY_LABELS,
  deletePatientDocument,
  formatBytes,
  getDocumentUrl,
  listPatientDocuments,
  printRecord,
  uploadPatientDocument,
  validateDocumentFile,
  type DocumentCategory,
  type PatientDocument,
} from '@/lib/patientDocuments';

type Kind = 'upload' | 'scan' | 'receipt' | 'id' | 'intake';

interface DocItem {
  key: string;
  kind: Kind;
  title: string;
  subtitle: string;
  date: string;
  upload?: PatientDocument;
  scan?: ScanRecord;
  receipt?: { billing: Billing; appointment?: Appointment };
  intake?: Record<string, any>;
  idCredential?: { pwd_id_path?: string | null; pwd_id_url?: string | null };
}

const KIND_LABELS: Record<Kind, string> = {
  upload: 'Uploaded File',
  scan: 'AI Scan Report',
  receipt: 'Payment Receipt',
  id: 'PWD / Senior ID',
  intake: 'Medical Intake Form',
};

function KindIcon({ item }: { item: DocItem }) {
  const cls = 'w-5 h-5 text-emerald-700';
  if (item.kind === 'scan') return <ScanLine className={cls} />;
  if (item.kind === 'receipt') return <Receipt className={cls} />;
  if (item.kind === 'id') return <IdCard className={cls} />;
  if (item.kind === 'intake') return <ClipboardList className={cls} />;
  switch (item.upload?.category) {
    case 'xray':
      return <ImageIcon className={cls} />;
    case 'report':
      return <FileSpreadsheet className={cls} />;
    case 'insurance':
      return <FileCheck2 className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

const peso = (n?: number | null) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INTAKE_FIELDS: [string, string][] = [
  ['date_of_birth', 'Date of birth'],
  ['gender', 'Gender'],
  ['phone', 'Phone'],
  ['address', 'Address'],
  ['emergency_contact_name', 'Emergency contact'],
  ['emergency_contact_phone', 'Emergency contact phone'],
  ['allergies', 'Allergies'],
  ['current_medications', 'Current medications'],
  ['medical_conditions', 'Medical conditions'],
  ['past_surgeries', 'Past surgeries'],
  ['smoking_status', 'Smoking status'],
  ['pregnancy_status', 'Pregnancy status'],
];

function receiptRows(r: NonNullable<DocItem['receipt']>): [string, string][] {
  const b = r.billing;
  return [
    ['Service', r.appointment?.service || '—'],
    ['Appointment date', r.appointment ? `${r.appointment.appointment_date} ${r.appointment.appointment_time || ''}` : '—'],
    ['Clinic', r.appointment?.clinic_name || '—'],
    ['Procedure fee', peso(b.amount)],
    ['Discount', b.discount_amount ? `${peso(b.discount_amount)} (${(b.discount_type || '').toUpperCase()})` : 'None'],
    ['Amount paid', peso(b.final_amount)],
    ['Payment method', (b.payment_method || '—').replace('_', ' ')],
    ['PayMongo reference', b.gateway_transaction_id || '—'],
    ['Payment date', b.payment_date ? new Date(b.payment_date).toLocaleString() : '—'],
  ];
}

export default function DocumentsPage() {
  const { currentUser } = useAuth();
  const patientId = currentUser?.id;

  const [items, setItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<DocItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Kind>('all');

  // Upload form
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('xray');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    const errors: string[] = [];
    const settle = async <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await p;
      } catch (e) {
        console.warn(`[Documents] ${label}:`, e);
        errors.push(label);
        return fallback;
      }
    };

    const [uploads, scans, billings, appointments, intakeRes, profileRes] = await Promise.all([
      settle('uploaded files', listPatientDocuments(patientId), [] as PatientDocument[]),
      settle('AI scans', listScans(patientId), [] as ScanRecord[]),
      settle('payment receipts', getBillings(patientId), [] as Billing[]),
      settle('appointments', getPatientAppointments(patientId), [] as Appointment[]),
      settle('medical intake', Promise.resolve(supabase.from('medical_intake').select('*').eq('patient_id', patientId).maybeSingle()), { data: null } as any),
      settle('ID verification', Promise.resolve(supabase.from('profiles').select('pwd_id_path, pwd_id_url, pwd_type, pwd_status, pwd_submitted_at').eq('id', patientId).maybeSingle()), { data: null } as any),
    ]);

    const aptById = new Map((appointments || []).map((a) => [a.id, a]));
    const list: DocItem[] = [];

    for (const u of uploads) {
      list.push({
        key: `upload-${u.id}`,
        kind: 'upload',
        title: u.name,
        subtitle: `${DOCUMENT_CATEGORY_LABELS[u.category] || 'Document'} • ${formatBytes(u.size_bytes)}`,
        date: u.created_at,
        upload: u,
      });
    }
    for (const s of scans) {
      const findings = summarizeFindings(s.detections);
      list.push({
        key: `scan-${s.id}`,
        kind: 'scan',
        title: 'AI Oral Screening Report',
        subtitle: findings.length ? `${s.detection_count} finding(s): ${findings.join(', ')}` : 'No issues detected',
        date: s.created_at,
        scan: s,
      });
    }
    for (const b of billings.filter((x) => x.payment_status === 'paid')) {
      const apt = b.appointment_id ? aptById.get(b.appointment_id) : undefined;
      list.push({
        key: `receipt-${b.id}`,
        kind: 'receipt',
        title: `Receipt — ${apt?.service || 'Dental service'}`,
        subtitle: `${peso(b.final_amount)} • ${(b.payment_method || 'online').replace('_', ' ')}`,
        date: b.payment_date || b.updated_at || b.created_at || new Date().toISOString(),
        receipt: { billing: b, appointment: apt },
      });
    }
    const intake = intakeRes?.data;
    if (intake) {
      list.push({
        key: 'intake',
        kind: 'intake',
        title: 'Medical Intake Form',
        subtitle: 'Allergies, medications & medical history you submitted',
        date: intake.updated_at || intake.created_at,
        intake,
      });
    }
    const profile = profileRes?.data;
    if (profile?.pwd_id_path || profile?.pwd_id_url) {
      list.push({
        key: 'pwd-id',
        kind: 'id',
        title: `${profile.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} ID`,
        subtitle: `Verification status: ${profile.pwd_status || 'pending'}`,
        date: profile.pwd_submitted_at || new Date().toISOString(),
        idCredential: { pwd_id_path: profile.pwd_id_path, pwd_id_url: profile.pwd_id_url },
      });
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(list);
    setLoadErrors(errors);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kind === filter)), [items, filter]);
  const counts = useMemo(() => {
    const c: Partial<Record<Kind, number>> = {};
    for (const i of items) c[i.kind] = (c[i.kind] || 0) + 1;
    return c;
  }, [items]);

  const openItem = async (item: DocItem) => {
    setSelected(item);
    setPreviewUrl(null);
    if (item.kind === 'upload' && item.upload) {
      try {
        setPreviewUrl(await getDocumentUrl(item.upload));
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Could not open document.');
      }
    } else if (item.kind === 'scan') {
      setPreviewUrl(item.scan?.imageUrl || null);
    } else if (item.kind === 'id' && item.idCredential) {
      try {
        setPreviewUrl(await getIdCredentialUrl(item.idCredential));
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Could not open your ID.');
      }
    }
  };

  const exportItem = async (item: DocItem) => {
    try {
      if (item.kind === 'upload' && item.upload) {
        window.open(await getDocumentUrl(item.upload, true), '_blank', 'noopener');
      } else if (item.kind === 'scan' && item.scan) {
        printRecord(
          `AI Oral Screening Report — ${new Date(item.scan.created_at).toLocaleString()}`,
          [
            ['Model', item.scan.model],
            ['Findings', String(item.scan.detection_count)],
            ...item.scan.detections.map((d, i) => [`Finding ${i + 1}`, `${formatCondition(d.class_name)} (${(d.confidence * 100).toFixed(1)}% confidence)`] as [string, string]),
          ],
          'Pre-diagnostic AI screening only. Please consult your dentist for a professional diagnosis.'
        );
      } else if (item.kind === 'receipt' && item.receipt) {
        printRecord('Official Payment Receipt', receiptRows(item.receipt), 'Payment processed securely via PayMongo.');
      } else if (item.kind === 'intake' && item.intake) {
        printRecord('Medical Intake Form', INTAKE_FIELDS.map(([k, label]) => [label, String(item.intake![k] ?? '')]));
      } else if (item.kind === 'id' && item.idCredential) {
        const url = await getIdCredentialUrl(item.idCredential);
        if (url) window.open(url, '_blank', 'noopener');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not export this record.');
    }
  };

  const handleDelete = async (item: DocItem) => {
    if (!item.upload || !confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await deletePatientDocument(item.upload);
      setSelected(null);
      setItems((prev) => prev.filter((i) => i.key !== item.key));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete document.');
    }
  };

  const handleFileChange = (f: File | null) => {
    setUploadError(null);
    setFile(f);
    if (f) {
      const problem = validateDocumentFile(f);
      if (problem) setUploadError(problem);
      if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    if (!patientId || !file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadPatientDocument({ patientId, file, name: docName, category });
      setFile(null);
      setDocName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const FILTERS: ('all' | Kind)[] = ['all', 'upload', 'scan', 'receipt', 'intake', 'id'];

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 rounded-sm p-4 sm:p-6 text-white border-2 border-emerald-950 shadow-md">
        <span className="skeuo-badge skeuo-badge-mint text-[9px] sm:text-[10px] text-emerald-950 bg-emerald-300 border-emerald-400 mb-2">
          <ShieldCheck className="w-3 h-3 text-emerald-950" />
          RA 10173 Sensitive Health Records
        </span>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight">My Documents & Records</h1>
        <p className="text-emerald-100 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mt-0.5">
          Your uploads, AI scan reports, payment receipts and submitted forms in one place
        </p>
      </div>

      {/* Upload */}
      <div className="skeuo-panel p-3.5 sm:p-5 border-2 border-slate-300 space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-emerald-700" /> Upload a document
        </h2>
        <p className="text-[11px] text-slate-500">X-rays, prescriptions, reports or insurance forms from any clinic. PDF, JPG, PNG or WEBP up to 10 MB. Only you and your dentist can see them.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_DOCUMENT_TYPES.join(',')}
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-emerald-100 file:text-emerald-800 file:font-bold"
          />
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="Document name"
            maxLength={120}
            className="skeuo-input px-2.5 py-1.5 text-xs"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className="skeuo-input px-2.5 py-1.5 text-xs">
            {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {uploadError && <p className="text-[11px] text-red-700 font-semibold">{uploadError}</p>}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || !!uploadError || uploading}
          className="skeuo-btn-primary px-4 py-1.5 text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-sm border text-[10px] font-bold uppercase tracking-wider ${
              filter === f ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-400'
            }`}
          >
            {f === 'all' ? `All (${items.length})` : `${KIND_LABELS[f]} (${counts[f] || 0})`}
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="skeuo-panel p-3.5 sm:p-6 border-2 border-slate-300 space-y-2.5 sm:space-y-3">
        {loadErrors.length > 0 && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-300 rounded-sm p-2">
            Some records could not be loaded ({loadErrors.join(', ')}). Try refreshing the page.
          </p>
        )}
        {loading ? (
          <p className="text-xs text-slate-500 p-4 text-center">Loading your records…</p>
        ) : visible.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-sm text-slate-500 text-center border-2 border-dashed border-slate-300 text-xs font-bold uppercase tracking-wider">
            {filter === 'all' ? 'No documents yet. Upload a file, run an AI scan or complete a payment to see records here.' : 'Nothing in this category yet.'}
          </div>
        ) : (
          visible.map((item) => (
            <div
              key={item.key}
              onClick={() => openItem(item)}
              className="skeuo-card p-3 sm:p-4 rounded-sm border-2 border-slate-300 hover:border-emerald-500 hover:shadow-xs transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
            >
              <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 flex-1 min-w-0 w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-sm bg-emerald-50 border border-emerald-300 flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0 group-hover:bg-emerald-100 transition">
                  <KindIcon item={item} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-800 transition truncate">{item.title}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {KIND_LABELS[item.kind]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500 mt-1 font-medium">
                    <span className="font-mono">{new Date(item.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="truncate">{item.subtitle}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openItem(item);
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
                    exportItem(item);
                  }}
                  className="skeuo-btn-primary px-3 py-1.5 text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  {item.kind === 'upload' ? <Download className="w-3.5 h-3.5 text-white" /> : <Printer className="w-3.5 h-3.5 text-white" />}
                  <span>{item.kind === 'upload' ? 'Download' : 'Print / PDF'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Data Privacy Notice */}
      <div className="p-4 sm:p-5 bg-emerald-50/70 border-2 border-emerald-400 rounded-sm text-xs text-emerald-950 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
          <h4 className="font-black uppercase tracking-wider text-emerald-900">Philippine RA 10173 & Healthcare Privacy</h4>
        </div>
        <p className="text-slate-700 leading-relaxed text-[11px] sm:text-xs">
          <strong>Republic Act No. 10173 (Data Privacy Act of 2012):</strong> dental charts, radiographs and treatment records are Sensitive Personal
          Information. Your files are stored privately and are only accessible to you and your attending dentist through short-lived secure links.
        </p>
      </div>

      <div>
        <Link href="/dashboard" className="skeuo-btn-secondary py-2 px-4 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="skeuo-panel max-w-2xl w-full p-5 sm:p-6 border-2 border-slate-300 relative bg-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" title="Close">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-200">
              <div className="w-12 h-12 rounded-sm bg-emerald-100 border border-emerald-400 flex items-center justify-center shrink-0">
                <KindIcon item={selected} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-300">
                  {KIND_LABELS[selected.kind]}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1 break-words">{selected.title}</h3>
                <p className="text-xs text-slate-500">{new Date(selected.date).toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(selected.kind === 'upload' || selected.kind === 'scan' || selected.kind === 'id') &&
                (previewUrl ? (
                  selected.upload?.mime_type === 'application/pdf' ? (
                    <iframe src={previewUrl} title={selected.title} className="w-full h-[60vh] border border-slate-300 rounded-sm" />
                  ) : (
                    <img src={previewUrl} alt={selected.title} className="w-full border border-slate-300 rounded-sm" />
                  )
                ) : (
                  <p className="text-xs text-slate-500">Loading preview…</p>
                ))}

              {selected.kind === 'scan' && selected.scan && (
                <ul className="space-y-1.5 text-xs">
                  {selected.scan.detections.length === 0 ? (
                    <li className="text-emerald-700 font-semibold">No issues detected in this scan.</li>
                  ) : (
                    selected.scan.detections.map((d, i) => (
                      <li key={i} className="flex justify-between border-b border-slate-100 pb-1">
                        <span className="font-semibold text-slate-800">{formatCondition(d.class_name)}</span>
                        <span className="font-mono text-slate-600">{(d.confidence * 100).toFixed(1)}%</span>
                      </li>
                    ))
                  )}
                </ul>
              )}

              {(selected.kind === 'receipt' || selected.kind === 'intake') && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-2 text-xs">
                  {(selected.kind === 'receipt' && selected.receipt
                    ? receiptRows(selected.receipt)
                    : INTAKE_FIELDS.map(([k, label]) => [label, String(selected.intake?.[k] ?? '')] as [string, string])
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-slate-500 shrink-0">{label}:</span>
                      <span className="font-bold text-slate-900 text-right break-words">{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-4 border-t border-slate-200 mt-4">
              <button
                type="button"
                onClick={() => exportItem(selected)}
                className="flex-1 skeuo-btn-primary py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                {selected.kind === 'upload' ? <Download className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
                <span>{selected.kind === 'upload' ? 'Download' : 'Print / Save as PDF'}</span>
              </button>
              {selected.kind === 'upload' && selected.upload?.uploaded_by === patientId && (
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 text-xs font-bold uppercase tracking-wider rounded-sm transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
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

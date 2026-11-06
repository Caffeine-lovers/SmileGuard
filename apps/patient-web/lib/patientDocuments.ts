import { supabase } from '@smileguard/supabase-client';

import {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORY_LABELS,
  MAX_DOCUMENT_BYTES,
  formatBytes,
  safeFileName,
  validateDocumentFile,
  type DocumentCategory,
} from './documentUtils';

export {
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_CATEGORY_LABELS,
  MAX_DOCUMENT_BYTES,
  formatBytes,
  safeFileName,
  validateDocumentFile,
  type DocumentCategory,
};

export const DOCUMENTS_BUCKET = 'patient-documents';

export interface PatientDocument {
  id: string;
  patient_id: string;
  uploaded_by: string | null;
  name: string;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export async function listPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const { data, error } = await supabase
    .from('patient_documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as PatientDocument[];
}

export async function uploadPatientDocument(params: {
  patientId: string;
  file: File;
  name: string;
  category: DocumentCategory;
}): Promise<PatientDocument> {
  const problem = validateDocumentFile(params.file);
  if (problem) throw new Error(problem);

  const path = `${params.patientId}/${Date.now()}_${safeFileName(params.file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, params.file, { contentType: params.file.type, upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error } = await supabase
    .from('patient_documents')
    .insert({
      patient_id: params.patientId,
      uploaded_by: params.patientId,
      name: params.name.trim() || params.file.name,
      category: params.category,
      storage_path: path,
      mime_type: params.file.type,
      size_bytes: params.file.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]); // don't leave orphaned files
    throw new Error(`Could not save document: ${error.message}`);
  }
  return data as PatientDocument;
}

export async function getDocumentUrl(doc: Pick<PatientDocument, 'storage_path'>, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 10, download ? { download: true } : undefined);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open document.');
  return data.signedUrl;
}

export async function deletePatientDocument(doc: Pick<PatientDocument, 'id' | 'storage_path'>): Promise<void> {
  const { error } = await supabase.from('patient_documents').delete().eq('id', doc.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
}

/** Open a printable record in a new tab (patients use "Save as PDF" from the print dialog). */
export function printRecord(title: string, rows: [string, string][], footer?: string): void {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) {
    alert('Please allow pop-ups to print or save this record.');
    return;
  }
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;margin:40px}
h1{font-size:20px;margin:0 0 4px}p.sub{color:#475569;font-size:12px;margin:0 0 24px}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
td:first-child{color:#475569;width:40%}footer{margin-top:24px;font-size:11px;color:#64748b}</style></head>
<body><h1>${esc(title)}</h1><p class="sub">SmileGuard · generated ${esc(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</p>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v || '—')}</td></tr>`).join('')}</table>
${footer ? `<footer>${esc(footer)}</footer>` : ''}
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

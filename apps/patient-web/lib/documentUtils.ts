// Pure helpers for patient documents (no Supabase imports — safe to unit test).

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // keep in sync with the bucket limit (migration 037)

export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export type DocumentCategory = 'xray' | 'prescription' | 'report' | 'insurance' | 'other';

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  xray: 'X-Ray / Radiograph',
  prescription: 'Prescription',
  report: 'Clinical Report',
  insurance: 'Insurance / HMO / PhilHealth',
  other: 'Other',
};

export function validateDocumentFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return 'Only PDF, JPG, PNG or WEBP files can be uploaded.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'Files must be 10 MB or smaller.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

export function safeFileName(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
  return cleaned.slice(-100) || 'document';
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

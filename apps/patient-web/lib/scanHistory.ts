import { supabase } from '@smileguard/supabase-client';
import { buildScanPath, formatCondition, summarizeFindings, type ScanDetection } from './scanUtils';

export { buildScanPath, formatCondition, summarizeFindings, type ScanDetection };

export const SCAN_BUCKET = 'Analyzed images';

export interface ScanRecord {
  id: string;
  patient_id: string;
  image_path: string | null;
  detections: ScanDetection[];
  detection_count: number;
  model: string;
  confidence_threshold: number | null;
  created_at: string;
  /** Short-lived signed URL for the annotated image (private bucket). */
  imageUrl?: string | null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Upload the annotated image and record the scan. Returns the saved record (or throws). */
export async function saveScan(params: {
  patientId: string;
  annotatedImageB64?: string;
  detections: ScanDetection[];
  model?: string;
  confidenceThreshold?: number;
}): Promise<ScanRecord> {
  let imagePath: string | null = null;

  if (params.annotatedImageB64) {
    const path = buildScanPath(params.patientId);
    const { error: uploadError } = await supabase.storage
      .from(SCAN_BUCKET)
      .upload(path, base64ToBytes(params.annotatedImageB64), { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw new Error(`Could not save scan image: ${uploadError.message}`);
    imagePath = path;
  }

  const { data, error } = await supabase
    .from('analysis_results')
    .insert({
      patient_id: params.patientId,
      image_path: imagePath,
      detections: params.detections,
      model: params.model || 'yolov8m',
      confidence_threshold: params.confidenceThreshold ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Could not save scan record: ${error.message}`);
  return data as ScanRecord;
}

/** Patient's scans, newest first, with signed image URLs (valid for 1 hour). */
export async function listScans(patientId: string, limit = 50): Promise<ScanRecord[]> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = (data || []) as ScanRecord[];

  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  if (paths.length === 0) return rows;

  const { data: signed } = await supabase.storage.from(SCAN_BUCKET).createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map((signed || []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, imageUrl: r.image_path ? urlByPath.get(r.image_path) ?? null : null }));
}

export async function deleteScan(scan: Pick<ScanRecord, 'id' | 'image_path'>): Promise<void> {
  if (scan.image_path) {
    await supabase.storage.from(SCAN_BUCKET).remove([scan.image_path]);
  }
  const { error } = await supabase.from('analysis_results').delete().eq('id', scan.id);
  if (error) throw new Error(error.message);
}


// Pure helpers for AI scan records (no Supabase imports — safe to unit test).

export interface ScanDetection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox_xyxy: number[];
  bbox_xywhn: number[];
}

/** Each scan gets its own object under the patient's folder, so nothing is ever overwritten. */
export function buildScanPath(patientId: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${patientId}/${stamp}_${rand}_xai.jpg`;
}

/** "dental_caries" -> "Dental caries" */
export function formatCondition(name: string): string {
  const s = name.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Unique condition names found in a scan, highest confidence first. */
export function summarizeFindings(detections: ScanDetection[]): string[] {
  const best = new Map<string, number>();
  for (const d of detections || []) {
    best.set(d.class_name, Math.max(best.get(d.class_name) ?? 0, d.confidence));
  }
  return [...best.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => formatCondition(name));
}

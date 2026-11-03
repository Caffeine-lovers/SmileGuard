'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Trash2, X, RefreshCw } from 'lucide-react';
import { deleteScan, listScans, summarizeFindings, formatCondition, type ScanRecord } from '@/lib/scanHistory';

import { showAlert, showConfirm } from '@/components/ui/AppDialog';
export default function ScanHistory({ patientId, refreshKey = 0 }: { patientId?: string; refreshKey?: number }) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ScanRecord | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      setScans(await listScans(patientId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load scan history.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleDelete = async (scan: ScanRecord) => {
    if (!(await showConfirm('Delete this scan from your history? This cannot be undone.'))) return;
    try {
      await deleteScan(scan);
      setOpen(null);
      setScans((prev) => prev.filter((s) => s.id !== scan.id));
    } catch (e) {
      showAlert(e instanceof Error ? e.message : 'Could not delete scan.');
    }
  };

  if (!patientId) return null;

  return (
    <div className="mt-8 skeuo-panel p-4 sm:p-5 border-2 border-slate-300">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-700" />
          Scan History
        </h2>
        <button type="button" onClick={load} className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading your previous scans…</p>
      ) : error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : scans.length === 0 ? (
        <p className="text-xs text-slate-500">No saved scans yet. Your results are saved here automatically after each scan.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {scans.map((scan) => {
            const findings = summarizeFindings(scan.detections);
            return (
              <li key={scan.id}>
                <button
                  type="button"
                  onClick={() => setOpen(scan)}
                  className="w-full text-left skeuo-card rounded-sm border-2 border-slate-300 hover:border-emerald-500 overflow-hidden"
                >
                  {scan.imageUrl ? (
                    <img src={scan.imageUrl} alt="Annotated scan" className="w-full aspect-video object-cover bg-slate-100" />
                  ) : (
                    <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">No image</div>
                  )}
                  <div className="p-2">
                    <p className="text-[11px] font-bold text-slate-800">{new Date(scan.created_at).toLocaleString()}</p>
                    <p className={`text-[10px] font-semibold ${findings.length ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {findings.length ? `${scan.detection_count} finding${scan.detection_count > 1 ? 's' : ''}: ${findings.join(', ')}` : 'No issues detected'}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="skeuo-panel bg-white max-w-2xl w-full p-4 sm:p-5 border-2 border-slate-300 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(null)} className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-700" title="Close">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-1">Scan from {new Date(open.created_at).toLocaleString()}</h3>
            <p className="text-[11px] text-slate-500 mb-3">Model: {open.model}{open.confidence_threshold != null ? ` · threshold ${open.confidence_threshold}` : ''}</p>
            {open.imageUrl && <img src={open.imageUrl} alt="Annotated scan" className="w-full rounded-sm border border-slate-300 mb-3" />}
            {open.detections.length === 0 ? (
              <p className="text-xs text-emerald-700 font-semibold">No issues detected in this scan.</p>
            ) : (
              <ul className="space-y-1.5 mb-3">
                {open.detections.map((d, i) => (
                  <li key={i} className="flex justify-between text-xs border-b border-slate-100 pb-1">
                    <span className="font-semibold text-slate-800">{formatCondition(d.class_name)}</span>
                    <span className="font-mono text-slate-600">{(d.confidence * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500 italic mb-3">Show these results to your dentist for a professional diagnosis.</p>
            <button type="button" onClick={() => handleDelete(open)} className="text-xs text-red-700 hover:text-red-900 font-bold uppercase flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Delete scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { PrivacyContent, TermsContent } from './LegalContent';

export type LegalDoc = 'terms' | 'privacy';

/** Shows Terms or Privacy in a dialog so users don't leave a form they're filling in. */
export default function LegalModal({ doc, onClose }: { doc: LegalDoc | null; onClose: () => void }) {
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  if (!doc) return null;
  const title = doc === 'terms' ? 'Terms and Conditions' : 'Privacy Policy';

  return (
    <div
      className="fixed inset-0 z-[950] bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{doc === 'terms' ? <TermsContent /> : <PrivacyContent />}</div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-brand-primary hover:bg-brand-primary/90 cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

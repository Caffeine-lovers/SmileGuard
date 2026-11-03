'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface DialogRequest {
  id: number;
  kind: 'alert' | 'confirm';
  title?: string;
  message: string;
  tone: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
}

export interface DialogOptions {
  title?: string;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<(q: DialogRequest[]) => void>();
const emit = () => listeners.forEach((l) => l([...queue]));

function guessTone(message: string): Tone {
  const m = message.toLowerCase();
  if (/(fail|error|could not|couldn't|unable|blocked|not supported)/.test(m)) return 'error';
  if (/(please|required|exceeds|invalid|must)/.test(m)) return 'warning';
  if (/(success|sent|enabled|cancelled|resent|saved|done)/.test(m)) return 'success';
  return 'info';
}

function enqueue(kind: 'alert' | 'confirm', message: string, opts: DialogOptions = {}) {
  return new Promise<boolean>((resolve) => {
    queue.push({
      id: nextId++,
      kind,
      message,
      title: opts.title,
      tone: opts.tone ?? (kind === 'confirm' ? 'warning' : guessTone(message)),
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      destructive: opts.destructive,
      resolve,
    });
    emit();
  });
}

/** In-app replacement for window.alert(). Resolves when dismissed. */
export const showAlert = (message: string, opts?: DialogOptions) =>
  enqueue('alert', message, opts).then(() => undefined);

/** In-app replacement for window.confirm(). Resolves true when confirmed. */
export const showConfirm = (message: string, opts?: DialogOptions) =>
  enqueue('confirm', message, { destructive: true, ...opts });

const TONES: Record<Tone, { icon: typeof Info; ring: string; title: string }> = {
  info: { icon: Info, ring: 'bg-sky-100 text-sky-700', title: 'Notice' },
  success: { icon: CheckCircle2, ring: 'bg-emerald-100 text-emerald-700', title: 'Success' },
  warning: { icon: AlertTriangle, ring: 'bg-amber-100 text-amber-700', title: 'Please check' },
  error: { icon: XCircle, ring: 'bg-rose-100 text-rose-700', title: 'Something went wrong' },
};

/** Mount once near the app root. */
export function DialogHost() {
  const [items, setItems] = useState<DialogRequest[]>([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  const current = items[0];

  const close = (value: boolean) => {
    if (!current) return;
    queue = queue.filter((q) => q.id !== current.id);
    current.resolve(value);
    emit();
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  const tone = TONES[current.tone];
  const Icon = tone.icon;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px] animate-in fade-in duration-150"
      onMouseDown={(e) => e.target === e.currentTarget && current.kind === 'alert' && close(true)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3">
          <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${tone.ring}`}>
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="app-dialog-title" className="text-base font-bold text-slate-900">
              {current.title ?? (current.kind === 'confirm' ? 'Are you sure?' : tone.title)}
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed whitespace-pre-line break-words">
              {current.message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {current.kind === 'confirm' && (
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {current.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white cursor-pointer ${
              current.kind === 'confirm' && current.destructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-brand-primary hover:bg-brand-primary/90'
            }`}
          >
            {current.confirmLabel ?? (current.kind === 'confirm' ? 'Confirm' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}

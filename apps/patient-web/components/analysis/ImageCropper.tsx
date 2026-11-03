'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, X } from 'lucide-react';

interface Rect {
  x: number; // all values are fractions (0–1) of the displayed image
  y: number;
  w: number;
  h: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

interface ImageCropperProps {
  src: string;
  fileName?: string;
  onCancel: () => void;
  onSkip?: () => void;
  onCropped: (file: File, previewUrl: string) => void;
}

const MIN_SIZE = 0.08; // smallest crop box, as a fraction of the image
// Default box: a wide band in the middle, roughly where an open mouth sits in a close-up
const DEFAULT_RECT: Rect = { x: 0.15, y: 0.25, w: 0.7, h: 0.5 };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export default function ImageCropper({ src, fileName, onCancel, onSkip, onCropped }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [loaded, setLoaded] = useState(false);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; start: Rect }>({
    mode: null,
    startX: 0,
    startY: 0,
    start: DEFAULT_RECT,
  });

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: rect };
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    const { mode, startX, startY, start } = drag.current;
    const img = imgRef.current;
    if (!mode || !img) return;
    const box = img.getBoundingClientRect();
    const dx = (e.clientX - startX) / box.width;
    const dy = (e.clientY - startY) / box.height;

    let { x, y, w, h } = start;
    if (mode === 'move') {
      x = clamp(start.x + dx, 0, 1 - w);
      y = clamp(start.y + dy, 0, 1 - h);
    } else {
      if (mode.includes('w')) {
        const nx = clamp(start.x + dx, 0, start.x + start.w - MIN_SIZE);
        w = start.w + (start.x - nx);
        x = nx;
      }
      if (mode.includes('e')) w = clamp(start.w + dx, MIN_SIZE, 1 - start.x);
      if (mode.includes('n')) {
        const ny = clamp(start.y + dy, 0, start.y + start.h - MIN_SIZE);
        h = start.h + (start.y - ny);
        y = ny;
      }
      if (mode.includes('s')) h = clamp(start.h + dy, MIN_SIZE, 1 - start.y);
    }
    setRect({ x, y, w, h });
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current.mode = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Keyboard: arrows move the box, Shift+arrows resize it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCancel();
      const step = 0.01;
      const keys: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = keys[e.key];
      if (!d) return;
      e.preventDefault();
      setRect((r) =>
        e.shiftKey
          ? { ...r, w: clamp(r.w + d[0], MIN_SIZE, 1 - r.x), h: clamp(r.h + d[1], MIN_SIZE, 1 - r.y) }
          : { ...r, x: clamp(r.x + d[0], 0, 1 - r.w), y: clamp(r.y + d[1], 0, 1 - r.h) }
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleApply = () => {
    const img = imgRef.current;
    if (!img) return;
    const sx = Math.round(rect.x * img.naturalWidth);
    const sy = Math.round(rect.y * img.naturalHeight);
    const sw = Math.max(1, Math.round(rect.w * img.naturalWidth));
    const sh = Math.max(1, Math.round(rect.h * img.naturalHeight));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const base = (fileName || 'oral_photo').replace(/\.[^.]+$/, '');
        const file = new File([blob], `${base}_cropped.jpg`, { type: 'image/jpeg' });
        onCropped(file, URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.95
    );
  };

  const pct = (v: number) => `${v * 100}%`;
  const handles: { mode: DragMode; cls: string }[] = [
    { mode: 'nw', cls: '-top-2 -left-2 cursor-nwse-resize' },
    { mode: 'ne', cls: '-top-2 -right-2 cursor-nesw-resize' },
    { mode: 'sw', cls: '-bottom-2 -left-2 cursor-nesw-resize' },
    { mode: 'se', cls: '-bottom-2 -right-2 cursor-nwse-resize' },
    { mode: 'n', cls: '-top-2 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { mode: 's', cls: '-bottom-2 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { mode: 'w', cls: 'top-1/2 -left-2 -translate-y-1/2 cursor-ew-resize' },
    { mode: 'e', cls: 'top-1/2 -right-2 -translate-y-1/2 cursor-ew-resize' },
  ];

  return (
    <div className="fixed inset-0 z-[900] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-title"
        className="w-full max-w-3xl max-h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200">
          <div>
            <h2 id="crop-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Crop className="w-4 h-4 text-brand-primary" />
              Crop to your teeth
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag the box over your teeth and gums. Leave out your lips, nose and face as much as you can.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-slate-900 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="relative inline-block select-none touch-none max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Photo to crop"
              onLoad={() => setLoaded(true)}
              draggable={false}
              className="block max-w-full max-h-[60vh] object-contain"
            />
            {loaded && (
              <>
                {/* Dim everything outside the crop box */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-0 right-0 top-0 bg-black/60" style={{ height: pct(rect.y) }} />
                  <div className="absolute left-0 right-0 bottom-0 bg-black/60" style={{ height: pct(1 - rect.y - rect.h) }} />
                  <div className="absolute left-0 bg-black/60" style={{ top: pct(rect.y), height: pct(rect.h), width: pct(rect.x) }} />
                  <div className="absolute right-0 bg-black/60" style={{ top: pct(rect.y), height: pct(rect.h), width: pct(1 - rect.x - rect.w) }} />
                </div>

                {/* Crop box */}
                <div
                  onPointerDown={onPointerDown('move')}
                  className="absolute border-2 border-emerald-400 cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                  style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
                >
                  {/* rule-of-thirds guides */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/20" />
                    ))}
                  </div>
                  {handles.map((h) => (
                    <span
                      key={h.mode}
                      onPointerDown={onPointerDown(h.mode)}
                      className={`absolute w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow ${h.cls}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setRect(DEFAULT_RECT)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset box
          </button>
          <div className="flex items-center gap-2">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Use full photo
              </button>
            )}
            <button
              type="button"
              onClick={handleApply}
              disabled={!loaded}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Crop className="w-4 h-4" /> Crop photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  Compass,
  ArrowRight
} from 'lucide-react';

export interface TourStep {
  targetSelector: string;
  badge: string;
  title: string;
  description: string;
  features?: string[];
  actionLink?: {
    href: string;
    label: string;
  };
}

export const PATIENT_DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="profile-card"]',
    badge: 'Step 1 of 7 • Patient Profile',
    title: 'Dental Chart & Statutory Status',
    description: 'Your patient identity and verification hub. Once Dr. Kyler approves your PWD or Senior Citizen ID card, a verified badge will appear here to activate your statutory 20% discount on clinic billings.',
    features: [
      'Real-time synchronization with Kyler\'s Clinic',
      'Verified PWD / Senior Citizen badge indicator',
      'Encrypted dental chart & medical intake data'
    ]
  },
  {
    targetSelector: '[data-tour="book-visit-btn"]',
    badge: 'Step 2 of 7 • Online Scheduling',
    title: 'Conflict-Free Appointment Booking',
    description: 'Schedule cleanings, restorations, or general checkups directly. The appointment engine validates live clinic operating hours and automatically blocks out unavailable dates.',
    features: [
      'Live doctor operating hours & chair capacity',
      'Automatic clinic blockout date detection',
      'Instant conflict-prevention algorithms'
    ],
    actionLink: {
      href: '/appointments',
      label: 'Explore Scheduler'
    }
  },
  {
    targetSelector: '[data-tour="stats-grid"]',
    badge: 'Step 3 of 7 • Clinical Ledger',
    title: 'At-a-Glance Clinical & Billing KPIs',
    description: 'Keep track of your complete dental history in one place: total appointments registered, countdown to your next clinic visit, and real-time outstanding ledger balances.',
    features: [
      'Total appointment counter',
      'Live balance tracking with PayMongo integration',
      'Next scheduled chair visit countdown'
    ]
  },
  {
    targetSelector: '[data-tour="appointments-panel"]',
    badge: 'Step 4 of 7 • Appointment Hub',
    title: 'Manage Scheduled & Pending Visits',
    description: 'Monitor your appointments across 3 live states: Scheduled (confirmed by the doctor), Pending (awaiting clinic review), and Past/Cancelled records.',
    features: [
      'Scheduled tab: Active confirmed chair bookings',
      'Pending tab: Real-time alerts for visits awaiting review',
      'Past & Cancelled: Full audit trail of previous sessions'
    ]
  },
  {
    targetSelector: '[data-tour="quick-analysis"]',
    badge: 'Step 5 of 7 • AI Vision Screening',
    title: 'Computer Vision Oral Health Scan',
    description: 'Launch our real-time camera engine to detect signs of early gingivitis, redness, and plaque accumulation. Take an oral scan anytime before coming in to the clinic.',
    features: [
      'Instant preliminary oral health scoring',
      'Live camera snapshot with multi-tier hardware fallbacks',
      'Pre-flight reports attached directly to your clinical profile'
    ],
    actionLink: {
      href: '/analysis',
      label: 'Try AI Oral Screening'
    }
  },
  {
    targetSelector: '[data-tour="quick-billing"]',
    badge: 'Step 6 of 7 • Payments & Statutory Discounts',
    title: 'Digital Payments & PWD Verification',
    description: 'Review itemized dental invoices and settle balances securely via GCash, Maya, or Cards. You can also upload your official PWD or Senior Citizen ID here to request your 20% discount.',
    features: [
      'BSP-licensed PayMongo online payment processing',
      'Secure ID card photo upload for doctor review',
      'Enforced statutory 20% deduction upon doctor approval'
    ],
    actionLink: {
      href: '/billing',
      label: 'Open Billing Hub'
    }
  },
  {
    targetSelector: '[data-tour="guide-controls"]',
    badge: 'Step 7 of 7 • Help & Resources',
    title: 'Interactive Tours & Onboarding Guides',
    description: 'You\'re all set! You can replay this interactive spotlight tour anytime with "Tour UI", or click "Guide" to explore the full 5-step comprehensive onboarding wizard.',
    features: [
      'Tour UI: Real-time in-app spotlight walkthrough',
      'Guide: Comprehensive 5-step onboarding wizard',
      'Always accessible from your dashboard header'
    ]
  }
];

interface InteractiveTourProps {
  steps?: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  storageKey?: string;
}

export default function InteractiveTour({
  steps = PATIENT_DASHBOARD_TOUR_STEPS,
  isOpen,
  onClose,
  storageKey = 'smileguard_patient_tour_completed'
}: InteractiveTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetBorderRadius, setTargetBorderRadius] = useState<string>('6px');
  const [isMounted, setIsMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex] || steps[0];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!isOpen || !currentStep) return;

    let el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;

    if (!el || el.offsetParent === null) {
      if (currentStep.targetSelector === '[data-tour="quick-analysis"]') {
        el = document.querySelector('header a[href="/analysis"]');
      } else if (currentStep.targetSelector === '[data-tour="quick-billing"]') {
        el = document.querySelector('header a[href="/billing"]');
      } else if (currentStep.targetSelector === '[data-tour="profile-card"]') {
        el = document.querySelector('[data-tour="profile-header"]');
      }
    }

    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      try {
        const computed = window.getComputedStyle(el);
        if (computed.borderRadius && computed.borderRadius !== '0px') {
          setTargetBorderRadius(computed.borderRadius);
        } else {
          setTargetBorderRadius('6px');
        }
      } catch {
        setTargetBorderRadius('6px');
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  // Smooth scroll and continuous 60fps tracking during step transitions
  useEffect(() => {
    if (!isOpen) return;

    let el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el || el.offsetParent === null) {
      if (currentStep.targetSelector === '[data-tour="quick-analysis"]') {
        el = document.querySelector('header a[href="/analysis"]');
      } else if (currentStep.targetSelector === '[data-tour="quick-billing"]') {
        el = document.querySelector('header a[href="/billing"]');
      } else if (currentStep.targetSelector === '[data-tour="profile-card"]') {
        el = document.querySelector('[data-tour="profile-header"]');
      }
    }

    if (el) {
      const rect = el.getBoundingClientRect();
      const inView = 
        rect.top >= 80 && 
        rect.bottom <= (window.innerHeight - 80) &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth;

      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    let animationFrameId: number;
    const startTime = performance.now();
    const trackPosition = (now: number) => {
      updateTargetRect();
      if (now - startTime < 650) {
        animationFrameId = requestAnimationFrame(trackPosition);
      }
    };
    animationFrameId = requestAnimationFrame(trackPosition);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentStepIndex, isOpen, currentStep, updateTargetRect]);

  // Listen to window scroll & resize events
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, { capture: true });
    };
  }, [isOpen, updateTargetRect]);

  if (!isMounted || !isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch (e) {
      console.warn('Could not persist tour completion to localStorage', e);
    }
    onClose();
  };

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Bounding rect calculations with precise padding
  const pad = 6;
  const cardWidth = 380;
  const cardHeightEstimate = 320;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let popoverTop = 100;
  let popoverLeft = Math.max(16, (viewportWidth - cardWidth) / 2);

  if (targetRect) {
    const spaceBelow = viewportHeight - (targetRect.bottom + pad);
    const spaceAbove = targetRect.top - pad;

    if (spaceBelow >= cardHeightEstimate + 20) {
      popoverTop = targetRect.bottom + pad + 16;
    } else if (spaceAbove >= cardHeightEstimate + 20) {
      popoverTop = Math.max(16, targetRect.top - pad - cardHeightEstimate - 16);
    } else {
      if (spaceBelow > spaceAbove) {
        popoverTop = Math.min(viewportHeight - cardHeightEstimate - 16, targetRect.bottom + pad + 12);
      } else {
        popoverTop = Math.max(16, targetRect.top - pad - cardHeightEstimate - 12);
      }
    }

    const targetCenter = targetRect.left + targetRect.width / 2;
    popoverLeft = targetCenter - cardWidth / 2;
    popoverLeft = Math.max(16, Math.min(viewportWidth - cardWidth - 16, popoverLeft));
  } else {
    popoverTop = Math.max(40, (viewportHeight - cardHeightEstimate) / 2);
    popoverLeft = Math.max(16, (viewportWidth - cardWidth) / 2);
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Precision Cutout Frame & Outer Spotlight Shadow */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.max(0, targetRect.top - pad)}px`,
            left: `${Math.max(0, targetRect.left - pad)}px`,
            width: `${Math.min(viewportWidth, targetRect.width + pad * 2)}px`,
            height: `${targetRect.height + pad * 2}px`,
            borderRadius: targetBorderRadius || '6px',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.78), 0 0 25px rgba(16, 185, 129, 0.45)',
            pointerEvents: 'none',
            transition: 'top 0.25s cubic-bezier(0.16, 1, 0.3, 1), left 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s',
          }}
          className="z-[9998] border-2 border-emerald-400"
        >
          {/* Inner High-Precision Dashed Outline Ring */}
          <div
            style={{ borderRadius: targetBorderRadius || '6px' }}
            className="absolute -inset-[3px] border-2 border-dashed border-emerald-300/80 animate-pulse pointer-events-none"
          />

          {/* 4 Precision Corner Reticle Brackets */}
          <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white pointer-events-none shadow-xs" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white pointer-events-none shadow-xs" />
          <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white pointer-events-none shadow-xs" />
          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white pointer-events-none shadow-xs" />

          {/* Focused Element Subject Tag */}
          <div className="absolute -top-6 left-1 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider rounded-t-xs shadow-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-ping" />
            <span>Target Box</span>
          </div>
        </div>
      )}

      {/* Floating Tour Tooltip Card */}
      <div
        ref={popoverRef}
        className="fixed z-[10000] w-[calc(100vw-32px)] sm:w-[380px] bg-white rounded-lg shadow-2xl border-2 border-emerald-800/20 overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
        style={{
          top: `${popoverTop}px`,
          left: `${popoverLeft}px`,
        }}
      >
        {/* Card Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-emerald-950">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
              <Compass className="w-3.5 h-3.5 text-emerald-300" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">
              {currentStep.badge}
            </span>
          </div>

          <button
            type="button"
            onClick={handleComplete}
            className="text-white/70 hover:text-white p-1 rounded-sm hover:bg-white/10 transition"
            title="Close Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">
              {currentStep.title}
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {currentStep.features && currentStep.features.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              {currentStep.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-semibold text-slate-700 leading-snug">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          )}

          {currentStep.actionLink && (
            <div className="pt-2">
              <Link
                href={currentStep.actionLink.href}
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                <span>{currentStep.actionLink.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Card Footer with Controls */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
          {/* Progress Dots */}
          <div className="flex items-center gap-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'w-5 bg-emerald-600'
                    : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
                title={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 rounded border border-slate-300 bg-white hover:bg-slate-100 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="skeuo-btn-primary px-3.5 py-1.5 text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              <span>{isLastStep ? 'Finish Tour' : 'Next'}</span>
              {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

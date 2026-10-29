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
    targetSelector: '[data-tour="profile-header"]',
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
    targetSelector: '[data-tour="nav-analysis"]',
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
    targetSelector: '[data-tour="nav-billing"]',
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
  const [isMounted, setIsMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentStep = steps[currentStepIndex] || steps[0];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateTargetRect = useCallback(() => {
    if (!isOpen || !currentStep) return;

    // Try finding element by current selector
    let el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;

    // Fallbacks if not visible or selector not found
    if (!el || el.offsetParent === null) {
      if (currentStep.targetSelector === '[data-tour="nav-analysis"]') {
        el = document.querySelector('[data-tour="quick-analysis"]') || document.querySelector('header a[href="/analysis"]');
      } else if (currentStep.targetSelector === '[data-tour="nav-billing"]') {
        el = document.querySelector('[data-tour="quick-billing"]') || document.querySelector('header a[href="/billing"]');
      }
    }

    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  // Scroll to target element on step change
  useEffect(() => {
    if (!isOpen) return;

    let el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el || el.offsetParent === null) {
      if (currentStep.targetSelector === '[data-tour="nav-analysis"]') {
        el = document.querySelector('[data-tour="quick-analysis"]') || document.querySelector('header a[href="/analysis"]');
      } else if (currentStep.targetSelector === '[data-tour="nav-billing"]') {
        el = document.querySelector('[data-tour="quick-billing"]') || document.querySelector('header a[href="/billing"]');
      }
    }

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update rect immediately and after smooth scroll completes
    updateTargetRect();
    const timer1 = setTimeout(updateTargetRect, 200);
    const timer2 = setTimeout(updateTargetRect, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [currentStepIndex, isOpen, currentStep, updateTargetRect]);

  // Listen to window scroll & resize to adjust spotlight
  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
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

  // Calculate popover positioning relative to targetRect
  const padding = 8;
  const cardWidth = 380;
  const cardHeightEstimate = 320;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  let popoverTop = 100;
  let popoverLeft = Math.max(16, (viewportWidth - cardWidth) / 2);

  if (targetRect) {
    const spaceBelow = viewportHeight - (targetRect.bottom + padding);
    const spaceAbove = targetRect.top - padding;

    if (spaceBelow >= cardHeightEstimate || spaceBelow >= spaceAbove) {
      popoverTop = Math.min(viewportHeight - cardHeightEstimate - 20, targetRect.bottom + padding + 12);
    } else {
      popoverTop = Math.max(20, targetRect.top - padding - cardHeightEstimate - 12);
    }

    const targetCenter = targetRect.left + targetRect.width / 2;
    popoverLeft = targetCenter - cardWidth / 2;
    // Clamp to viewport
    popoverLeft = Math.max(16, Math.min(viewportWidth - cardWidth - 16, popoverLeft));
  } else {
    // Default center
    popoverTop = Math.max(40, (viewportHeight - cardHeightEstimate) / 2);
    popoverLeft = Math.max(16, (viewportWidth - cardWidth) / 2);
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* SVG Spotlight Mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            {/* White covers all (opaque mask) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight hole */}
            {targetRect && (
              <rect
                x={Math.max(0, targetRect.left - padding)}
                y={Math.max(0, targetRect.top - padding)}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="8"
                ry="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark translucent backdrop with cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.78)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Target Focus Ring Indicator */}
      {targetRect && (
        <div
          className="absolute pointer-events-none rounded-lg border-2 border-emerald-400 ring-4 ring-emerald-400/30 shadow-[0_0_25px_rgba(52,211,153,0.4)] transition-all duration-300 animate-pulse"
          style={{
            left: Math.max(0, targetRect.left - padding),
            top: Math.max(0, targetRect.top - padding),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
          }}
        />
      )}

      {/* Floating Tour Tooltip Card */}
      <div
        ref={popoverRef}
        className="absolute z-10 w-[calc(100vw-32px)] sm:w-[380px] bg-white rounded-lg shadow-2xl border-2 border-emerald-800/20 overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
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

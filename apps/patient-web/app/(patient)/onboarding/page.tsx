'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { 
  Sparkles, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Stethoscope, 
  BrainCircuit, 
  Clock, 
  FileText,
  Lock,
  Smile
} from 'lucide-react';

export default function PatientOnboardingWizard() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const getStorageKey = () => {
    return currentUser?.id 
      ? `smileguard_patient_onboarding_completed_${currentUser.id}`
      : 'smileguard_patient_onboarding_completed_guest';
  };

  const steps = [
    {
      id: 'welcome',
      badge: 'Step 1 of 5 • Welcome',
      title: 'Welcome to SmileGuard',
      subtitle: 'Your modern, intelligent dental health and clinic companion.',
      description: 'SmileGuard connects you directly with certified dental clinics and your personal dentist. Everything from scheduling, AI oral screening, and payments is unified in one secure patient portal.',
      icon: Stethoscope,
      accentColor: 'emerald',
      features: [
        {
          icon: ShieldCheck,
          title: 'Bank-Grade Privacy & Security',
          desc: 'Your dental records and medical intake are encrypted and strictly protected under healthcare privacy standards.'
        },
        {
          icon: Clock,
          title: 'Real-Time Clinic Synchronization',
          desc: 'Direct integration with your dentist’s mobile chair system ensures zero wait-time surprises and accurate slots.'
        },
        {
          icon: Smile,
          title: 'Comprehensive Dental Chart',
          desc: 'Keep track of treatments, previous visits, prescriptions, and dentist notes anytime from any device.'
        }
      ]
    },
    {
      id: 'ai-scan',
      badge: 'Step 2 of 5 • AI Oral Screening',
      title: 'Smart AI Dental Screening',
      subtitle: 'Detect early gum inflammation & plaque before your visit.',
      description: 'SmileGuard features an on-demand AI oral screening engine. Simply upload or take photos of your teeth and gums to receive an immediate preliminary health score.',
      icon: BrainCircuit,
      accentColor: 'teal',
      features: [
        {
          icon: Sparkles,
          title: 'Instant Risk Assessment',
          desc: 'Screens for signs of gingivitis, redness, and gum recession in seconds.'
        },
        {
          icon: FileText,
          title: 'Doctor-Ready Reports',
          desc: 'Screening findings are automatically attached to your profile so your dentist can review them beforehand.'
        },
        {
          icon: ShieldCheck,
          title: 'Guidance, Not Diagnosis',
          desc: 'Helps you understand when an in-person dental evaluation or cleaning is urgently recommended.'
        }
      ]
    },
    {
      id: 'appointments',
      badge: 'Step 3 of 5 • Online Scheduling',
      title: 'Conflict-Free Appointment Booking',
      subtitle: 'Pick dates, preferred dentists, and real-time open slots.',
      description: 'Say goodbye to phone tags. View your clinic’s live operating calendar, select available morning or afternoon chairs, and reserve your visit with conflict protection.',
      icon: Calendar,
      accentColor: 'emerald',
      features: [
        {
          icon: Clock,
          title: 'Live Clinic Hours',
          desc: 'Booking slots automatically reflect your dental clinic’s verified weekly working hours and breaks.'
        },
        {
          icon: Stethoscope,
          title: 'Assigned Dentist Choice',
          desc: 'Select your preferred licensed dentist or let the clinic automatically match the best specialist.'
        },
        {
          icon: CheckCircle2,
          title: 'Automatic Calendar Reminders',
          desc: 'Receive live dashboard status updates as your doctor confirms or adjusts your visit.'
        }
      ]
    },
    {
      id: 'billing',
      badge: 'Step 4 of 5 • Digital Payments',
      title: 'Transparent Billing & Checkout',
      subtitle: 'Itemized invoices and BSP-licensed online payments via PayMongo.',
      description: 'Clear, predictable dental costs. Review itemized treatment fees set directly by your clinic, and settle balances seamlessly with your preferred Philippine payment method.',
      icon: CreditCard,
      accentColor: 'cyan',
      features: [
        {
          icon: CreditCard,
          title: 'GCash, Maya, Cards & GrabPay',
          desc: 'Secure digital checkout powered by PayMongo with instant payment confirmation.'
        },
        {
          icon: FileText,
          title: 'Transparent Itemized Invoices',
          desc: 'Every procedure, dental cleaning, or filling is clearly itemized with clinic details.'
        },
        {
          icon: Lock,
          title: 'Zero Hidden Fees',
          desc: 'Full visibility over outstanding balances and paid receipts saved in your treatment registry.'
        }
      ]
    },
    {
      id: 'ready',
      badge: 'Step 5 of 5 • Ready to Smile',
      title: 'You Are All Set!',
      subtitle: 'Your SmileGuard Patient Portal is completely configured.',
      description: 'You can now book your initial checkup, explore the AI oral scan tool, or review your medical chart. Your health records are safe, synced, and always accessible.',
      icon: CheckCircle2,
      accentColor: 'emerald',
      features: [
        {
          icon: Calendar,
          title: 'Ready to Book?',
          desc: 'Head straight to the appointments scheduler to reserve your upcoming clinic slot.'
        },
        {
          icon: BrainCircuit,
          title: 'Curious About Your Gum Health?',
          desc: 'Take an AI oral screening anytime under the Analysis tab in your navigation.'
        },
        {
          icon: ShieldCheck,
          title: 'Need Help?',
          desc: 'You can relaunch this Onboarding Wizard anytime from your Dashboard header.'
        }
      ]
    }
  ];

  const handleComplete = (destination = '/dashboard') => {
    setIsFinishing(true);
    try {
      localStorage.setItem(getStorageKey(), 'true');
    } catch (e) {
      console.warn('Could not persist onboarding state to localStorage', e);
    }
    router.replace(destination);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete('/dashboard');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const activeStep = steps[currentStep];
  const StepIcon = activeStep.icon;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black tracking-tight text-white text-lg">SmileGuard</span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                Patient Guide
              </span>
            </div>
          </div>

          <button
            onClick={() => handleComplete('/dashboard')}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800"
          >
            Skip to Dashboard
          </button>
        </div>

        {/* Progress Bar */}
        <div className="max-w-5xl mx-auto mt-3">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Wizard Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="max-w-3xl w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 md:p-10 relative">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Step Pill */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeStep.badge}
            </span>
          </div>

          {/* Slide Heading */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shrink-0 shadow-lg shadow-emerald-950/50">
              <StepIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {activeStep.title}
              </h1>
              <p className="text-emerald-300/90 text-sm font-medium mt-1">
                {activeStep.subtitle}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
            {activeStep.description}
          </p>

          {/* 3 Feature Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-8">
            {activeStep.features.map((feat, idx) => {
              const FeatureIcon = feat.icon;
              return (
                <div 
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                    <FeatureIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-white font-bold text-xs uppercase tracking-wide mb-1">
                    {feat.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Step 5 Fast Actions */}
          {currentStep === steps.length - 1 && (
            <div className="mb-8 p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-3">
                Where would you like to start?
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => handleComplete('/appointments')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Book First Appointment
                </button>
                <button
                  onClick={() => handleComplete('/analysis')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg border border-slate-700 transition-colors"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-teal-400" />
                  Run AI Dental Screening
                </button>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between gap-4">
            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  aria-label={`Jump to step ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStep 
                      ? 'w-7 bg-emerald-400' 
                      : 'w-2 bg-slate-700 hover:bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              <button
                onClick={handleNext}
                disabled={isFinishing}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950/60 disabled:opacity-50"
              >
                <span>{currentStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="border-t border-slate-800/60 py-4 px-6 text-center text-xs text-slate-500">
        SmileGuard Digital Healthcare Platform • Encrypted & Synchronized with Clinical Systems
      </footer>
    </div>
  );
}

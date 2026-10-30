'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignup } from '@/lib/signup-context';
import { 
  ShieldCheck, 
  User, 
  PhoneCall, 
  Activity, 
  FileHeart, 
  ArrowLeft, 
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const TOTAL_STEPS = 4;

export default function SignupMedicalPage() {
  const router = useRouter();
  const { formData, updateMedicalField } = useSignup();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);


  const cleanDigits = (val: string) => val.replace(/\D/g, '');

  const formatPhPhoneDisplay = (phone: string | undefined) => {
    if (!phone) return '';
    let digits = cleanDigits(phone);
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    // Format as 9XX XXX XXXX
    if (digits.length > 6) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    } else if (digits.length > 3) {
      return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    }
    return digits;
  };

  const handlePhoneInput = (val: string) => {
    let digits = cleanDigits(val);
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    const full = digits ? `+63${digits}` : '';
    updateMedicalField('phone', full);
  };

  const handleEmergencyPhoneInput = (val: string) => {
    let digits = cleanDigits(val);
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    const full = digits ? `+63${digits}` : '';
    updateMedicalField('emergency_contact_phone', full);
  };

  const isFemale = formData.medicalIntake.gender === 'female';
  // Ensure default pregnancy status is set so review never says 'Not provided'
  useEffect(() => {
    if (!formData.medicalIntake.pregnancy_status) {
      updateMedicalField('pregnancy_status', isFemale ? 'no' : 'na');
    }
  }, [formData.medicalIntake.gender, isFemale, updateMedicalField]);
  const isMale = formData.medicalIntake.gender === 'male';

  const handleGenderChange = (gender: string) => {
    updateMedicalField('gender', gender);
    // Cascading prevention: male patients are automatically set to 'na'
    if (gender === 'male') {
      updateMedicalField('pregnancy_status', 'na');
    }
  };

  const validateStep = (step: number): boolean => {
    setStepError(null);
    if (step === 1) {
      if (!formData.medicalIntake.date_of_birth) {
        setStepError('Please provide your date of birth.');
        return false;
      }
      const phoneDigits = cleanDigits(formData.medicalIntake.phone || '');
      // Expect 10 digits after +63 (e.g. 63 + 10 digits = 12 digits, or raw 10 digits)
      const pureDigits = phoneDigits.startsWith('63') ? phoneDigits.slice(2) : phoneDigits.startsWith('0') ? phoneDigits.slice(1) : phoneDigits;
      if (pureDigits.length !== 10) {
        setStepError('Primary mobile number must be exactly 10 digits following +63 (e.g. 917 123 4567).');
        return false;
      }
    }
    if (step === 2) {
      if (formData.medicalIntake.emergency_contact_phone) {
        const emDigits = cleanDigits(formData.medicalIntake.emergency_contact_phone);
        const pureEm = emDigits.startsWith('63') ? emDigits.slice(2) : emDigits.startsWith('0') ? emDigits.slice(1) : emDigits;
        if (pureEm.length !== 10) {
          setStepError('Emergency contact mobile must be exactly 10 digits following +63 (e.g. 917 123 4567).');
          return false;
        }
      }
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    if (currentStep < TOTAL_STEPS) {
      // Auto-set pregnancy status to 'na' if male before proceeding
      if (isMale) {
        updateMedicalField('pregnancy_status', 'na');
      }
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step -> navigate to Review & Confirm page (does NOT save to DB yet)
      if (isMale || !formData.medicalIntake.pregnancy_status) {
        if (isMale) updateMedicalField('pregnancy_status', 'na');
      }
      router.push('/signup/confirm');
    }
  };

  const handlePrevStep = () => {
    setStepError(null);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      router.push('/signup/register');
    }
  };

  return (
    <div className="skeuo-panel p-5 sm:p-8 border-2 border-slate-300 max-w-lg mx-auto">
      {/* Header & Step Indicator */}
      <div className="text-center mb-6">
        <span className="skeuo-badge skeuo-badge-mint mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Clinical Medical Intake
        </span>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
          Health Background
        </h2>
        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
          Step {currentStep} of {TOTAL_STEPS}: {
            currentStep === 1 ? 'Demographics & Identity' :
            currentStep === 2 ? 'Emergency Contacts' :
            currentStep === 3 ? 'Medical History & Lifestyle' :
            'Clinical Health Specifics'
          }
        </p>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[1, 2, 3, 4].map((stepNum) => (
            <div 
              key={stepNum}
              className={`h-2 rounded-full transition-all duration-300 ${
                stepNum <= currentStep ? 'bg-emerald-600 shadow-xs' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {stepError && (
        <div className="bg-red-50 border-2 border-red-500 text-red-700 px-3.5 py-2.5 rounded-sm mb-5 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{stepError}</span>
        </div>
      )}

      <form onSubmit={handleNextStep} className="space-y-4">
        {/* ── QUESTIONNAIRE STEP 1: Demographics ── */}
        {currentStep === 1 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-3 flex items-center gap-2.5">
              <User className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Please enter your primary demographic details for clinical records.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.medicalIntake.date_of_birth || ''}
                onChange={(e) => updateMedicalField('date_of_birth', e.target.value)}
                className="skeuo-input w-full text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Gender
              </label>
              <select
                value={formData.medicalIntake.gender || ''}
                onChange={(e) => handleGenderChange(e.target.value)}
                className="skeuo-input w-full text-sm"
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Primary Mobile Phone <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-xs font-bold bg-slate-100 border-2 border-r-0 border-slate-300 text-slate-700 rounded-l-sm select-none">
                  🇵🇭 +63
                </span>
                <input
                  type="tel"
                  required
                  value={formatPhPhoneDisplay(formData.medicalIntake.phone)}
                  onChange={(e) => handlePhoneInput(e.target.value)}
                  className="skeuo-input rounded-l-none w-full text-sm font-mono tracking-wider"
                  placeholder="912 345 6789"
                  maxLength={12}
                />
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                Standard 10-digit PH mobile number without leading zero (10 digits).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Residential Address
              </label>
              <input
                type="text"
                value={formData.medicalIntake.address || ''}
                onChange={(e) => updateMedicalField('address', e.target.value)}
                className="skeuo-input w-full text-sm"
                placeholder="Street address, City, Province"
              />
            </div>
          </div>
        )}

        {/* ── QUESTIONNAIRE STEP 2: Emergency Contact ── */}
        {currentStep === 2 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-3 flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Who should we contact in case of emergency during your clinical visit?
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Emergency Contact Full Name
              </label>
              <input
                type="text"
                value={formData.medicalIntake.emergency_contact_name || ''}
                onChange={(e) => updateMedicalField('emergency_contact_name', e.target.value)}
                className="skeuo-input w-full text-sm"
                placeholder="e.g. Juan Dela Cruz"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Relationship to Patient
              </label>
              <select
                value={formData.medicalIntake.emergency_contact_relationship || ''}
                onChange={(e) => updateMedicalField('emergency_contact_relationship', e.target.value)}
                className="skeuo-input w-full text-sm"
              >
                <option value="">Select relationship (e.g. Spouse, Parent)...</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent / Guardian</option>
                <option value="Sibling">Sibling</option>
                <option value="Child">Child</option>
                <option value="Relative">Relative</option>
                <option value="Friend">Friend</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Emergency Contact Phone
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-xs font-bold bg-slate-100 border-2 border-r-0 border-slate-300 text-slate-700 rounded-l-sm select-none">
                  🇵🇭 +63
                </span>
                <input
                  type="tel"
                  value={formatPhPhoneDisplay(formData.medicalIntake.emergency_contact_phone)}
                  onChange={(e) => handleEmergencyPhoneInput(e.target.value)}
                  className="skeuo-input rounded-l-none w-full text-sm font-mono tracking-wider"
                  placeholder="912 345 6789"
                  maxLength={12}
                />
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                10-digit mobile number for immediate clinic notifications in case of emergency.
              </p>
            </div>
          </div>
        )}

        {/* ── QUESTIONNAIRE STEP 3: Medical History & Lifestyle ── */}
        {currentStep === 3 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-2 flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Help our dental team anticipate drug interactions and health sensitivities.
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-sm text-xs text-emerald-900 font-semibold mb-3">
              💡 Form Instructions: All medical history fields below are optional. If none apply to you, you may leave them empty or type &quot;None&quot;.
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Known Drug / Material Allergies
              </label>
              <textarea
                value={formData.medicalIntake.allergies || ''}
                onChange={(e) => updateMedicalField('allergies', e.target.value)}
                rows={2}
                className="skeuo-input w-full text-sm resize-none"
                placeholder="e.g. Penicillin, Latex, Aspirin (or leave empty if None)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Current Maintenance Medications
              </label>
              <textarea
                value={formData.medicalIntake.current_medications || ''}
                onChange={(e) => updateMedicalField('current_medications', e.target.value)}
                rows={2}
                className="skeuo-input w-full text-sm resize-none"
                placeholder="e.g. Blood thinners, Metformin, Amlodipine"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Chronic Medical Conditions
              </label>
              <textarea
                value={formData.medicalIntake.medical_conditions || ''}
                onChange={(e) => updateMedicalField('medical_conditions', e.target.value)}
                rows={2}
                className="skeuo-input w-full text-sm resize-none"
                placeholder="e.g. Diabetes, Hypertension, Asthma"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Past Surgeries / Major Procedures
              </label>
              <textarea
                value={formData.medicalIntake.past_surgeries || ''}
                onChange={(e) => updateMedicalField('past_surgeries', e.target.value)}
                rows={2}
                className="skeuo-input w-full text-sm resize-none"
                placeholder="e.g. Heart surgery, Wisdom tooth extraction"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Smoking / Tobacco Status
              </label>
              <select
                value={formData.medicalIntake.smoking_status || ''}
                onChange={(e) => updateMedicalField('smoking_status', e.target.value)}
                className="skeuo-input w-full text-sm"
              >
                <option value="">Prefer not to say</option>
                <option value="never">Never smoked</option>
                <option value="former">Former smoker</option>
                <option value="current">Current smoker</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Select your tobacco/smoking history for clinical assessment of gum tissue health.
              </p>
            </div>
          </div>
        )}

        {/* ── QUESTIONNAIRE STEP 4: Cascading Health Specifics & Notes ── */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-3 flex items-center gap-2.5">
              <FileHeart className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Final clinical questionnaire before proceeding to confirmation.
              </p>
            </div>

            {/* CASCADING LOGIC: Only display pregnancy question for female patients */}
            {isFemale ? (
              <div className="bg-emerald-50/60 p-4 border-2 border-emerald-300 rounded-sm space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-950">
                  Pregnancy Status
                </label>
                <p className="text-xs text-emerald-800">
                  Certain dental anesthetics and X-rays require clinical adjustment during pregnancy.
                </p>
                <select
                  value={formData.medicalIntake.pregnancy_status || 'no'}
                  onChange={(e) => updateMedicalField('pregnancy_status', e.target.value)}
                  className="skeuo-input w-full text-sm bg-white"
                >
                  <option value="no">Not currently pregnant</option>
                  <option value="yes">Currently pregnant</option>
                  <option value="na">Not applicable</option>
                </select>
              </div>
            ) : isMale ? (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-sm text-xs text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Gender-specific questions (pregnancy) automatically bypassed.</span>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Pregnancy Status
                </label>
                <select
                  value={formData.medicalIntake.pregnancy_status || 'na'}
                  onChange={(e) => updateMedicalField('pregnancy_status', e.target.value)}
                  className="skeuo-input w-full text-sm"
                >
                  <option value="na">Not applicable</option>
                  <option value="no">Not pregnant</option>
                  <option value="yes">Currently pregnant</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Additional Clinical Notes
              </label>
              <textarea
                value={formData.medicalIntake.notes || ''}
                onChange={(e) => updateMedicalField('notes', e.target.value)}
                rows={3}
                className="skeuo-input w-full text-sm resize-none"
                placeholder="Any special dental fears, tooth sensitivity, or comments for Dr. Kyler..."
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handlePrevStep}
            className="skeuo-btn-secondary flex-1 py-2.5 text-xs uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{currentStep === 1 ? 'Back to Profile' : 'Back'}</span>
          </button>
          <button
            type="submit"
            className="skeuo-btn-primary flex-1 py-2.5 text-xs uppercase tracking-wider"
          >
            <span>{currentStep === TOTAL_STEPS ? 'Review & Confirm' : 'Next Step'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

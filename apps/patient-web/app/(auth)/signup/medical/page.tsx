'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSignup } from '@/lib/signup-context';
import { 
  User, 
  PhoneCall, 
  Activity, 
  FileHeart, 
  ArrowLeft, 
  ArrowRight,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';

const TOTAL_STEPS = 4;

const PH_PROVINCES = [
  'Metro Manila (NCR)',
  'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao', 'Aurora',
  'Basilan', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan',
  'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu',
  'Cotabato', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental',
  'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo',
  'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte',
  'Maguindanao', 'Marinduque', 'Masbate', 'Misamis Occidental', 'Misamis Oriental', 'Mountain Province',
  'Negros Occidental', 'Negros Oriental', 'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro',
  'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon',
  'Samar', 'Sarangani', 'Siquijor', 'Sorsogon', 'South Cotabato', 'Southern Leyte', 'Sultan Kudarat',
  'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte',
  'Zamboanga del Sur', 'Zamboanga Sibugay'
];

interface ContactItem {
  name: string;
  relationship: string;
  phone: string;
}

export default function SignupMedicalPage() {
  const router = useRouter();
  const { formData, updateMedicalField } = useSignup();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Address subfields for PH-wide residential address
  const [addrProvince, setAddrProvince] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrStreet, setAddrStreet] = useState('');

  // Up to 3 emergency contacts
  const [contacts, setContacts] = useState<ContactItem[]>([
    {
      name: formData.medicalIntake.emergency_contact_name || '',
      relationship: formData.medicalIntake.emergency_contact_relationship || '',
      phone: formData.medicalIntake.emergency_contact_phone || '',
    }
  ]);

  // Sync initial address if already formatted
  useEffect(() => {
    if (formData.medicalIntake.address && !addrProvince && !addrCity && !addrStreet) {
      const parts = formData.medicalIntake.address.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        setAddrStreet(parts.slice(0, parts.length - 2).join(', '));
        setAddrCity(parts[parts.length - 2]);
        setAddrProvince(parts[parts.length - 1]);
      } else if (parts.length === 2) {
        setAddrStreet(parts[0]);
        setAddrProvince(parts[1]);
      } else {
        setAddrStreet(formData.medicalIntake.address);
      }
    }
  }, [formData.medicalIntake.address, addrProvince, addrCity, addrStreet]);

  const cleanDigits = (val: string) => val.replace(/\D/g, '');

  const formatPhPhoneDisplay = (phone: string | undefined) => {
    if (!phone) return '';
    let digits = cleanDigits(phone);
    if (digits.startsWith('63')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
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

  const handleAddressChange = (street: string, city: string, province: string) => {
    setAddrStreet(street);
    setAddrCity(city);
    setAddrProvince(province);
    const combined = [street.trim(), city.trim(), province.trim()].filter(Boolean).join(', ');
    updateMedicalField('address', combined);
  };

  const handleContactChange = (index: number, field: keyof ContactItem, val: string) => {
    setContacts(prev => {
      const next = [...prev];
      if (field === 'phone') {
        let digits = cleanDigits(val);
        if (digits.startsWith('63')) digits = digits.slice(2);
        if (digits.startsWith('0')) digits = digits.slice(1);
        digits = digits.slice(0, 10);
        next[index] = { ...next[index], phone: digits ? `+63${digits}` : '' };
      } else {
        next[index] = { ...next[index], [field]: val };
      }

      // Sync summary to formData
      const validContacts = next.filter(c => c.name || c.phone);
      if (validContacts.length > 0) {
        const summaryNames = validContacts.map(c => `${c.name}${c.relationship ? ` (${c.relationship})` : ''}`).join('; ');
        const summaryPhones = validContacts.map(c => c.phone).join('; ');
        updateMedicalField('emergency_contact_name', summaryNames);
        updateMedicalField('emergency_contact_relationship', validContacts[0]?.relationship || '');
        updateMedicalField('emergency_contact_phone', summaryPhones);
      } else {
        updateMedicalField('emergency_contact_name', '');
        updateMedicalField('emergency_contact_relationship', '');
        updateMedicalField('emergency_contact_phone', '');
      }

      return next;
    });
  };

  const addEmergencyContact = () => {
    if (contacts.length < 3) {
      setContacts(prev => [...prev, { name: '', relationship: '', phone: '' }]);
    }
  };

  const removeEmergencyContact = (index: number) => {
    setContacts(prev => {
      const next = prev.filter((_, i) => i !== index);
      const validContacts = next.filter(c => c.name || c.phone);
      if (validContacts.length > 0) {
        const summaryNames = validContacts.map(c => `${c.name}${c.relationship ? ` (${c.relationship})` : ''}`).join('; ');
        const summaryPhones = validContacts.map(c => c.phone).join('; ');
        updateMedicalField('emergency_contact_name', summaryNames);
        updateMedicalField('emergency_contact_relationship', validContacts[0]?.relationship || '');
        updateMedicalField('emergency_contact_phone', summaryPhones);
      } else {
        updateMedicalField('emergency_contact_name', '');
        updateMedicalField('emergency_contact_relationship', '');
        updateMedicalField('emergency_contact_phone', '');
      }
      return next;
    });
  };

  const today = new Date();
  const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const isFemale = formData.medicalIntake.gender === 'female';
  const isMale = formData.medicalIntake.gender === 'male';

  useEffect(() => {
    if (!formData.medicalIntake.pregnancy_status) {
      updateMedicalField('pregnancy_status', isFemale ? 'no' : 'na');
    }
  }, [formData.medicalIntake.gender, isFemale, updateMedicalField]);

  const handleGenderChange = (gender: string) => {
    updateMedicalField('gender', gender);
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
      if (calculateAge(formData.medicalIntake.date_of_birth) < 18) {
        setStepError('Patient must be at least 18 years of age to register.');
        return false;
      }
      const phoneDigits = cleanDigits(formData.medicalIntake.phone || '');
      const pureDigits = phoneDigits.startsWith('63') ? phoneDigits.slice(2) : phoneDigits.startsWith('0') ? phoneDigits.slice(1) : phoneDigits;
      if (pureDigits.length !== 10) {
        setStepError('Primary mobile number must be exactly 10 digits following +63 (e.g. 917 123 4567).');
        return false;
      }
    }
    if (step === 2) {
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        if (c.phone) {
          const emDigits = cleanDigits(c.phone);
          const pureEm = emDigits.startsWith('63') ? emDigits.slice(2) : emDigits.startsWith('0') ? emDigits.slice(1) : emDigits;
          if (pureEm.length !== 10) {
            setStepError(`Emergency contact #${i + 1} mobile must be exactly 10 digits following +63.`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    if (currentStep < TOTAL_STEPS) {
      if (isMale) {
        updateMedicalField('pregnancy_status', 'na');
      }
      setCurrentStep(prev => prev + 1);
    } else {
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
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Health Background
        </h2>

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
                Enter your demographic details for clinical records.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Birth <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                max={maxDob}
                value={formData.medicalIntake.date_of_birth || ''}
                onChange={(e) => updateMedicalField('date_of_birth', e.target.value)}
                className="skeuo-input w-full text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Must be at least 18 years of age.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                Standard 10-digit PH mobile number without leading zero.
              </p>
            </div>

            {/* Structured Philippine Residential Address */}
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Philippine Residential Address
              </label>

              <div>
                <select
                  value={addrProvince}
                  onChange={(e) => handleAddressChange(addrStreet, addrCity, e.target.value)}
                  className="skeuo-input w-full text-sm mb-2"
                >
                  <option value="">Select Region / Province...</option>
                  {PH_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={addrCity}
                  onChange={(e) => handleAddressChange(addrStreet, e.target.value, addrProvince)}
                  className="skeuo-input w-full text-sm"
                  placeholder="City / Municipality (e.g. Quezon City)"
                />
                <input
                  type="text"
                  value={addrStreet}
                  onChange={(e) => handleAddressChange(e.target.value, addrCity, addrProvince)}
                  className="skeuo-input w-full text-sm"
                  placeholder="House/Unit, Street, Barangay"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── QUESTIONNAIRE STEP 2: Emergency Contacts (Up to 3) ── */}
        {currentStep === 2 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-slate-700 font-medium">
                  Add emergency contacts (up to 3).
                </p>
              </div>
              {contacts.length < 3 && (
                <button
                  type="button"
                  onClick={addEmergencyContact}
                  className="skeuo-btn-secondary px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Contact</span>
                </button>
              )}
            </div>

            {contacts.map((contact, idx) => (
              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-sm space-y-2.5 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Emergency Contact #{idx + 1} {idx === 0 && '(Primary)'}
                  </span>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeEmergencyContact(idx)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                    className="skeuo-input w-full text-sm"
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Relationship
                  </label>
                  <select
                    value={contact.relationship}
                    onChange={(e) => handleContactChange(idx, 'relationship', e.target.value)}
                    className="skeuo-input w-full text-sm"
                  >
                    <option value="">Select relationship...</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent / Guardian</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child</option>
                    <option value="Relative">Relative</option>
                    <option value="Friend">Friend</option>
                    <option value="Colleague">Colleague / Coworker</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Mobile Phone
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 text-xs font-bold bg-slate-100 border-2 border-r-0 border-slate-300 text-slate-700 rounded-l-sm select-none">
                      🇵🇭 +63
                    </span>
                    <input
                      type="tel"
                      value={formatPhPhoneDisplay(contact.phone)}
                      onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                      className="skeuo-input rounded-l-none w-full text-sm font-mono tracking-wider"
                      placeholder="912 345 6789"
                      maxLength={12}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── QUESTIONNAIRE STEP 3: Medicinal Allergies ── */}
        {currentStep === 3 && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-3 flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Help our dental team anticipate drug interactions and sensitivities.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Medicinal Allergies
              </label>
              <textarea
                value={formData.medicalIntake.allergies || ''}
                onChange={(e) => updateMedicalField('allergies', e.target.value)}
                rows={3}
                className="skeuo-input w-full text-sm resize-none"
                placeholder="e.g. Penicillin, Amoxicillin, Aspirin, Ibuprofen (or leave empty if None)"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                List any medications or drugs you are allergic to. Leave blank if none.
              </p>
            </div>
          </div>
        )}

        {/* ── QUESTIONNAIRE STEP 4: Clinical Health Specifics & Notes ── */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 mb-3 flex items-center gap-2.5">
              <FileHeart className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                Final clinical details before proceeding to confirmation.
              </p>
            </div>

            {/* ONLY display pregnancy question for female patients. Completely omitted for males. */}
            {isFemale && (
              <div className="bg-emerald-50/60 p-4 border border-emerald-300 rounded-sm space-y-2">
                <label className="block text-xs font-semibold text-emerald-950">
                  Pregnancy Status
                </label>
                <p className="text-xs text-emerald-800">
                  Certain dental anesthetics and procedures require clinical adjustment during pregnancy.
                </p>
                <select
                  value={formData.medicalIntake.pregnancy_status || 'no'}
                  onChange={(e) => updateMedicalField('pregnancy_status', e.target.value)}
                  className="skeuo-input w-full text-sm bg-white"
                >
                  <option value="no">Not currently pregnant</option>
                  <option value="yes">Currently pregnant</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
            className="skeuo-btn-secondary flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{currentStep === 1 ? 'Back to Profile' : 'Back'}</span>
          </button>
          <button
            type="submit"
            className="skeuo-btn-primary flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider"
          >
            <span>{currentStep === TOTAL_STEPS ? 'Review & Confirm' : 'Continue'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

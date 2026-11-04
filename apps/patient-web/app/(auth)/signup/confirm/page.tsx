'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';
import { setPatientUserCookie } from '@/lib/auth-cookie';

import LegalModal, { type LegalDoc } from '@/components/legal/LegalModal';
import { 
  normalizePregnancyStatus, 
  formatPregnancyStatus, 
  normalizeSmokingStatus} from '@/lib/medical-helpers';

export default function SignupConfirmPage() {
  const router = useRouter();
  const {
    formData,
    isOAuthFlow,
    currentAuthUser,
    clearSignupData,
  } = useSignup();

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!agreedToTerms) {
      setLocalError('Please read and agree to the Terms and Conditions and Privacy Policy to continue.');
      return;
    }
    setLoading(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const effectiveUser = currentAuthUser || authUser;
      const isOAuth = isOAuthFlow || (typeof window !== 'undefined' && localStorage.getItem('oauth_signup_flow') === 'true') || Boolean(authUser?.app_metadata?.provider === 'google');

      if (isOAuth && effectiveUser) {
        // 1. Update password for OAuth user if they chose to set one
        if (formData.password) {
          const { error: passwordError } = await supabase.auth.updateUser({
            password: formData.password,
          });

          if (passwordError) throw passwordError;
          console.log('[SignupConfirm] Password set for OAuth user');
        }

        // 2. Update Profile
        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            id: effectiveUser.id,        
            name: formData.name,
            role: 'patient',
            email: formData.email ?? effectiveUser.email ?? '',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (updateError) throw updateError;

        // 3. Map Medical Data with normalized constraints
        const medicalData = {
          patient_id: effectiveUser.id,
          date_of_birth: formData.medicalIntake.date_of_birth || null,
          gender: formData.medicalIntake.gender || null,
          phone: formData.medicalIntake.phone || null,
          address: formData.medicalIntake.address || null,
          emergency_contact_name: formData.medicalIntake.emergency_contact_name || null,
          emergency_contact_phone: formData.medicalIntake.emergency_contact_phone || null,
          allergies: formData.medicalIntake.allergies || 'None',
          current_medications: formData.medicalIntake.current_medications || 'None',
          medical_conditions: formData.medicalIntake.medical_conditions || 'None',
          past_surgeries: formData.medicalIntake.past_surgeries || 'None',
          smoking_status: normalizeSmokingStatus(formData.medicalIntake.smoking_status) || null,
          pregnancy_status: normalizePregnancyStatus(formData.medicalIntake.pregnancy_status) || null,
          notes: formData.medicalIntake.notes || null,
          updated_at: new Date().toISOString(),
        };

        const { error: intakeError } = await supabase
          .from('medical_intake')
          .upsert(medicalData, { onConflict: 'patient_id' });

        if (intakeError) throw intakeError;

        console.log('[SignupConfirm] OAuth signup complete');
        localStorage.removeItem('oauth_signup_flow');
        setPatientUserCookie({
          id: effectiveUser.id,
          name: formData.name,
          email: formData.email ?? effectiveUser.email ?? '',
          role: 'patient',
          hasMedicalIntake: true,
        });
        clearSignupData();
        router.push('/dashboard');

      } else {
        // Standard flow (Email/Phone OTP verification)
        if (formData.password !== formData.confirmPassword) {
          setLocalError('Passwords do not match');
          setLoading(false);
          return;
        }

        if (!authUser) {
          setLocalError('User session not found. Please verify again.');
          setLoading(false);
          return;
        }

        // 1. Update password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: formData.password,
        });

        if (passwordError) throw passwordError;
        console.log('[SignupConfirm] Password set for email user');

        // 2. Create Profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            name: formData.name,
            email: formData.email || authUser.email,
            role: 'patient',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (profileError) throw profileError;
        console.log('[SignupConfirm] Profile created');

        // 3. Create or update Medical Intake using upsert with onConflict
        const medicalData = {
          patient_id: authUser.id,
          date_of_birth: formData.medicalIntake.date_of_birth || null,
          gender: formData.medicalIntake.gender || null,
          phone: formData.medicalIntake.phone || null,
          address: formData.medicalIntake.address || null,
          emergency_contact_name: formData.medicalIntake.emergency_contact_name || null,
          emergency_contact_phone: formData.medicalIntake.emergency_contact_phone || null,
          allergies: formData.medicalIntake.allergies || 'None',
          current_medications: formData.medicalIntake.current_medications || 'None',
          medical_conditions: formData.medicalIntake.medical_conditions || 'None',
          past_surgeries: formData.medicalIntake.past_surgeries || 'None',
          smoking_status: normalizeSmokingStatus(formData.medicalIntake.smoking_status) || null,
          pregnancy_status: normalizePregnancyStatus(formData.medicalIntake.pregnancy_status) || null,
          notes: formData.medicalIntake.notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: intakeError } = await supabase
          .from('medical_intake')
          .upsert(medicalData, { onConflict: 'patient_id' });

        if (intakeError) throw intakeError;
        console.log('[SignupConfirm] Medical intake created/updated');
        
        localStorage.removeItem('oauth_signup_flow');
        setPatientUserCookie({
          id: authUser.id,
          name: formData.name,
          email: formData.email || authUser.email || '',
          role: 'patient',
          hasMedicalIntake: true,
        });
        await clearSignupData();
        router.replace('/dashboard');
      }
    } catch (err) {
      console.error('[SignupConfirm] Error details:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setLocalError(errorMessage);
      setLoading(false);
    }
  };

  // JSX unchanged below — no modifications needed
  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Review & Confirm
      </h2>
      <p className="text-center text-text-secondary mb-8 text-sm">
        Please verify your details before completing registration.
      </p>

      {localError && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider">Account Information</h3>
          <div className="bg-border-card/10 border border-border-card rounded-lg p-4 space-y-3 text-sm">
            <ReviewField label="Full Name" value={formData.name} />
            <ReviewField label="Email Address" value={formData.email} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider">Medical Summary</h3>
          <div className="bg-border-card/10 border border-border-card rounded-lg p-4 space-y-3 text-sm">
            <ReviewField label="Date of Birth" value={formData.medicalIntake.date_of_birth} />
            <ReviewField label="Gender" value={formData.medicalIntake.gender ? (formData.medicalIntake.gender.charAt(0).toUpperCase() + formData.medicalIntake.gender.slice(1).toLowerCase()) : 'Not provided'} />
            <ReviewField label="Personal Phone" value={formData.medicalIntake.phone} />
            {formData.medicalIntake.gender === 'female' && (
              <ReviewField label="Pregnancy Status" value={formatPregnancyStatus(formData.medicalIntake.pregnancy_status)} />
            )}
            <ReviewField 
              label="Emergency Contact" 
              value={formData.medicalIntake.emergency_contact_name 
                ? `${formData.medicalIntake.emergency_contact_name}${formData.medicalIntake.emergency_contact_relationship ? ` (${formData.medicalIntake.emergency_contact_relationship})` : ''} — ${formData.medicalIntake.emergency_contact_phone || 'No phone'}` 
                : 'None provided'} 
            />
            
            <div className="pt-2 border-t border-border-card/50">
              <p className="text-text-secondary text-xs mb-2 text-[11px] uppercase font-bold tracking-wider">Health Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white/60 border border-border-card/60 p-2 rounded">
                  <span className="font-bold text-text-primary block text-[10px] uppercase">Medicinal Allergies</span>
                  <span className="text-text-secondary">{formData.medicalIntake.allergies && formData.medicalIntake.allergies !== 'None' ? formData.medicalIntake.allergies : 'None reported'}</span>
                </div>
                <div className="bg-white/60 border border-border-card/60 p-2 rounded">
                  <span className="font-bold text-text-primary block text-[10px] uppercase">Medical Conditions</span>
                  <span className="text-text-secondary">{formData.medicalIntake.medical_conditions && formData.medicalIntake.medical_conditions !== 'None' ? formData.medicalIntake.medical_conditions : 'None reported'}</span>
                </div>
                <div className="bg-white/60 border border-border-card/60 p-2 rounded">
                  <span className="font-bold text-text-primary block text-[10px] uppercase">Current Medications</span>
                  <span className="text-text-secondary">{formData.medicalIntake.current_medications && formData.medicalIntake.current_medications !== 'None' ? formData.medicalIntake.current_medications : 'None reported'}</span>
                </div>
                <div className="bg-white/60 border border-border-card/60 p-2 rounded">
                  <span className="font-bold text-text-primary block text-[10px] uppercase">Past Surgeries</span>
                  <span className="text-text-secondary">{formData.medicalIntake.past_surgeries && formData.medicalIntake.past_surgeries !== 'None' ? formData.medicalIntake.past_surgeries : 'None reported'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-card text-brand-primary focus:ring-brand-primary cursor-pointer"
              required
            />
            <span className="text-sm text-text-primary leading-relaxed">
              I have read and agree to the{' '}
              <button type="button" onClick={() => setLegalDoc('terms')} className="font-semibold text-brand-primary underline cursor-pointer">
                Terms and Conditions
              </button>{' '}
              and{' '}
              <button type="button" onClick={() => setLegalDoc('privacy')} className="font-semibold text-brand-primary underline cursor-pointer">
                Privacy Policy
              </button>
              , and I consent to SmileGuard and my clinic processing my personal and medical information as described.
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Processing...' : isOAuthFlow ? 'Complete Profile' : 'Create Account'}
          </button>
        </div>
      </form>
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

// UI Helpers (Keep these as you had them)
function ReviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-text-secondary text-[11px] uppercase font-semibold">{label}</p>
      <p className="text-text-primary font-medium">{value || 'Not provided'}</p>
    </div>
  );
}


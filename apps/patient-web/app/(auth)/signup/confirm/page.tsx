'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';

export default function SignupConfirmPage() {
  const router = useRouter();
  const { register } = useAuth(); // ensureProfileExists no longer needed here
  const {
    formData,
    isOAuthFlow,
    currentAuthUser,
    clearSignupData,
  } = useSignup();

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLoading(true);

    try {
      if (isOAuthFlow && currentAuthUser) {
        // 1. Update Profile
        const { error: updateError } = await supabase
          .from('profiles')
          .upsert({
            id: currentAuthUser.id,        
            name: formData.name,
            service: formData.service,
            role: 'patient',
            email: formData.email ?? currentAuthUser.email ?? '',
            updated_at: new Date().toISOString(),
          });

        if (updateError) throw updateError;

        // 2. Map Medical Data (Fixing the 400 error)
        // We explicitly map keys and convert empty strings to null
        const medicalData = {
          patient_id: currentAuthUser.id,
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
          smoking_status: formData.medicalIntake.smoking_status || null,
          pregnancy_status: formData.medicalIntake.pregnancy_status || null,
          notes: formData.medicalIntake.notes || null,
        };

        const { error: intakeError } = await supabase
          .from('medical_intake')
          .upsert(medicalData, { onConflict: 'patient_id' });

        if (intakeError) throw intakeError;

        console.log('[SignupConfirm] OAuth signup complete');
        clearSignupData();
        router.push('/dashboard');

      } else {
        // Standard flow
        if (formData.password !== formData.confirmPassword) {
          setLocalError('Passwords do not match');
          setLoading(false);
          return;
        } 

        await register(
          {
            ...formData,
            doctorAccessCode: '',
          },
          'patient'
        );
        
        clearSignupData();
        router.push('/dashboard');
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
            <ReviewField label="Service Interest" value={formData.service} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider">Medical Summary</h3>
          <div className="bg-border-card/10 border border-border-card rounded-lg p-4 space-y-3 text-sm">
            <ReviewField label="Date of Birth" value={formData.medicalIntake.date_of_birth} />
            <ReviewField label="Personal Phone" value={formData.medicalIntake.phone} />
            <ReviewField label="Emergency Contact" value={formData.medicalIntake.emergency_contact_name ? `${formData.medicalIntake.emergency_contact_name} (${formData.medicalIntake.emergency_contact_phone})` : undefined} />
            
            <div className="pt-2 border-t border-border-card/50">
              <p className="text-text-secondary text-xs mb-1 text-[11px] uppercase font-semibold">Health Details</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge label="Allergies" value={formData.medicalIntake.allergies} />
                <Badge label="Conditions" value={formData.medicalIntake.medical_conditions} />
                <Badge label="Meds" value={formData.medicalIntake.current_medications} />
                {!formData.medicalIntake.allergies && !formData.medicalIntake.medical_conditions && (
                  <span className="italic text-text-secondary text-xs">No special conditions noted</span>
                )}
              </div>
            </div>
          </div>
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
            disabled={loading}
            className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Processing...' : isOAuthFlow ? 'Complete Profile' : 'Create Account'}
          </button>
        </div>
      </form>
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

function Badge({ label, value }: { label: string; value?: string }) {
  if (!value || value === 'None') return null;
  return (
    <span className="bg-brand-primary/10 text-brand-primary px-2 py-1 rounded border border-brand-primary/20 text-[10px]">
      <strong>{label}:</strong> {value}
    </span>
  );
}
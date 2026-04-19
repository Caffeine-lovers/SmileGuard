'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';

export default function SignupConfirmPage() {
  const router = useRouter();
  const { register } = useAuth();
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
        // OAuth flow: Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            service: formData.service,
            role: 'patient',
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentAuthUser.id);

        if (updateError) {
          setLocalError(`Failed to update profile: ${updateError.message}`);
          return;
        }

        clearSignupData();
        router.push('/dashboard');
      } else {
        // Standard email/phone flow: Create new account
        if (formData.password !== formData.confirmPassword) {
          setLocalError('Passwords do not match');
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
        router.push('/login?registered=true');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setLocalError(errorMessage);
      console.error('[SignupConfirmPage] Error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Confirm & Create
      </h2>
      <p className="text-center text-text-secondary mb-8">
        Step 3 of 3: Review your information
      </p>

      {localError && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Review section */}
        <div className="bg-border-card/20 rounded-lg p-4 space-y-3 text-sm">
          <div>
            <p className="text-text-secondary text-xs">Full Name</p>
            <p className="text-text-primary font-medium">{formData.name}</p>
          </div>

          <div>
            <p className="text-text-secondary text-xs">Email</p>
            <p className="text-text-primary font-medium">{formData.email}</p>
          </div>

          {formData.phone && (
            <div>
              <p className="text-text-secondary text-xs">Phone</p>
              <p className="text-text-primary font-medium">{formData.phone}</p>
            </div>
          )}

          <div>
            <p className="text-text-secondary text-xs">Service Type</p>
            <p className="text-text-primary font-medium">{formData.service}</p>
          </div>

          {(formData.medicalIntake.has_diabetes || formData.medicalIntake.has_heart_disease || formData.medicalIntake.allergies) && (
            <div>
              <p className="text-text-secondary text-xs">Medical Notes</p>
              <ul className="text-text-primary text-xs space-y-1">
                {formData.medicalIntake.has_diabetes && <li>• Has diabetes</li>}
                {formData.medicalIntake.has_heart_disease && <li>• Has heart disease</li>}
                {formData.medicalIntake.allergies && <li>• Allergies: {formData.medicalIntake.allergies}</li>}
              </ul>
            </div>
          )}
        </div>

        {!isOAuthFlow && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            After creating your account, you'll be redirected to log in with your email and password.
          </div>
        )}

        {isOAuthFlow && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            Your profile will be updated and you'll be redirected to your dashboard.
          </div>
        )}

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
            {loading ? 'Creating...' : isOAuthFlow ? 'Complete Profile' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}

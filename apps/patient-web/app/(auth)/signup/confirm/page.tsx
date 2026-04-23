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

  const saveMedicalIntake = async (patientId: string) => {
    const { error } = await supabase
      .from('medical_intake')
      .upsert({
        patient_id: patientId,
        date_of_birth: formData.medicalIntake.dateOfBirth || null,
        gender: formData.medicalIntake.gender || null,
        phone: formData.medicalIntake.phone || null,
        address: formData.medicalIntake.address || null,
        emergency_contact_name: formData.medicalIntake.emergencyContactName || null,
        emergency_contact_phone: formData.medicalIntake.emergencyContactPhone || null,
        allergies: formData.medicalIntake.allergies || null,
        current_medications: formData.medicalIntake.currentMedications || null,
        medical_conditions: formData.medicalIntake.medicalConditions || null,
        past_surgeries: formData.medicalIntake.pastSurgeries || null,
        smoking_status: formData.medicalIntake.smokingStatus || '',
        pregnancy_status: formData.medicalIntake.pregnancyStatus || '',
      });
    return error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLoading(true);

    try {
      if (isOAuthFlow && currentAuthUser) {
        // Profile already exists — created in OAuth callback
        console.log('[SignupConfirm] OAuth flow: updating profile for', currentAuthUser.id);

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
          console.error('[SignupConfirm] Profile update failed:', updateError);
          setLocalError(`Failed to update profile: ${updateError.message}`);
          setLoading(false);
          return;
        }

        const intakeError = await saveMedicalIntake(currentAuthUser.id);
        if (intakeError) {
          console.error('[SignupConfirm] Medical intake failed:', intakeError);
          setLocalError(`Failed to save medical information: ${intakeError.message}`);
          setLoading(false);
          return;
        }

        console.log('[SignupConfirm] OAuth signup complete');
        clearSignupData();
        router.push('/dashboard');

      } else {
        // Email flow
        if (formData.password !== formData.confirmPassword) {
          setLocalError('Passwords do not match');
          setLoading(false);
          return;
        }

        console.log('[SignupConfirm] Email flow: registering...');

        // register() now creates the profile internally — see useAuth changes below
        await register({ ...formData, doctorAccessCode: '' }, 'patient');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLocalError('Session not found after registration');
          setLoading(false);
          return;
        }

        // Profile already exists at this point — created inside register()
        const intakeError = await saveMedicalIntake(session.user.id);
        if (intakeError) {
          console.error('[SignupConfirm] Medical intake failed:', intakeError);
          setLocalError(`Failed to save medical information: ${intakeError.message}`);
          setLoading(false);
          return;
        }

        console.log('[SignupConfirm] Email signup complete');
        clearSignupData();
        router.push('/login?registered=true');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      console.error('[SignupConfirm] Error:', errorMessage);
      setLocalError(errorMessage);
      setLoading(false);
    }
  };

  // JSX unchanged below — no modifications needed
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
          {(formData.medicalIntake.dateOfBirth || formData.medicalIntake.gender || formData.medicalIntake.phone || formData.medicalIntake.address || formData.medicalIntake.allergies || formData.medicalIntake.currentMedications || formData.medicalIntake.medicalConditions || formData.medicalIntake.pastSurgeries || formData.medicalIntake.smokingStatus || formData.medicalIntake.pregnancyStatus) && (
            <div>
              <p className="text-text-secondary text-xs">Medical Information</p>
              <ul className="text-text-primary text-xs space-y-1">
                {formData.medicalIntake.dateOfBirth && <li>• DOB: {formData.medicalIntake.dateOfBirth}</li>}
                {formData.medicalIntake.gender && <li>• Gender: {formData.medicalIntake.gender}</li>}
                {formData.medicalIntake.phone && <li>• Phone: {formData.medicalIntake.phone}</li>}
                {formData.medicalIntake.address && <li>• Address: {formData.medicalIntake.address}</li>}
                {formData.medicalIntake.emergencyContactName && <li>• Emergency Contact: {formData.medicalIntake.emergencyContactName}</li>}
                {formData.medicalIntake.allergies && <li>• Allergies: {formData.medicalIntake.allergies}</li>}
                {formData.medicalIntake.currentMedications && <li>• Medications: {formData.medicalIntake.currentMedications}</li>}
                {formData.medicalIntake.medicalConditions && <li>• Medical Conditions: {formData.medicalIntake.medicalConditions}</li>}
                {formData.medicalIntake.pastSurgeries && <li>• Past Surgeries: {formData.medicalIntake.pastSurgeries}</li>}
                {formData.medicalIntake.smokingStatus && <li>• Smoking: {formData.medicalIntake.smokingStatus}</li>}
                {formData.medicalIntake.pregnancyStatus && <li>• Pregnancy Status: {formData.medicalIntake.pregnancyStatus}</li>}
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
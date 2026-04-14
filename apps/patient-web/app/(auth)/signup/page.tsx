'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { EMPTY_MEDICAL_INTAKE, checkPasswordStrengthDetailed, isPasswordStrongDetailed } from '@smileguard/shared-types';

export default function SignupPage() {
  const router = useRouter();
  const { sendSignupOtp, verifyEmailOtp, updateProfileData, updateUserPassword, loading, error: authError } = useAuth();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Medical/Profile, 4: Password
  const [localError, setLocalError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: '',
    service: 'General',
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  // Countdown timer for OTP cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  const handlePasswordChange = (newPassword: string) => {
    setFormData({ ...formData, password: newPassword });
    setPasswordCheck(checkPasswordStrengthDetailed(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Step 1: Send Email
    if (step === 1) {
      if (!formData.email || !formData.confirmEmail) {
        setLocalError('Please fill in all email fields');
        return;
      }
      if (formData.email !== formData.confirmEmail) {
        setLocalError('Emails do not match');
        return;
      }

      try {
        await sendSignupOtp(formData.email);
        setStep(2);
        setOtpCooldown(60); // 60-second cooldown
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to send OTP');
      }
      return;
    }

    // Step 2: Verify OTP
    if (step === 2) {
      if (!otpCode) {
        setLocalError('Please enter the verification code');
        return;
      }
      try {
        const response = await verifyEmailOtp(formData.email, otpCode);
        if (response.success && response.user) {
          setUserId(response.user.id);
          setStep(3);
        } else {
          setLocalError('Verification failed');
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Verification failed');
      }
      return;
    }

    // Step 3: Name & Medical Intake (Profile update)
    if (step === 3) {
      if (!formData.name) {
        setLocalError('Please fill in your full name');
        return;
      }
      if (!userId) {
        setLocalError('Session lost. Please try again.');
        return;
      }

      try {
        await updateProfileData(userId, {
          name: formData.name,
          role: 'patient',
          service: formData.service,
          medicalIntake: formData.medicalIntake
        });
        setStep(4);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to update profile');
      }
      return;
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Make sure we have the password field populated. 
    // Medical data etc was already sent in step 3
    if (!formData.password) {
      setLocalError('Please fill in password');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (!isPasswordStrongDetailed(passwordCheck)) {
      setLocalError('Password does not meet strength requirements');
      return;
    }

    try {
      await updateUserPassword(formData.password);
      router.push('/login?registered=true');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to set password');
    }
  };

  const getStepTitle = () => {
    switch(step) {
      case 1: return 'Create Account';
      case 2: return 'Verify Email';
      case 3: return 'Medical Details';
      case 4: return 'Set Password';
      default: return 'Create Account';
    }
  };

  const getStepSubtitle = () => {
    switch(step) {
      case 1: return 'Step 1 of 4: Enter your email';
      case 2: return `Step 2 of 4: Code sent to ${formData.email}`;
      case 3: return 'Step 3 of 4: Your details';
      case 4: return 'Step 4 of 4: Secure your account';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-bg-surface rounded-xl shadow-2xl p-8 border border-border-card relative max-h-[90vh] overflow-y-auto">
        <Link href="/login" className="absolute right-4 top-4 text-text-secondary hover:text-text-primary p-2">
          ✕
        </Link>
        <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
          {getStepTitle()}
        </h2>
        <p className="text-center text-text-secondary mb-8">
          {getStepSubtitle()}
        </p>

        {(authError || localError) && (
          <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
            {authError || localError}
          </div>
        )}

        {/* Step 1: Email */}
        {step === 1 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Confirm Email Address
              </label>
              <input
                type="email"
                value={formData.confirmEmail}
                onChange={(e) => setFormData({ ...formData, confirmEmail: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Sending Code...' : 'Next: Verify Email'}
            </button>
          </form>
        )}

        {/* Step 2: OTP Validation */}
        {step === 2 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Verification Code
              </label>
              <p className="text-sm text-text-secondary mb-3">
                We sent a code to <strong>{formData.email}</strong>
              </p>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="123456"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Verifying...' : 'Next: Setup Profile'}
            </button>
            <button
              type="button"
              disabled={otpCooldown > 0 || loading}
              onClick={async () => {
                try {
                  await sendSignupOtp(formData.email);
                  setOtpCooldown(60);
                  setLocalError(null);
                } catch (err) {
                  setLocalError(err instanceof Error ? err.message : 'Failed to resend code');
                }
              }}
              className="w-full bg-border-card hover:bg-border-card/80 disabled:bg-border-card text-text-secondary disabled:text-text-secondary/60 font-medium py-2 px-4 rounded-lg transition"
            >
              {otpCooldown > 0 ? `Resend Code in ${otpCooldown}s` : 'Resend Code'}
            </button>
          </form>
        )}

        {/* Step 3: Medical and Form Data */}
        {step === 3 && (
          <form onSubmit={handleNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Service Type
              </label>
              <select
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              >
                <option value="General">General Checkup</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Whitening">Whitening</option>
                <option value="Aligners">Aligners</option>
                <option value="Root Canal">Root Canal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.medicalIntake.has_diabetes || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalIntake: {
                        ...formData.medicalIntake,
                        has_diabetes: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="ml-2 text-text-primary">I have diabetes</span>
              </label>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.medicalIntake.has_heart_disease || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalIntake: {
                        ...formData.medicalIntake,
                        has_heart_disease: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="ml-2 text-text-primary">I have heart disease</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Allergies
              </label>
              <textarea
                value={formData.medicalIntake.allergies || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    medicalIntake: {
                      ...formData.medicalIntake,
                      allergies: e.target.value,
                    },
                  })
                }
                className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                placeholder="List any allergies..."
                rows={3}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Saving...' : 'Next: Set Password'}
            </button>
          </form>
        )}

        {/* Step 4: Password setup */}
        {step === 4 && (
          <form onSubmit={handleSubmitPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              <div className="mt-2 text-sm space-y-1">
                <p className={`${passwordCheck.hasUpperCase ? 'text-green-600' : 'text-text-secondary'}`}>
                  ✓ Uppercase letter
                </p>
                <p className={`${passwordCheck.hasLowerCase ? 'text-green-600' : 'text-text-secondary'}`}>
                  ✓ Lowercase letter
                </p>
                <p className={`${passwordCheck.hasNumber ? 'text-green-600' : 'text-text-secondary'}`}>
                  ✓ Number
                </p>
                <p className={`${passwordCheck.hasSpecialChar ? 'text-green-600' : 'text-text-secondary'}`}>
                  ✓ Special character
                </p>
                <p className={`${passwordCheck.length ? 'text-green-600' : 'text-text-secondary'}`}>
                  ✓ At least 8 characters
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-text-link font-medium hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

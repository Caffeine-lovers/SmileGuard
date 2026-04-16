'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';
import { supabase } from '@smileguard/supabase-client';
import { EMPTY_MEDICAL_INTAKE } from '@smileguard/shared-types';

export default function SignupPage() {
  const router = useRouter();
  const { register, loading, error: authError } = useAuth();
  const [step, setStep] = useState(1); // 1: Basic, 4: Medical, 5: Confirm
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    service: 'General',
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
  });

  const handleGoogleSignUp = async () => {
    setOauthLoading(true);
    setLocalError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      });
      if (oauthError) {
        setLocalError(`Google sign-up failed: ${oauthError.message}`);
        setOauthLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setLocalError(`Error: ${msg}`);
      setOauthLoading(false);
    }
  };

  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  // Helper function to check password strength
  const checkPasswordStrength = (password: string) => {
    return {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      length: password.length >= 8,
    };
  };

  // Countdown timer for OTP cooldown
  const handlePasswordChange = (newPassword: string) => {
    setFormData({ ...formData, password: newPassword });
    setPasswordCheck(checkPasswordStrength(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Step 1: Collect Name, Email, Phone & Password
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phone || !formData.password) {
        setLocalError('Please fill in all fields');
        return;
      }

      if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
        setLocalError('Password does not meet requirements');
        return;
      }

      // Skip OTP steps, go directly to medical details
      setStep(4);
      return;
    }

    // Step 4: Medical Details
    if (step === 4) {
      setStep(5);
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await register(
        {
          ...formData,
          doctorAccessCode: '',
        },
        'patient'
      );
      router.push('/login?registered=true');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      setLocalError(errorMessage);
      console.error("[SignupPage] Registration error:", errorMessage);
    }
  };

  const isAccountConflict = (error: string | null): boolean => {
    if (!error) return false;
    return error.includes('already registered') || error.includes('already exists') || error.includes('try signing in');
  };

  const getStepTitle = () => {
    switch(step) {
      case 1: return 'Create Account';
      case 4: return 'Medical Details';
      case 5: return 'Confirm & Create';
      default: return 'Create Account';
    }
  };

  const getStepSubtitle = () => {
    switch(step) {
      case 1: return 'Step 1 of 3: Enter your details';
      case 4: return 'Step 2 of 3: Your medical history';
      case 5: return 'Step 3 of 3: Confirm password';
      default: return '';
    }
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        {getStepTitle()}
      </h2>
      <p className="text-center text-text-secondary mb-8">
        {getStepSubtitle()}
      </p>

        {(authError || localError) && (
          <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
            <p className="mb-3">{authError || localError}</p>
            {isAccountConflict(authError || localError) && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: {
                        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
                      },
                    });
                  }}
                  disabled={loading}
                  className="w-full bg-brand-danger hover:bg-brand-danger/90 disabled:bg-brand-danger/50 text-white font-medium py-2 px-3 rounded transition text-xs"
                >
                  Try signing in with Google
                </button>
                <Link 
                  href="/login" 
                  className="w-full bg-text-secondary hover:bg-text-secondary/90 text-white font-medium py-2 px-3 rounded transition text-xs text-center block"
                >
                  Go to Login
                </Link>
              </div>
            )}
          </div>
        )}

      {/* Quick Sign-up Option: Google OAuth */}
      {step === 1 && (
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
              },
            });
          }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-border-card text-text-primary font-medium py-2 px-4 rounded-lg transition mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <g transform="translate(1 1)">
              <path d="M11 11.5v4.5h6.5m-6.5-9v-4.5h6.5M5.5 11H0M11 0v4.5" stroke="currentColor" strokeWidth="2" />
            </g>
          </svg>
          <span>Sign up with Google</span>
        </button>
      )}

      {/* Divider */}
      {step === 1 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border-card"></div>
          <span className="text-text-secondary text-sm">or continue with email</span>
          <div className="flex-1 h-px bg-border-card"></div>
        </div>
      )}

      {/* Step 1: Basic Info - Name, Email, Phone, Password */}
      {step === 1 && (
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
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border-card rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              placeholder="+1 (555) 000-0000"
            />
          </div>

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
                {showPassword ? '🙈' : '👁️'}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'Next: Verify Phone'}
          </button>
        </form>
      )}

      {/* Step 4: Medical Details */}
      {step === 4 && (
        <form onSubmit={handleNext} className="space-y-4">
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

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Loading...' : 'Next: Set Password'}
              </button>
            </div>
        </form>
      )}

      {/* Step 5: Set Password */}
      {step === 5 && (
        <form onSubmit={handleSubmit} className="space-y-4">
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
                {showPassword ? '🙈' : '👁️'}
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
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 bg-border-card hover:bg-border-card/80 text-text-primary font-medium py-2 px-4 rounded-lg transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary/90 disabled:bg-border-card text-text-on-avatar font-medium py-2 px-4 rounded-lg transition"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
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
  );
}

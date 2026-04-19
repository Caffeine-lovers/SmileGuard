'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';
import { useSignup } from '@/lib/signup-context';
import { PasswordCheck } from '@smileguard/shared-types';

export default function SignupRegisterPage() {
  const router = useRouter();
  const {
    formData,
    updateFormField,
    isOAuthFlow,
    currentAuthUser,
    setCurrentAuthUser,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
  } = useSignup();

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [passwordCheck, setPasswordCheck] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    length: false,
  });

  // Check for OAuth flow on mount
  useEffect(() => {
    const checkOAuthFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('oauth') === 'true') {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setCurrentAuthUser(user);
          updateFormField('email', user.email || '');
          updateFormField('name', user.user_metadata?.full_name || user.email?.split('@')[0] || '');
        }
      }
    };

    checkOAuthFlow();
  }, []);

  const checkPasswordStrength = (password: string) => {
    return {
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      length: password.length >= 8,
    };
  };

  const handlePasswordChange = (newPassword: string) => {
    updateFormField('password', newPassword);
    setPasswordCheck(checkPasswordStrength(newPassword));
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!formData.name) {
      setLocalError('Please enter your name');
      return;
    }

    if (!isOAuthFlow) {
      if (!formData.password) {
        setLocalError('Please enter a password');
        return;
      }

      if (!passwordCheck.length || !passwordCheck.hasUpperCase || !passwordCheck.hasLowerCase || !passwordCheck.hasNumber || !passwordCheck.hasSpecialChar) {
        setLocalError('Password does not meet requirements');
        return;
      }
    }

    router.push('/signup/medical');
  };

  return (
    <div className="bg-bg-surface rounded-lg shadow-lg p-8 border border-border-card max-w-md mx-auto">
      <h2 className="text-3xl font-bold text-center mb-2 text-text-primary">
        Create Account
      </h2>
      <p className="text-center text-text-secondary mb-8">
        Step 1 of 3: Enter your details
      </p>

      {localError && (
        <div className="bg-brand-danger/10 border border-brand-danger text-brand-danger px-4 py-3 rounded mb-6 text-sm">
          {localError}
        </div>
      )}

      <form onSubmit={handleNext} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateFormField('name', e.target.value)}
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
            disabled
            className="w-full px-4 py-2 border border-border-card rounded-lg bg-gray-100 text-text-secondary outline-none cursor-not-allowed"
          />
        </div>

        {!isOAuthFlow && (
          <>
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
                  onChange={(e) => updateFormField('confirmPassword', e.target.value)}
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
          </>
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
            {loading ? 'Loading...' : 'Next: Medical Details'}
          </button>
        </div>
      </form>
    </div>
  );
}
